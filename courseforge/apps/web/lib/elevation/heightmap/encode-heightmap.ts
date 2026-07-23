// Pure, deterministic 16-bit heightmap encoding for Phase 2 (DEM heightmaps).
// See courseforge/docs/PHASE2_DEM_HEIGHTMAP_DESIGN.md.
//
// Input is a ready elevation grid (row-major, metres). This module does NOT
// fetch or decode DEM tiles — that is M2.2/M2.3 behind the live-provider gate.
// Everything here is deterministic so encoded bytes and their sha256 are stable
// and unit-testable without a network.

import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import type { CourseHeightmapRaster } from "../../../../../packages/course-schema/src";

export type LatLngBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

/** Row-major elevation grid in metres. `nodata` marks missing samples. */
export type ElevationGrid = {
  cols: number;
  rows: number;
  /** length === cols * rows, row-major (north row first). */
  data: number[] | Float64Array;
  bounds: LatLngBounds;
  /** Sentinel for missing samples; NaN is also treated as nodata. */
  nodata?: number;
};

export type EncodeHeightmapOptions = {
  source: "usgs_3dep" | "copernicus_glo30";
  attribution: string;
  artifactPath: string;
  nodataPolicy?: "clampToMin" | "fillNearest";
  /** Optional Unreal-compatible output dimensions; native grid used when unset. */
  targetWidth?: number;
  targetHeight?: number;
};

export type EncodedHeightmap = {
  bytes: Uint8Array;
  raster: CourseHeightmapRaster;
};

const METERS_PER_DEGREE_LAT = 111_320;

/** Equirectangular metres-per-degree at a given latitude. */
export function metersPerDegree(lat: number): { x: number; y: number } {
  return {
    x: METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180),
    y: METERS_PER_DEGREE_LAT
  };
}

function isNodata(value: number, nodata?: number): boolean {
  return Number.isNaN(value) || (nodata !== undefined && value === nodata);
}

/**
 * Bilinear resample of a grid to target dimensions. nodata samples are excluded
 * from interpolation; a target pixel with no valid contributors stays nodata.
 */
export function resampleGrid(grid: ElevationGrid, targetCols: number, targetRows: number): ElevationGrid {
  if (targetCols === grid.cols && targetRows === grid.rows) {
    return grid;
  }
  if (targetCols < 1 || targetRows < 1) {
    throw new Error("resampleGrid: target dimensions must be >= 1");
  }

  const src = grid.data;
  const out = new Float64Array(targetCols * targetRows);
  const nan = Number.NaN;

  const at = (c: number, r: number): number => {
    const v = src[r * grid.cols + c];
    return isNodata(v, grid.nodata) ? nan : v;
  };

  for (let ty = 0; ty < targetRows; ty++) {
    // Map target pixel centre back to source pixel space.
    const sy = targetRows === 1 ? 0 : (ty / (targetRows - 1)) * (grid.rows - 1);
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, grid.rows - 1);
    const fy = sy - y0;
    for (let tx = 0; tx < targetCols; tx++) {
      const sx = targetCols === 1 ? 0 : (tx / (targetCols - 1)) * (grid.cols - 1);
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, grid.cols - 1);
      const fx = sx - x0;

      const samples = [
        { v: at(x0, y0), w: (1 - fx) * (1 - fy) },
        { v: at(x1, y0), w: fx * (1 - fy) },
        { v: at(x0, y1), w: (1 - fx) * fy },
        { v: at(x1, y1), w: fx * fy }
      ];
      let acc = 0;
      let wsum = 0;
      for (const s of samples) {
        if (!Number.isNaN(s.v) && s.w > 0) {
          acc += s.v * s.w;
          wsum += s.w;
        }
      }
      out[ty * targetCols + tx] = wsum > 0 ? acc / wsum : nan;
    }
  }

  return { cols: targetCols, rows: targetRows, data: out, bounds: grid.bounds, nodata: undefined };
}

/**
 * Fill nodata cells with the nearest valid sample (multi-source BFS over the
 * 4-neighbourhood). Returns a new dense Float64Array; throws if no valid sample.
 */
