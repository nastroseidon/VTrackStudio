// Decode a (Cloud-Optimized) GeoTIFF DEM tile into an ElevationGrid, and the
// convenience composition decode -> encode. Server-only (uses geotiff.js).
//
// This module does NOT fetch tiles — the bytes are supplied by the caller. Live
// Copernicus GLO-30 S3 fetching is M2.3, behind the live-provider gate. Kept
// here so it can be unit-tested against an in-memory GeoTIFF fixture.

import { fromArrayBuffer } from "geotiff";
import {
  encodeHeightmap,
  type ElevationGrid,
  type EncodeHeightmapOptions,
  type EncodedHeightmap,
  type LatLngBounds
} from "./encode-heightmap";

export type DecodeGeotiffOptions = {
  /** Override georeferencing; otherwise read from the GeoTIFF bounding box. */
  boundsOverride?: LatLngBounds;
  /** Band index to read as elevation (default 0). */
  band?: number;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Decode elevation samples + georeferencing from a GeoTIFF DEM tile. */
export async function decodeGeotiffToGrid(
  bytes: Uint8Array,
  options: DecodeGeotiffOptions = {}
): Promise<ElevationGrid> {
  const tiff = await fromArrayBuffer(toArrayBuffer(bytes));
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();

  const band = options.band ?? 0;
  const rasters = await image.readRasters();
  const raster = rasters[band] as ArrayLike<number> | number | undefined;
  if (raster === undefined || typeof raster === "number") {
    throw new Error(`decodeGeotiffToGrid: band ${band} is not a raster`);
  }
  if (raster.length !== width * height) {
    throw new Error("decodeGeotiffToGrid: raster length does not match dimensions");
  }

  let bounds: LatLngBounds;
  if (options.boundsOverride) {
    bounds = options.boundsOverride;
  } else {
    const [minX, minY, maxX, maxY] = image.getBoundingBox();
    bounds = { west: minX, south: minY, east: maxX, north: maxY };
  }

  const nodataRaw = image.getGDALNoData();
  const nodata = nodataRaw === null || nodataRaw === undefined ? undefined : Number(nodataRaw);

  return {
    cols: width,
    rows: height,
    data: Float64Array.from(raster, Number),
    bounds,
    nodata
  };
}

/**
 * Decode only the pixel window of a GeoTIFF DEM tile overlapping `bounds`, using
 * COG range reads (geotiff readRasters `window`). Returns the clipped grid with
 * its actual (pixel-snapped) geographic bounds. Efficient for large 1° tiles.
 */
export async function decodeGeotiffWindowToGrid(
  bytes: Uint8Array,
  bounds: LatLngBounds,
  options: DecodeGeotiffOptions = {}
): Promise<ElevationGrid> {
  const tiff = await fromArrayBuffer(toArrayBuffer(bytes));
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const [minX, minY, maxX, maxY] = image.getBoundingBox();
  const pxW = (maxX - minX) / width;
  const pxH = (maxY - minY) / height;

  // Pixel window [left, top, right, bottom]; row 0 is the north edge.
  const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
  const x0 = clamp(Math.floor((bounds.west - minX) / pxW), 0, width);
  let x1 = clamp(Math.ceil((bounds.east - minX) / pxW), 0, width);
  const y0 = clamp(Math.floor((maxY - bounds.north) / pxH), 0, height);
  let y1 = clamp(Math.ceil((maxY - bounds.south) / pxH), 0, height);
  if (x1 <= x0) x1 = Math.min(x0 + 1, width);
  if (y1 <= y0) y1 = Math.min(y0 + 1, height);
  if (x1 <= x0 || y1 <= y0) {
    throw new Error("decodeGeotiffWindowToGrid: bounds do not overlap the tile");
  }

  const band = options.band ?? 0;
  const rasters = await image.readRasters({ window: [x0, y0, x1, y1] });
  const raster = rasters[band] as ArrayLike<number> | number | undefined;
  if (raster === undefined || typeof raster === "number") {
    throw new Error(`decodeGeotiffWindowToGrid: band ${band} is not a raster`);
  }

  const clippedBounds: LatLngBounds = {
    west: minX + x0 * pxW,
    east: minX + x1 * pxW,
    north: maxY - y0 * pxH,
    south: maxY - y1 * pxH
  };

  const nodataRaw = image.getGDALNoData();
  const nodata = nodataRaw === null || nodataRaw === undefined ? undefined : Number(nodataRaw);

  return {
    cols: x1 - x0,
    rows: y1 - y0,
    data: Float64Array.from(raster, Number),
    bounds: options.boundsOverride ?? clippedBounds,
    nodata
  };
}

/** Decode a GeoTIFF DEM tile and encode it straight to a 16-bit heightmap. */
export async function buildHeightmapFromGeotiff(
  bytes: Uint8Array,
  encodeOptions: EncodeHeightmapOptions,
  decodeOptions: DecodeGeotiffOptions = {}
): Promise<EncodedHeightmap> {
  const grid = await decodeGeotiffToGrid(bytes, decodeOptions);
  return encodeHeightmap(grid, encodeOptions);
}
