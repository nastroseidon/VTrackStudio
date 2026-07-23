import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import {
  encodeHeightmap,
  encodePng16Gray,
  metersPerDegree,
  resampleGrid,
  type ElevationGrid
} from "../../lib/elevation/heightmap/encode-heightmap";

// Independent minimal PNG parser used to prove the encoder round-trips.
function decodePng16Gray(bytes: Uint8Array): { width: number; height: number; bitDepth: number; colorType: number; samples: Uint16Array } {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i++) {
    expect(bytes[i]).toBe(sig[i]);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let ihdr: { width: number; height: number; bitDepth: number; colorType: number } | null = null;
  const idatParts: Uint8Array[] = [];
  const typeAt = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);

  while (offset < bytes.length) {
    const len = view.getUint32(offset);
    const type = typeAt(offset + 4);
    const dataStart = offset + 8;
    if (type === "IHDR") {
      ihdr = {
        width: view.getUint32(dataStart),
        height: view.getUint32(dataStart + 4),
        bitDepth: bytes[dataStart + 8],
        colorType: bytes[dataStart + 9]
      };
    } else if (type === "IDAT") {
      idatParts.push(bytes.slice(dataStart, dataStart + len));
    }
    offset = dataStart + len + 4; // skip data + CRC
    if (type === "IEND") break;
  }
  if (!ihdr) throw new Error("no IHDR");

  const compressed = Buffer.concat(idatParts.map((p) => Buffer.from(p)));
  const raw = new Uint8Array(inflateSync(compressed));
  const { width, height } = ihdr;
  const samples = new Uint16Array(width * height);
  const stride = 1 + width * 2;
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    expect(raw[rowStart]).toBe(0); // filter byte: none
    for (let x = 0; x < width; x++) {
      const o = rowStart + 1 + x * 2;
      samples[y * width + x] = (raw[o] << 8) | raw[o + 1];
    }
  }
  return { ...ihdr, samples };
}

const bounds = { south: 56.0, west: -3.0, north: 56.001, east: -2.999 };

function grid(data: number[], cols: number, rows: number, nodata?: number): ElevationGrid {
  return { cols, rows, data, bounds, nodata };
}

describe("metersPerDegree", () => {
  it("shrinks longitude spacing with latitude", () => {
    expect(metersPerDegree(0).x).toBeCloseTo(111320, 0);
    expect(metersPerDegree(56).x).toBeCloseTo(111320 * Math.cos((56 * Math.PI) / 180), 0);
    expect(metersPerDegree(56).y).toBe(111320);
  });
});

