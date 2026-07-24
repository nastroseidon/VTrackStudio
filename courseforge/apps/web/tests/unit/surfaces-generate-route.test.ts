// M3.5: POST /api/surfaces/generate. The live WorldCover fetch and the course
// data service are mocked, so this exercises the route's contract — validation,
// status codes, and the descriptor/bytes payload — without touching the network.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClassGrid, createTestGeometry, testBounds } from "../helpers/surface-fixtures";

const getCourseGeometry = vi.fn();
const fetchWorldCoverClassGrid = vi.fn();

vi.mock("../../lib/course-data/course-data-service", () => ({
  courseDataService: { getCourseGeometry: (id: string) => getCourseGeometry(id) }
}));

vi.mock("../../lib/surfaces/worldcover/fetch-worldcover", () => ({
  fetchWorldCoverClassGrid: (bounds: unknown) => fetchWorldCoverClassGrid(bounds)
}));

vi.mock("../../lib/surfaces/worldcover/worldcover-tiles", () => ({
  worldCoverSourceId: () => "esa_worldcover_v200"
}));

const { POST } = await import("../../app/api/surfaces/generate/route");

function post(body: unknown, raw?: string): Request {
  return new Request("http://localhost/api/surfaces/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body)
  });
}

const validGrid = { width: 4, height: 4, bounds: testBounds };

describe("POST /api/surfaces/generate", () => {
  beforeEach(() => {
    getCourseGeometry.mockReset().mockResolvedValue(createTestGeometry());
    fetchWorldCoverClassGrid.mockReset().mockResolvedValue(createTestClassGrid());
  });

  it("rejects an unreadable body with 400", async () => {
    const response = await POST(post(null, "{not json"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/could not be read/i) });
  });

  it("rejects a missing courseId with 400", async () => {
    const response = await POST(post({ grid: validGrid }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/courseId/i) });
  });

  it("rejects a missing or incomplete grid with 400, pointing at the heightmap", async () => {
    for (const grid of [undefined, { width: 4, height: 4 }, { width: 0, height: 4, bounds: testBounds }]) {
      const response = await POST(post({ courseId: "osm:way/1", grid }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: expect.stringMatching(/heightmap first/i)
      });
    }
    // Validation must short-circuit before any live fetch is attempted.
    expect(fetchWorldCoverClassGrid).not.toHaveBeenCalled();
  });

  it("returns 404 when the provider has no geometry for the course", async () => {
    getCourseGeometry.mockResolvedValue(null);

    const response = await POST(post({ courseId: "osm:way/404", grid: validGrid }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("osm:way/404")
    });
    expect(fetchWorldCoverClassGrid).not.toHaveBeenCalled();
  });

  it("returns the splat descriptor, coverage, and base64 PNG bytes per layer", async () => {
    const response = await POST(post({ courseId: "osm:way/1", grid: validGrid }));
    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.splat).toMatchObject({
      format: "png-8",
      width: 4,
      height: 4,
      crs: "EPSG:4326",
      bounds: testBounds
    });
    // §10.2: the resolved land-cover version is recorded, never an implicit "latest".
    expect(body.splat.sources).toContain("osm");
    expect(body.splat.sources).toContain("esa_worldcover_v200");
    expect(body.splat.attribution).toMatch(/OpenStreetMap/);
    expect(body.splat.attribution).toMatch(/WorldCover/);

    // Pixel provenance: the fairway covers the west half (8 of 16 px), the
    // grassland raster fills the rest, and nothing falls back.
    expect(body.coverage).toMatchObject({ osmPixels: 8, landCoverPixels: 8, fallbackPixels: 0 });
    const { osmPixels, landCoverPixels, fallbackPixels } = body.coverage;
    expect(osmPixels + landCoverPixels + fallbackPixels).toBe(16);

    // Every declared layer has bytes, and they are real PNGs.
    expect(body.splat.layers.length).toBeGreaterThan(0);
    for (const layer of body.splat.layers) {
      const base64 = body.layersBase64[layer.name];
      expect(base64, `bytes for layer ${layer.name}`).toBeTruthy();
      const bytes = Buffer.from(base64, "base64");
      expect(Array.from(bytes.subarray(0, 4))).toEqual([137, 80, 78, 71]);
    }

    // The live fetch is scoped to the requested grid, not the whole tile.
    expect(fetchWorldCoverClassGrid).toHaveBeenCalledWith(testBounds);
  });

  it("is deterministic — identical requests produce identical layer bytes", async () => {
    const first = await (await POST(post({ courseId: "osm:way/1", grid: validGrid }))).json();
    const second = await (await POST(post({ courseId: "osm:way/1", grid: validGrid }))).json();

    expect(second.layersBase64).toEqual(first.layersBase64);
    expect(second.splat.layers).toEqual(first.splat.layers);
  });

  it("returns 503 with the provider message when the live land-cover fetch fails", async () => {
    fetchWorldCoverClassGrid.mockRejectedValue(new Error("WorldCover tile unavailable"));

    const response = await POST(post({ courseId: "osm:way/1", grid: validGrid }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "WorldCover tile unavailable" });
  });
});
