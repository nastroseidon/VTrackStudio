import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseProject } from "../../../../packages/course-schema/src";
import type { ClassGrid } from "../../lib/surfaces/composite-surfaces";
import type { LatLngBounds } from "../../lib/elevation/heightmap/encode-heightmap";

const fetchWorldCoverClassGrid = vi.fn();
vi.mock("../../lib/surfaces/worldcover/fetch-worldcover", () => ({
  fetchWorldCoverClassGrid: (bounds: LatLngBounds) => fetchWorldCoverClassGrid(bounds)
}));

const { POST: generateSurfaces } = await import("../../app/api/surfaces/generate/route");
const { POST: bundle } = await import("../../app/api/course-package/bundle/route");

const bounds = { south: 41.3258, west: -85.0585, north: 41.3498, east: -85.0345 };
const grid = { width: 16, height: 16, bounds };

function treeClassGrid(): ClassGrid {
  return { width: 16, height: 16, bounds, classes: new Uint8Array(16 * 16).fill(10) };
}

/** Reads the entry names out of a stored-method ZIP. */
function zipEntryNames(zip: Uint8Array): string[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = zip.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("EOCD not found");
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);

  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    names.push(new TextDecoder().decode(zip.slice(ptr + 46, ptr + 46 + nameLen)));
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

/** Runs the real surfaces route to get a descriptor and its layer bytes. */
async function generatedSurfaces() {
  fetchWorldCoverClassGrid.mockResolvedValue(treeClassGrid());
  const response = await generateSurfaces(
    new Request("http://localhost/api/surfaces/generate", {
      method: "POST",
      body: JSON.stringify({ courseId: "bridgewater-golf-club", grid })
    })
  );
  expect(response.status).toBe(200);
  return (await response.json()) as {
    splat: CourseProject["surfaces"];
    layersBase64: Record<string, string>;
  };
}

function project(surfaces: CourseProject["surfaces"], providerCourseId?: string): CourseProject {
  return {
    courseIdentity: { providerId: "mock", providerCourseId: providerCourseId ?? "", name: "Bridgewater Golf Club" },
    providerCourseId,
    location: { lat: 41.3378, lng: -85.0465 },
    status: { courseConfirmed: true, locationConfirmed: true, boundaryConfirmed: true },
    holes: [],
    surfaces
  } as unknown as CourseProject;
}

function bundleRequest(body: unknown): Request {
  return new Request("http://localhost/api/course-package/bundle", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

describe("POST /api/course-package/bundle — surface layers", () => {
  beforeEach(() => {
    fetchWorldCoverClassGrid.mockReset();
  });

  it("packs client-cached layer bytes without refetching land cover", async () => {
    const { splat, layersBase64 } = await generatedSurfaces();
    fetchWorldCoverClassGrid.mockReset();

    const response = await bundle(
      bundleRequest({
        project: project(splat, "bridgewater-golf-club"),
        surfaceLayersBase64: layersBase64,
        exportedAt: "2026-07-24T00:00:00.000Z"
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");

    const names = zipEntryNames(new Uint8Array(await response.arrayBuffer()));
    expect(names).toContain("course-package.json");
    for (const layer of splat!.layers) {
      expect(names).toContain(layer.artifact.path);
    }
    // The cache was complete, so no live fetch should have happened.
    expect(fetchWorldCoverClassGrid).not.toHaveBeenCalled();
  });

  it("regenerates server-side when the client cache is cold", async () => {
    const { splat } = await generatedSurfaces();
    fetchWorldCoverClassGrid.mockReset();
    fetchWorldCoverClassGrid.mockResolvedValue(treeClassGrid());

    const response = await bundle(
      bundleRequest({
        project: project(splat, "bridgewater-golf-club"),
        // No surfaceLayersBase64 at all — the cold-cache fallback path.
        exportedAt: "2026-07-24T00:00:00.000Z"
      })
    );

    expect(response.status).toBe(200);
    expect(fetchWorldCoverClassGrid).toHaveBeenCalledWith(splat!.bounds);

    const names = zipEntryNames(new Uint8Array(await response.arrayBuffer()));
    for (const layer of splat!.layers) {
      expect(names).toContain(layer.artifact.path);
    }
  });

  it("regenerates when the cache is only partially populated", async () => {
    const { splat, layersBase64 } = await generatedSurfaces();
    fetchWorldCoverClassGrid.mockReset();
    fetchWorldCoverClassGrid.mockResolvedValue(treeClassGrid());

    // Drop one layer: a partial cache must not produce a bundle missing an artifact.
    const partial = { ...layersBase64 };
    delete partial[splat!.layers[0].name];

    const response = await bundle(
      bundleRequest({
        project: project(splat, "bridgewater-golf-club"),
        surfaceLayersBase64: partial,
        exportedAt: "2026-07-24T00:00:00.000Z"
      })
    );

    expect(response.status).toBe(200);
    expect(fetchWorldCoverClassGrid).toHaveBeenCalled();

    const names = zipEntryNames(new Uint8Array(await response.arrayBuffer()));
    for (const layer of splat!.layers) {
      expect(names).toContain(layer.artifact.path);
    }
  });

  it("returns 409 when the cache is cold and there is no provider course id", async () => {
    const { splat } = await generatedSurfaces();
    fetchWorldCoverClassGrid.mockReset();

    const response = await bundle(
      bundleRequest({
        project: project(splat, undefined),
        exportedAt: "2026-07-24T00:00:00.000Z"
      })
    );

    // Neither cached bytes nor a way to regenerate them: refuse rather than
    // ship a package whose manifest references artifacts that are not there.
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("provider course id")
    });
    expect(fetchWorldCoverClassGrid).not.toHaveBeenCalled();
  });

  it("reports a failed regeneration as 503", async () => {
    const { splat } = await generatedSurfaces();
    fetchWorldCoverClassGrid.mockReset();
    fetchWorldCoverClassGrid.mockRejectedValue(new Error("WorldCover tile unavailable"));

    const response = await bundle(
      bundleRequest({
        project: project(splat, "bridgewater-golf-club"),
        exportedAt: "2026-07-24T00:00:00.000Z"
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "WorldCover tile unavailable" });
  });

  it("omits the surfaces section entirely when the project has none", async () => {
    const response = await bundle(
      bundleRequest({
        project: project(undefined, "bridgewater-golf-club"),
        exportedAt: "2026-07-24T00:00:00.000Z"
      })
    );

    expect(response.status).toBe(200);
    const names = zipEntryNames(new Uint8Array(await response.arrayBuffer()));
    expect(names).toEqual(["course-package.json"]);
    expect(fetchWorldCoverClassGrid).not.toHaveBeenCalled();
  });
});
