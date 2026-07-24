import { describe, expect, it, vi } from "vitest";
import { writeArrayBuffer } from "geotiff";
import {
  WORLDCOVER_ATTRIBUTION,
  WORLDCOVER_CLASSES,
  WORLDCOVER_DEFAULT_RELEASE,
  layerForWorldCoverClass,
  worldCoverSourceId,
  worldCoverTileExtent,
  worldCoverTileKey,
  worldCoverTileName,
  worldCoverTileUrl,
  worldCoverTilesForBounds
} from "../../lib/surfaces/worldcover/worldcover-tiles";
import { fetchWorldCoverClassGrids, fetchWorldCoverTile } from "../../lib/surfaces/worldcover/fetch-worldcover";

describe("worldCoverTileName / key / url", () => {
  it("snaps to the 3-degree grid and formats the SW corner", () => {
    // St Andrews 56.34N, -2.81W -> lat 54 (floor(56.34/3)*3), lng -3
    expect(worldCoverTileName(56.34, -2.81)).toBe("N54W003");
    expect(worldCoverTileName(0.5, 0.5)).toBe("N00E000");
    expect(worldCoverTileName(-33.9, 18.4)).toBe("S36E018");
  });

  it("builds the verified key convention", () => {
    expect(worldCoverTileKey("N54W003")).toBe(
      "v200/2021/map/ESA_WorldCover_10m_2021_v200_N54W003_Map.tif"
    );
    expect(worldCoverTileKey("N54W003", { version: "v100", year: "2020" })).toBe(
      "v100/2020/map/ESA_WorldCover_10m_2020_v100_N54W003_Map.tif"
    );
    expect(worldCoverTileUrl("N54W003")).toBe(
      "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N54W003_Map.tif"
    );
  });

  it("records an explicit version in the source id", () => {
    expect(worldCoverSourceId()).toBe("esa_worldcover_v200");
    expect(worldCoverSourceId({ version: "v100", year: "2020" })).toBe("esa_worldcover_v100");
    expect(WORLDCOVER_DEFAULT_RELEASE.version).toBe("v200");
  });
});

describe("worldCoverTilesForBounds", () => {
  it("returns one tile for a course inside a single 3-degree cell", () => {
    const tiles = worldCoverTilesForBounds({ south: 56.3, west: -2.85, north: 56.36, east: -2.78 });
    expect(tiles.map((t) => t.name)).toEqual(["N54W003"]);
    expect(worldCoverTileExtent(tiles[0])).toEqual({ south: 54, west: -3, north: 57, east: 0 });
  });

  it("returns multiple tiles across a 3-degree boundary and keeps integer edges in the lower tile", () => {
    const tiles = worldCoverTilesForBounds({ south: 53.9, west: -2.5, north: 54.1, east: -2.4 });
    expect(tiles.map((t) => t.name).sort()).toEqual(["N51W003", "N54W003"]);
    const edge = worldCoverTilesForBounds({ south: 53.0, west: -2.5, north: 54.0, east: -2.4 });
    expect(edge.map((t) => t.swLat)).toEqual([51]);
  });
});

describe("layerForWorldCoverClass", () => {
  it("maps the confirmed legend onto the eight surface layers", () => {
    expect(layerForWorldCoverClass(WORLDCOVER_CLASSES.TREE_COVER)).toBe("trees");
    expect(layerForWorldCoverClass(WORLDCOVER_CLASSES.GRASSLAND)).toBe("rough");
    expect(layerForWorldCoverClass(WORLDCOVER_CLASSES.SHRUBLAND)).toBe("rough");
    expect(layerForWorldCoverClass(WORLDCOVER_CLASSES.PERMANENT_WATER)).toBe("water");
    expect(layerForWorldCoverClass(WORLDCOVER_CLASSES.HERBACEOUS_WETLAND)).toBe("water");
    expect(layerForWorldCoverClass(WORLDCOVER_CLASSES.BUILT_UP)).toBe("bare");
    expect(layerForWorldCoverClass(WORLDCOVER_CLASSES.BARE_SPARSE)).toBe("bare");
    expect(layerForWorldCoverClass(WORLDCOVER_CLASSES.MANGROVES)).toBe("trees");
  });

  it("returns null for no-data and unknown codes", () => {
    expect(layerForWorldCoverClass(WORLDCOVER_CLASSES.NO_DATA)).toBeNull();
    expect(layerForWorldCoverClass(42)).toBeNull();
  });

  it("attribution names ESA WorldCover and CC BY", () => {
    expect(WORLDCOVER_ATTRIBUTION).toMatch(/ESA WorldCover/);
    expect(WORLDCOVER_ATTRIBUTION).toMatch(/CC BY 4\.0/);
  });
});

// Georeferenced class-code fixture covering the whole N54W003 tile (54..57, -3..0).
async function makeClassTile(classCode: number, cols = 30, rows = 30): Promise<Uint8Array> {
  const b = { south: 54, west: -3, north: 57, east: 0 };
  const metadata: Record<string, unknown> = {
    width: cols,
    height: rows,
    GTModelTypeGeoKey: 2,
    GTRasterTypeGeoKey: 1,
    GeographicTypeGeoKey: 4326,
    ModelPixelScale: [(b.east - b.west) / cols, (b.north - b.south) / rows, 0],
    ModelTiepoint: [0, 0, 0, b.west, b.north, 0]
  };
  const ab = await writeArrayBuffer(Uint8Array.from(new Array(cols * rows).fill(classCode)), metadata);
  return new Uint8Array(ab);
}

describe("fetchWorldCoverTile / fetchWorldCoverClassGrids", () => {
  it("fetches and window-decodes the class grid for the course bounds", async () => {
    const tileBytes = await makeClassTile(WORLDCOVER_CLASSES.GRASSLAND);
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("ESA_WorldCover_10m_2021_v200_N54W003_Map.tif");
      return new Response(tileBytes.slice().buffer, { status: 200 });
    }) as unknown as typeof fetch;

    const bounds = { south: 56.3, west: -2.85, north: 56.36, east: -2.78 };
    const grids = await fetchWorldCoverClassGrids(bounds, { fetchImpl });

    expect(grids).toHaveLength(1);
    const grid = grids[0];
    expect(grid.cols).toBeGreaterThan(0);
    expect(grid.rows).toBeGreaterThan(0);
    // every decoded sample is the grassland class code
    expect(Array.from(grid.data as Float64Array).every((v) => v === WORLDCOVER_CLASSES.GRASSLAND)).toBe(true);
    // clipped well inside the 3-degree tile
    expect(grid.bounds.west).toBeGreaterThanOrEqual(-3);
    expect(grid.bounds.north).toBeLessThanOrEqual(57);
  });

  it("propagates fetch failures with the status code", async () => {
    const failing = vi.fn(async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    await expect(fetchWorldCoverTile("https://example.test/x.tif", { fetchImpl: failing })).rejects.toThrow(/403/);
  });

  it("throws when no tile overlaps", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    // Degenerate bounds produce an empty intersection set only if tiles miss —
    // use a zero-area box exactly on a tile corner edge case instead.
    await expect(
      fetchWorldCoverClassGrids({ south: 5, west: 5, north: 5, east: 5 }, { fetchImpl })
    ).rejects.toThrow(/no tiles overlapped/i);
  });
});