describe("encodePng16Gray", () => {
  it("produces a decodable 16-bit grayscale PNG that round-trips", () => {
    const samples = new Uint16Array([0, 21845, 43690, 65535]);
    const png = encodePng16Gray(2, 2, samples);
    const decoded = decodePng16Gray(png);
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(decoded.bitDepth).toBe(16);
    expect(decoded.colorType).toBe(0);
    expect(Array.from(decoded.samples)).toEqual([0, 21845, 43690, 65535]);
  });

  it("is deterministic (stable bytes)", () => {
    const s = new Uint16Array([1, 2, 3, 4, 5, 6]);
    const a = encodePng16Gray(3, 2, s);
    const b = encodePng16Gray(3, 2, s);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it("throws when sample count mismatches dimensions", () => {
    expect(() => encodePng16Gray(2, 2, new Uint16Array([1, 2, 3]))).toThrow();
  });
});

describe("resampleGrid", () => {
  it("bilinearly resamples a 2x2 ramp to 3x3 with a midpoint", () => {
    const src = grid([0, 10, 20, 30], 2, 2);
    const out = resampleGrid(src, 3, 3);
    expect(out.cols).toBe(3);
    expect(out.rows).toBe(3);
    // centre pixel is the average of the four corners
    expect(out.data[4]).toBeCloseTo(15, 6);
    // corners preserved
    expect(out.data[0]).toBeCloseTo(0, 6);
    expect(out.data[8]).toBeCloseTo(30, 6);
  });

  it("excludes nodata from interpolation", () => {
    const src = grid([0, 10, 20, NaN], 2, 2);
    const out = resampleGrid(src, 2, 2);
    // the NaN corner is dropped; its own pixel falls back to remaining weight 0 -> NaN
    expect(Number.isNaN(out.data[3])).toBe(true);
    expect(out.data[0]).toBeCloseTo(0, 6);
  });
});

describe("encodeHeightmap", () => {
  const opts = {
    source: "copernicus_glo30" as const,
    attribution: "Copernicus DEM",
    artifactPath: "elevation/heightmap.png"
  };

  it("maps elevations linearly onto the 16-bit range and round-trips", () => {
    const { bytes, raster } = encodeHeightmap(grid([0, 10, 20, 30], 2, 2), opts);
    expect(raster.format).toBe("png-16");
    expect(raster.width).toBe(2);
    expect(raster.height).toBe(2);
    expect(raster.minElevationMeters).toBe(0);
    expect(raster.maxElevationMeters).toBe(30);
    expect(raster.crs).toBe("EPSG:4326");
    expect(raster.bounds).toEqual(bounds);
    expect(raster.artifact.path).toBe("elevation/heightmap.png");
    expect(raster.artifact.byteLength).toBe(bytes.byteLength);
    expect(raster.artifact.sha256).toMatch(/^[0-9a-f]{64}$/);

    const decoded = decodePng16Gray(bytes);
    expect(Array.from(decoded.samples)).toEqual([0, 21845, 43690, 65535]);
  });

  it("computes local metric grid metadata from the bbox", () => {
    const { raster } = encodeHeightmap(grid([0, 10, 20, 30], 2, 2), opts);
    const lg = raster.localGrid!;
    expect(lg.originLat).toBeCloseTo(56.0005, 6);
    expect(lg.originLng).toBeCloseTo(-2.9995, 6);
    // widthMeters = 0.001 deg * metersPerDegree(centreLat).x
    const expectedWidth = 0.001 * metersPerDegree(56.0005).x;
    expect(lg.widthMeters).toBeCloseTo(expectedWidth, 3);
    expect(lg.metersPerPixelX).toBeCloseTo(expectedWidth / 2, 3);
    expect(raster.metersPerPixel).toBeCloseTo(expectedWidth / 2, 3);
  });

  it("honours configurable output dimensions (resample)", () => {
    const { raster } = encodeHeightmap(grid([0, 10, 20, 30], 2, 2), { ...opts, targetWidth: 4, targetHeight: 4 });
    expect(raster.width).toBe(4);
    expect(raster.height).toBe(4);
  });

  it("clampToMin sends nodata pixels to sample 0", () => {
    const { bytes } = encodeHeightmap(grid([10, 20, 30, NaN], 2, 2), { ...opts, nodataPolicy: "clampToMin" });
    const decoded = decodePng16Gray(bytes);
    expect(decoded.samples[3]).toBe(0); // nodata -> min
  });

  it("fillNearest replaces nodata with a neighbour value", () => {
    const { bytes } = encodeHeightmap(grid([10, 20, 30, NaN], 2, 2), { ...opts, nodataPolicy: "fillNearest" });
    const decoded = decodePng16Gray(bytes);
    // nodata pixel is filled from a neighbour (20 or 30), never left at 0/min
    expect(decoded.samples[3]).toBeGreaterThan(0);
  });

  it("flat grids encode as all zeros without dividing by zero", () => {
    const { bytes, raster } = encodeHeightmap(grid([5, 5, 5, 5], 2, 2), opts);
    expect(raster.minElevationMeters).toBe(5);
    expect(raster.maxElevationMeters).toBe(5);
    const decoded = decodePng16Gray(bytes);
    expect(Array.from(decoded.samples)).toEqual([0, 0, 0, 0]);
  });

  it("throws when the grid has no valid samples", () => {
    expect(() => encodeHeightmap(grid([NaN, NaN, NaN, NaN], 2, 2), opts)).toThrow();
  });
});
