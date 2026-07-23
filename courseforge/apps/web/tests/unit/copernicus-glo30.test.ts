import { describe, expect, it, vi } from "vitest";
import { writeArrayBuffer } from "geotiff";
import {
  COPERNICUS_GLO30_ATTRIBUTION,
  glo30TileName,
  glo30TileKey,
  glo30TileUrl,
  tileForBounds
} from "../../lib/elevation/copernicus/glo30-tiles";
import { generateGlo30Heightmap } from "../../lib/elevation/copernicus/generate-glo30-heightmap";
import {
  boundsFromBoundary,
  generateCopernicusElevationModel
} from "../../lib/elevation/copernicus-glo30-elevation-provider";
import type { CourseBoundary } from "../../../../packages/course-schema/src";

// A georeferenced fixture GeoTIFF covering the whole N56/W003 tile (56..57, -3..-2).
async function makeTileFixture(cols: number, rows: number): Promise<Uint8Array> {
  const tileBounds = { south: 56, west: -3, north: 57, east: -2 };
  const values: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      values.push(r * 10 + c); // deterministic ramp
    }
  }
  const metadata: Record<string, unknown> = {
    width: cols,
    height: rows,
    GTModelTypeGeoKey: 2,
    GTRasterTypeGeoKey: 1,
    GeographicTypeGeoKey: 4326,
    ModelPixelScale: [(tileBounds.east - tileBounds.west) / cols, (tileBounds.north - tileBounds.south) / rows, 0],
    ModelTiepoint: [0, 0, 0, tileBounds.west, tileBounds.north, 0]
  };
  const ab = await writeArrayBuffer(Float32Array.from(values), metadata);
  return new Uint8Array(ab);
}

function fixtureFetch(bytes: Uint8Array): typeof fetch {
  return vi.fn(async () =>
    new Response(bytes.slice().buffer, { status: 200, headers: { "content-type": "image/tiff" } })
  ) as unknown as typeof fetch;
}

describe("glo30 tile addressing", () => {
  it("names the tile by its integer SW corner", () => {
    expect(glo30TileName(56.34, -2.8)).toBe("Copernicus_DSM_COG_10_N56_00_W003_00_DEM");
    expect(glo30TileName(0.5, 0.5)).toBe("Copernicus_DSM_COG_10_N00_00_E000_00_DEM");
    expect(glo30TileName(-33.9, 18.4)).toBe("Copernicus_DSM_COG_10_S34_00_E018_00_DEM");
  });

  it("builds keys and URLs", () => {
    const name = glo30TileName(56.34, -2.8);
    expect(glo30TileKey(name)).toBe(`${name}/${name}.tif`);
    expect(glo30TileUrl(name)).toBe(
      `https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/${name}/${name}.tif`
    );
  });

  it("returns the covering tile and rejects multi-tile bounds", () => {
    const tile = tileForBounds({ south: 56.3, west: -2.85, north: 56.36, east: -2.78 });
    expect(tile.name).toBe("Copernicus_DSM_COG_10_N56_00_W003_00_DEM");
    expect(() => tileForBounds({ south: 56.9, west: -3.1, north: 57.1, east: -2.9 })).toThrow(/multi-tile|more than one/i);
  });
});

describe("generateGlo30Heightmap", () => {
  it("fetches, window-clips and encodes a heightmap with Copernicus attribution", async () => {
    const bytes = await makeTileFixture(20, 20);
    const bounds = { south: 56.3, west: -2.85, north: 56.36, east: -2.78 };
    const encoded = await generateGlo30Heightmap(bounds, { fetchImpl: fixtureFetch(bytes) });

    expect(encoded.raster.format).toBe("png-16");
    expect(encoded.raster.attribution).toBe(COPERNICUS_GLO30_ATTRIBUTION);
    // clipped to a sub-window: smaller than the full 20x20 tile
    expect(encoded.raster.width).toBeLessThan(20);
    expect(encoded.raster.height).toBeLessThan(20);
    expect(encoded.raster.width).toBeGreaterThan(0);
    expect(encoded.raster.artifact.byteLength).toBe(encoded.bytes.byteLength);
  });

  it("propagates a fetch failure", async () => {
    const failing = vi.fn(async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    await expect(
      generateGlo30Heightmap({ south: 56.3, west: -2.85, north: 56.36, east: -2.78 }, { fetchImpl: failing })
    ).rejects.toThrow(/404/);
  });
});

describe("generateCopernicusElevationModel", () => {
  const boundary: CourseBoundary = {
    type: "Polygon",
    coordinates: [
      [
        [-2.85, 56.3],
        [-2.78, 56.3],
        [-2.78, 56.36],
        [-2.85, 56.36],
        [-2.85, 56.3]
      ]
    ]
  };

  it("derives the bbox from the boundary ring", () => {
    expect(boundsFromBoundary(boundary)).toEqual({ south: 56.3, west: -2.85, north: 56.36, east: -2.78 });
  });

  it("builds a CourseElevationModel carrying the heightmap", async () => {
    const bytes = await makeTileFixture(20, 20);
    const { model, heightmapBytes } = await generateCopernicusElevationModel(boundary, {
      fetchImpl: fixtureFetch(bytes),
      generatedAt: "2026-07-22T00:00:00.000Z"
    });

    expect(model.source).toBe("copernicus_glo30");
    expect(model.status).toBe("generated");
    expect(model.generatedAt).toBe("2026-07-22T00:00:00.000Z");
    expect(model.heightmap).toBeDefined();
    expect(model.heightmap?.attribution).toBe(COPERNICUS_GLO30_ATTRIBUTION);
    expect(model.minElevationMeters).toBe(model.heightmap?.minElevationMeters);
    expect(heightmapBytes.byteLength).toBe(model.heightmap?.artifact.byteLength);
  });
});
