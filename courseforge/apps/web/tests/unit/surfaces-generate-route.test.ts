import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassGrid } from "../../lib/surfaces/composite-surfaces";
import type { LatLngBounds } from "../../lib/elevation/heightmap/encode-heightmap";

// The route performs a live WorldCover fetch. Stub it so the suite stays
// offline and deterministic, exactly as the provider modules do elsewhere.
const fetchWorldCoverClassGrid = vi.fn();
vi.mock("../../lib/surfaces/worldcover/fetch-worldcover", () => ({
  fetchWorldCoverClassGrid: (bounds: LatLngBounds) => fetchWorldCoverClassGrid(bounds)
}));

const { POST } = await import("../../app/api/surfaces/generate/route");

const bounds = { south: 41.3258, west: -85.0585, north: 41.3498, east: -85.0345 };
const grid = { width: 16, height: 16, bounds };

/** Uniform tree-cover raster (WorldCover class 10) on the request grid. */
function treeClassGrid(): ClassGrid {
  return { width: 16, height: 16, bounds, classes: new Uint8Array(16 * 16).fill(10) };
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/surfaces/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/surfaces/generate", () => {
  beforeEach(() => {
    fetchWorldCoverClassGrid.mockReset();
  });

  it("rejects a body that is not JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/surfaces/generate", { method: "POST", body: "not json" })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("could not be read") });
    expect(fetchWorldCoverClassGrid).not.toHaveBeenCalled();
  });

  it("rejects a request with no courseId", async () => {
    const response = await POST(post({ grid }));

    expect(response.status).toBe(400);
    expect(fetchWorldCoverClassGrid).not.toHaveBeenCalled();
  });

  it("rejects a request with no grid, pointing at the heightmap step", async () => {
    const response = await POST(post({ courseId: "bridgewater-golf-club" }));

    expect(response.status).toBe(400);
    // The splat must share the heightmap's grid, so the error has to say so.
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("heightmap")
    });
  });

  it("rejects a grid missing its dimensions", async () => {
    const response = await POST(post({ courseId: "bridgewater-golf-club", grid: { bounds } }));

    expect(response.status).toBe(400);
    expect(fetchWorldCoverClassGrid).not.toHaveBeenCalled();
  });

  it("returns 404 for a course with no geometry, without fetching land cover", async () => {
    const response = await POST(post({ courseId: "no-such-course", grid }));

    expect(response.status).toBe(404);
    // No provider has geometry, so we must not spend a live tile fetch.
    expect(fetchWorldCoverClassGrid).not.toHaveBeenCalled();
  });

  it("returns a splat descriptor plus base64 layer bytes on the requested grid", async () => {
    fetchWorldCoverClassGrid.mockResolvedValue(treeClassGrid());

    const response = await POST(post({ courseId: "bridgewater-golf-club", grid }));

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(fetchWorldCoverClassGrid).toHaveBeenCalledWith(bounds);
    expect(payload.splat.width).toBe(16);
    expect(payload.splat.height).toBe(16);
    expect(payload.splat.bounds).toEqual(bounds);
    // Attribution enforcement: both sources must be recorded, land cover versioned.
    expect(payload.splat.sources).toContain("osm");
    expect(payload.splat.sources.some((s: string) => s.startsWith("esa_worldcover"))).toBe(true);

    // Every declared layer must have bytes the client can cache, and they must
    // be real PNGs — the bundle route trusts these verbatim.
    expect(payload.splat.layers.length).toBeGreaterThan(0);
    for (const layer of payload.splat.layers) {
      const b64 = payload.layersBase64[layer.name];
      expect(b64, `missing bytes for layer ${layer.name}`).toBeTypeOf("string");
      const bytes = Buffer.from(b64, "base64");
      expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    }

    // The whole grid was classified, so nothing fell through to the fallback.
    expect(payload.coverage.fallbackPixels).toBe(0);
  });

  it("reports a land-cover fetch failure as 503 rather than crashing", async () => {
    fetchWorldCoverClassGrid.mockRejectedValue(new Error("WorldCover tile unavailable"));

    const response = await POST(post({ courseId: "bridgewater-golf-club", grid }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "WorldCover tile unavailable" });
  });
});
