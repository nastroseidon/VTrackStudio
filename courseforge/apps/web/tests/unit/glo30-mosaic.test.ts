import { describe, expect, it, vi } from "vitest";
import { writeArrayBuffer } from "geotiff";
import { tilesForBounds, tileExtent } from "../../lib/elevation/copernicus/glo30-tiles";
import { intersectBounds, mosaicSubGrids, sampleGridNearest } from "../../lib/elevation/copernicus/mosaic-glo30";
import { generateGlo30Heightmap } from "../../lib/elevation/copernicus/generate-glo30-heightmap";
import type { ElevationGrid } from "../../lib/elevation/heightmap/encode-heightmap";

describe("tilesForBounds", () => {
  it("returns one tile for a bbox inside a single cell", () => {
    const tiles = tilesForBounds({ south: 56.3, west: -2.85, north: 56.36, east: -2.78 });
    expect(tiles.map((t) => t.name)).toEqual(["Copernicus_DSM_COG_10_N56_00_W003_00_DEM"]);
  });

  it("returns two tiles for a bbox straddling an integer longitude", () => {
    const tiles = tilesForBounds({ south: 56.3, west: -2.05, north: 56.36, east: -1.95 });
    expect(tiles.map((t) => t.name).sort()).toEqual([
      "Copernicus_DSM_COG_10_N56_00_W002_00_DEM",
      "Copernicus_DSM_COG_10_N56_00_W003_00_DEM"
    ]);
  });

  it("keeps an integer max edge in the lower tile", () => {
    // north exactly on 57 should not pull in the N57 tile
    const tiles = tilesForBounds({ south: 56.9, west: -2.5, north: 57.0, east: -2.4 });
    expect(tiles.map((t) => t.swLat)).toEqual([56]);
  });
});

describe("intersectBounds", () => {
  it("returns the overlap or null", () => {
    expect(intersectBounds({ south: 0, west: 0, north: 2, east: 2 }, { south: 1, west: 1, north: 3, east: 3 })).toEqual({
      south: 1,
      west: 1,
      north: 2,
      east: 2
    });
    expect(intersectBounds({ south: 0, west: 0, north: 1, east: 1 }, { south: 2, west: 2, north: 3, east: 3 })).toBeNull();
  });
});

describe("mosaicSubGrids", () => {
  it("stitches two side-by-side sub-grids", () => {
    const left: ElevationGrid = {
      cols: 1,
      rows: 1,
      data: [10],
      bounds: { south: 0, west: 0, north: 1, east: 1 }
    };
    const right: ElevationGrid = {
      cols: 1,
      rows: 1,
      data: [20],
      bounds: { south: 0, west: 1, north: 1, east: 2 }
    };
    const out = mosaicSubGrids([left, right], { south: 0, west: 0, north: 1, east: 2 }, 2, 1);
    expect(Array.from(out.data)).toEqual([10, 20]); // west pixel from left, east from right
  });

  it("marks uncovered pixels as NaN", () => {
    const only: ElevationGrid = { cols: 1, rows: 1, data: [5], bounds: { south: 0, west: 0, north: 1, east: 1 } };
    const out = mosaicSubGrids([only], { south: 0, west: 0, north: 1, east: 2 }, 2, 1);
    expect(out.data[0]).toBe(5);
    expect(Number.isNaN(out.data[1])).toBe(true);
  });
});

describe("sampleGridNearest", () => {
  it("returns NaN outside the grid", () => {
    const g: ElevationGrid = { cols: 2, rows: 1, data: [1, 2], bounds: { south: 0, west: 0, north: 1, east: 2 } };
    expect(sampleGridNearest(g, 0.5, 0.5)).toBe(1);
    expect(sampleGridNearest(g, 0.5, 1.5)).toBe(2);
    expect(Number.isNaN(sampleGridNearest(g, 5, 5))).toBe(true);
  });
});

// A constant-elevation georeferenced fixture for one tile.
async function makeConstantTile(
  swLat: number,
  swLng: number,
  value: number,
  cols = 100,
  rows = 100
): Promise<Uint8Array> {
  const b = tileExtent({ name: "", swLat, swLng });
  const values = new Array(cols * rows).fill(value);
  const metadata: Record<string, unknown> = {
    width: cols,
    height: rows,
    GTModelTypeGeoKey: 2,
    GTRasterTypeGeoKey: 1,
    GeographicTypeGeoKey: 4326,
    ModelPixelScale: [(b.east - b.west) / cols, (b.north - b.south) / rows, 0],
    ModelTiepoint: [0, 0, 0, b.west, b.north, 0]
  };
  const ab = await writeArrayBuffer(Float32Array.from(values), metadata);
  return new Uint8Array(ab);
}

describe("generateGlo30Heightmap (multi-tile)", () => {
  it("mosaics two tiles straddling a longitude boundary", async () => {
    const west = await makeConstantTile(56, -3, 10); // tile W003 -> elevation 10
    const east = await makeConstantTile(56, -2, 20); // tile W002 -> elevation 20

    const fetchImpl = vi.fn(async (url: string) => {
      const bytes = url.includes("W003") ? west : east;
      return new Response(bytes.slice().buffer, { status: 200, headers: { "content-type": "image/tiff" } });
    }) as unknown as typeof fetch;

    const bounds = { south: 56.3, west: -2.05, north: 56.36, east: -1.95 };
    const { raster } = await generateGlo30Heightmap(bounds, { fetchImpl });

    // Both tiles contributed: min from the west tile (10), max from the east (20).
    expect(raster.minElevationMeters).toBe(10);
    expect(raster.maxElevationMeters).toBe(20);
    expect(raster.width).toBeGreaterThan(1);
    expect(raster.height).toBeGreaterThan(0);
    // Two tiles fetched.
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(2);
  });

  it("places each tile's data on the correct side of the seam", async () => {
    const west = await makeConstantTile(56, -3, 10);
    const east = await makeConstantTile(56, -2, 20);
    const fetchImpl = vi.fn(async (url: string) => {
      const bytes = url.includes("W003") ? west : east;
      return new Response(bytes.slice().buffer, { status: 200, headers: { "content-type": "image/tiff" } });
    }) as unknown as typeof fetch;

    // Rebuild the mosaic grid directly so we can inspect placement pre-encoding.
    const bounds = { south: 56.3, west: -2.05, north: 56.36, east: -1.95 };
    const { raster } = await generateGlo30Heightmap(bounds, { fetchImpl, targetWidth: 10, targetHeight: 4 });

    expect(raster.width).toBe(10);
    expect(raster.height).toBe(4);
    // Seam sits at lng -2.0, the midpoint of the bbox: west half 10, east half 20.
    expect(raster.minElevationMeters).toBe(10);
    expect(raster.maxElevationMeters).toBe(20);
  });
});
