import { describe, expect, it } from "vitest";
import { writeArrayBuffer } from "geotiff";
import { decodeGeotiffToGrid, buildHeightmapFromGeotiff } from "../../lib/elevation/heightmap/decode-geotiff";

const bounds = { south: 56.0, west: -3.0, north: 56.002, east: -2.998 };

// Build a small georeferenced GeoTIFF (EPSG:4326) in memory as a test fixture.
async function makeGeotiff(values: number[], width: number, height: number, nodata?: number): Promise<Uint8Array> {
  const metadata: Record<string, unknown> = {
    width,
    height,
    GTModelTypeGeoKey: 2, // ModelTypeGeographic
    GTRasterTypeGeoKey: 1, // RasterPixelIsArea
    GeographicTypeGeoKey: 4326,
    ModelPixelScale: [(bounds.east - bounds.west) / width, (bounds.north - bounds.south) / height, 0],
    // tiepoint maps raster (0,0) to the NW corner
    ModelTiepoint: [0, 0, 0, bounds.west, bounds.north, 0]
  };
  if (nodata !== undefined) {
    metadata.GDAL_NODATA = String(nodata);
  }
  const ab = await writeArrayBuffer(Float32Array.from(values), metadata);
  return new Uint8Array(ab);
}

describe("decodeGeotiffToGrid", () => {
  it("reads samples, dimensions and geographic bounds", async () => {
    const values = [10, 20, 30, 40, 50, 60]; // 3x2, north row first
    const bytes = await makeGeotiff(values, 3, 2);
    const grid = await decodeGeotiffToGrid(bytes);

    expect(grid.cols).toBe(3);
    expect(grid.rows).toBe(2);
    expect(Array.from(grid.data)).toEqual(values);
    expect(grid.bounds.west).toBeCloseTo(bounds.west, 6);
    expect(grid.bounds.east).toBeCloseTo(bounds.east, 6);
    expect(grid.bounds.south).toBeCloseTo(bounds.south, 6);
    expect(grid.bounds.north).toBeCloseTo(bounds.north, 6);
  });

  it("surfaces the GDAL nodata value", async () => {
    const bytes = await makeGeotiff([10, 20, 30, -9999], 2, 2, -9999);
    const grid = await decodeGeotiffToGrid(bytes);
    expect(grid.nodata).toBe(-9999);
  });

  it("honours a bounds override", async () => {
    const bytes = await makeGeotiff([1, 2, 3, 4], 2, 2);
    const override = { south: 0, west: 0, north: 1, east: 1 };
    const grid = await decodeGeotiffToGrid(bytes, { boundsOverride: override });
    expect(grid.bounds).toEqual(override);
  });
});

describe("buildHeightmapFromGeotiff", () => {
  it("decodes a GeoTIFF and encodes a 16-bit heightmap end to end", async () => {
    const bytes = await makeGeotiff([0, 10, 20, 30], 2, 2);
    const { raster } = await buildHeightmapFromGeotiff(bytes, {
      source: "copernicus_glo30",
      attribution: "Copernicus DEM",
      artifactPath: "elevation/heightmap.png"
    });
    expect(raster.format).toBe("png-16");
    expect(raster.width).toBe(2);
    expect(raster.height).toBe(2);
    expect(raster.minElevationMeters).toBe(0);
    expect(raster.maxElevationMeters).toBe(30);
    expect(raster.artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("carries nodata through to the encoder (clampToMin default)", async () => {
    const bytes = await makeGeotiff([10, 20, 30, -9999], 2, 2, -9999);
    const { raster } = await buildHeightmapFromGeotiff(bytes, {
      source: "copernicus_glo30",
      attribution: "Copernicus DEM",
      artifactPath: "elevation/heightmap.png"
    });
    // nodata excluded from range: min over valid samples is 10, not -9999
    expect(raster.minElevationMeters).toBe(10);
    expect(raster.maxElevationMeters).toBe(30);
  });
});