function fillNearest(grid: ElevationGrid): Float64Array {
  const { cols, rows } = grid;
  const out = new Float64Array(cols * rows);
  const filled = new Uint8Array(cols * rows);
  let queue: number[] = [];

  for (let i = 0; i < out.length; i++) {
    const v = grid.data[i];
    if (!isNodata(v, grid.nodata)) {
      out[i] = v;
      filled[i] = 1;
      queue.push(i);
    }
  }
  if (queue.length === 0) {
    throw new Error("fillNearest: grid has no valid samples");
  }

  while (queue.length > 0) {
    const next: number[] = [];
    for (const idx of queue) {
      const r = Math.floor(idx / cols);
      const c = idx - r * cols;
      const neighbours = [
        c > 0 ? idx - 1 : -1,
        c < cols - 1 ? idx + 1 : -1,
        r > 0 ? idx - cols : -1,
        r < rows - 1 ? idx + cols : -1
      ];
      for (const n of neighbours) {
        if (n >= 0 && filled[n] === 0) {
          out[n] = out[idx];
          filled[n] = 1;
          next.push(n);
        }
      }
    }
    queue = next;
  }
  return out;
}

function minMaxValid(data: Float64Array | number[], nodata?: number): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (isNodata(v, nodata)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error("encodeHeightmap: grid has no valid samples");
  }
  return { min, max };
}

/** Map metres to a 16-bit sample over [min, max]; flat grids map to 0. */
function to16Bit(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const t = (value - min) / (max - min);
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.round(clamped * 65535);
}

// --- Minimal PNG (16-bit grayscale) encoder --------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) typeBytes[i] = type.charCodeAt(i);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);

  const out = new Uint8Array(4 + body.length + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(4 + body.length, crc32(body));
  return out;
}

/** Encode a 16-bit grayscale PNG from row-major big-endian-ready samples. */
export function encodePng16Gray(width: number, height: number, samples: Uint16Array): Uint8Array {
  if (samples.length !== width * height) {
    throw new Error("encodePng16Gray: sample count does not match dimensions");
  }

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 16; // bit depth
  ihdr[9] = 0; // colour type: grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Filtered scanlines: 1 filter byte (0 = none) + width * 2 bytes, big-endian.
  const raw = new Uint8Array(height * (1 + width * 2));
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0;
    for (let x = 0; x < width; x++) {
      const s = samples[y * width + x];
      raw[p++] = (s >>> 8) & 0xff;
      raw[p++] = s & 0xff;
    }
  }
  const idat = deflateSync(raw, { level: 9 });

  const parts = [
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(idat.buffer, idat.byteOffset, idat.byteLength)),
    chunk("IEND", new Uint8Array(0))
  ];
  const total = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Encode an elevation grid into a 16-bit PNG heightmap plus its engine-neutral
 * descriptor. Native grid resolution is used unless target dimensions are given.
 */
export function encodeHeightmap(grid: ElevationGrid, options: EncodeHeightmapOptions): EncodedHeightmap {
  if (grid.cols < 1 || grid.rows < 1 || grid.data.length !== grid.cols * grid.rows) {
    throw new Error("encodeHeightmap: invalid grid dimensions");
  }

  const nodataPolicy = options.nodataPolicy ?? "clampToMin";
  const targetCols = options.targetWidth ?? grid.cols;
  const targetRows = options.targetHeight ?? grid.rows;

  const resampled = resampleGrid(grid, targetCols, targetRows);
  const { min, max } = minMaxValid(resampled.data, resampled.nodata);

  const dense =
    nodataPolicy === "fillNearest" ? fillNearest(resampled) : resampled.data;

  const samples = new Uint16Array(targetCols * targetRows);
  for (let i = 0; i < samples.length; i++) {
    const v = dense[i];
    samples[i] = isNodata(v, resampled.nodata) ? 0 : to16Bit(v, min, max); // clampToMin -> 0
  }

  const bytes = encodePng16Gray(targetCols, targetRows, samples);

  const { south, west, north, east } = grid.bounds;
  const centreLat = (south + north) / 2;
  const centreLng = (west + east) / 2;
  const mpd = metersPerDegree(centreLat);
  const widthMeters = (east - west) * mpd.x;
  const heightMeters = (north - south) * mpd.y;
  const metersPerPixelX = widthMeters / targetCols;
  const metersPerPixelY = heightMeters / targetRows;

  const raster: CourseHeightmapRaster = {
    format: "png-16",
    width: targetCols,
    height: targetRows,
    metersPerPixel: metersPerPixelX,
    minElevationMeters: min,
    maxElevationMeters: max,
    nodataPolicy,
    crs: "EPSG:4326",
    bounds: grid.bounds,
    localGrid: {
      originLat: centreLat,
      originLng: centreLng,
      widthMeters,
      heightMeters,
      metersPerPixelX,
      metersPerPixelY
    },
    artifact: {
      path: options.artifactPath,
      byteLength: bytes.byteLength,
      sha256: sha256Hex(bytes)
    },
    attribution: options.attribution
  };

  return { bytes, raster };
}
