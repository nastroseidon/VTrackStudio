// M3.5: POST /api/course-package/bundle, surface-layer paths. Covers the fast
// path (client-cached bytes), the server-side regeneration fallback, and the
// 409 when neither is available. Live providers are mocked — no network.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProject, createDraftHolePlan, generatedAt } from "../helpers/course-fixtures";
import { createTestClassGrid, createTestGeometry, testBounds, testGrid } from "../helpers/surface-fixtures";
import { generateCourseSplatMap } from "../../lib/surfaces/generate-splat";
import type { CourseProject } from "../../../../packages/course-schema/src";

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

const { POST } = await import("../../app/api/course-package/bundle/route");

/** Minimal stored-ZIP entry lister — enough to prove which artifacts shipped. */
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

/** The splat the client would have generated, used as the project descriptor. */
const generated = generateCourseSplatMap({
  geometry: createTestGeometry(),
  grid: testGrid,
  classGrid: createTestClassGrid(),
  landCoverSource: "esa_worldcover_v200"
});

const cachedLayersBase64 = Object.fromEntries(
  generated.layers.map((layer) => [layer.name, Buffer.from(layer.bytes).toString("base64")])
);

function projectWithSurfaces(overrides: Partial<CourseProject> = {}): CourseProject {
  return {
    ...createProject(),
    providerCourseId: "osm:way/1",
    surfaces: generated.splat,
    ...overrides
  };
}

function post(body: unknown, raw?: string): Request {
  return new Request("http://localhost/api/course-package/bundle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body)
  });
}

async function zipFrom(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

describe("POST /api/course-package/bundle — request validation", () => {
  it("rejects an unreadable body with 400", async () => {
    const response = await POST(post(null, "{not json"));
    expect(response.status).toBe(400);
  });

  it("rejects a missing project with 400", async () => {
    const response = await POST(post({ draftHolePlan: null }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/no course project/i)
    });
  });
});

describe("POST /api/course-package/bundle — surface layers", () => {
  beforeEach(() => {
    getCourseGeometry.mockReset().mockResolvedValue(createTestGeometry());
    fetchWorldCoverClassGrid.mockReset().mockResolvedValue(createTestClassGrid());
  });

  it("packs client-cached layer bytes without any live fetch", async () => {
    const response = await POST(
      post({
        project: projectWithSurfaces(),
        draftHolePlan: createDraftHolePlan(),
        exportedAt: generatedAt,
        surfaceLayersBase64: cachedLayersBase64
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toMatch(/course-bundle\.zip/);

    const names = zipEntryNames(await zipFrom(response));
    expect(names).toContain("course-package.json");
    for (const layer of generated.splat.layers) {
      expect(names).toContain(layer.artifact.path);
    }

    // Fast path: cached bytes mean no provider traffic at all.
    expect(fetchWorldCoverClassGrid).not.toHaveBeenCalled();
    expect(getCourseGeometry).not.toHaveBeenCalled();
  });

  it("regenerates server-side when the client cache is cold", async () => {
    const response = await POST(
      post({
        project: projectWithSurfaces(),
        draftHolePlan: createDraftHolePlan(),
        exportedAt: generatedAt
        // no surfaceLayersBase64 — the cold-cache case
      })
    );

    expect(response.status).toBe(200);
    expect(getCourseGeometry).toHaveBeenCalledWith("osm:way/1");
    // Regeneration must reuse the descriptor's grid so the splat still matches
    // the heightmap it was generated against.
    expect(fetchWorldCoverClassGrid).toHaveBeenCalledWith(testBounds);

    const names = zipEntryNames(await zipFrom(response));
    for (const layer of generated.splat.layers) {
      expect(names).toContain(layer.artifact.path);
    }
  });

  it("falls back wholesale when the client cache is only partial", async () => {
    const [first, ...rest] = generated.splat.layers;
    const partial = Object.fromEntries(rest.map((l) => [l.name, cachedLayersBase64[l.name]]));

    const response = await POST(
      post({ project: projectWithSurfaces(), exportedAt: generatedAt, surfaceLayersBase64: partial })
    );

    // A partial cache is not usable as a fast path — it falls back wholesale.
    expect(response.status).toBe(200);
    expect(fetchWorldCoverClassGrid).toHaveBeenCalledTimes(1);
    expect(zipEntryNames(await zipFrom(response))).toContain(first.artifact.path);
  });

  it("returns 409 when bytes are missing and there is no provider course id", async () => {
    const response = await POST(
      post({
        project: projectWithSurfaces({ providerCourseId: undefined }),
        exportedAt: generatedAt
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/provider course id/i)
    });
    expect(fetchWorldCoverClassGrid).not.toHaveBeenCalled();
  });

  it("returns 503 when regeneration cannot reach the land-cover provider", async () => {
    fetchWorldCoverClassGrid.mockRejectedValue(new Error("WorldCover tile unavailable"));

    const response = await POST(post({ project: projectWithSurfaces(), exportedAt: generatedAt }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "WorldCover tile unavailable" });
  });

  it("returns 503 when the provider no longer has the course geometry", async () => {
    getCourseGeometry.mockResolvedValue(null);

    const response = await POST(post({ project: projectWithSurfaces(), exportedAt: generatedAt }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("osm:way/1")
    });
  });

  it("omits surface artifacts entirely when the project has no surfaces", async () => {
    const response = await POST(
      post({ project: createProject(), draftHolePlan: createDraftHolePlan(), exportedAt: generatedAt })
    );

    expect(response.status).toBe(200);
    const names = zipEntryNames(await zipFrom(response));
    expect(names).toEqual(["course-package.json"]);
    expect(fetchWorldCoverClassGrid).not.toHaveBeenCalled();
  });
});
