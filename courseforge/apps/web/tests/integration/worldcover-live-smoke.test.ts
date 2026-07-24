// WorldCover live smoke — network test, OFF by default so the routine suite
// stays deterministic. Run explicitly, under the approved live-provider gate:
//
//   WORLDCOVER_LIVE=1 npx vitest run tests/integration/worldcover-live-smoke.test.ts
//
// Complements the offline unit tests with a repeatable end-to-end check
// against the real ESA bucket: fetch, window-decode, class validation, and
// full M3.4 splat generation. Uses a US West Coast course deliberately — its
// tile (N36W123, 87.6 MB) is among the largest, so this also exercises the
// worst-case whole-tile download path.

import { describe, expect, it } from "vitest";
import { fetchWorldCoverClassGrid } from "../../lib/surfaces/worldcover/fetch-worldcover";
import { worldCoverSourceId } from "../../lib/surfaces/worldcover/worldcover-tiles";
import { WORLDCOVER_CLASS_TO_LAYER, WORLDCOVER_NODATA } from "../../lib/surfaces/composite-surfaces";
import { generateCourseSplatMap } from "../../lib/surfaces/generate-splat";

const KNOWN_CODES = new Set([WORLDCOVER_NODATA, ...Object.keys(WORLDCOVER_CLASS_TO_LAYER).map(Number)]);

// Pebble Beach Golf Links, ~2.2 x 1.6 km.
const bounds = { south: 36.56, west: -121.96, north: 36.58, east: -121.935 };

describe.runIf(process.env.WORLDCOVER_LIVE === "1")("WorldCover live smoke (gated)", () => {
  it("fetches, decodes, and splat-generates a real course window", { timeout: 300_000 }, async () => {
    const grid = await fetchWorldCoverClassGrid(bounds);

    // ~10 m pixels over ~0.02 deg: expect a window in the low hundreds square.
    expect(grid.width).toBeGreaterThan(100);
    expect(grid.height).toBeGreaterThan(100);
    expect(grid.classes.length).toBe(grid.width * grid.height);

    const counts = new Map<number, number>();
    for (let i = 0; i < grid.classes.length; i++) {
      const c = Number(grid.classes[i]);
      counts.set(c, (counts.get(c) ?? 0) + 1);
      expect(KNOWN_CODES, `unexpected class code ${c}`).toContain(c);
    }
    // A coastal course must see water and some vegetation.
    expect(counts.get(80) ?? 0).toBeGreaterThan(0);
    expect((counts.get(10) ?? 0) + (counts.get(30) ?? 0)).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(
      "class histogram:",
      [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}:${n}`).join(" ")
    );

    // End-to-end: real land cover through the M3.4 pipeline.
    const splat = generateCourseSplatMap({
      geometry: { courseId: "osm:pebble-beach-smoke", source: "osm", holes: [] },
      grid: { width: grid.width, height: grid.height, bounds },
      classGrid: grid,
      landCoverSource: worldCoverSourceId()
    });
    expect(splat.coverage.osmPixels).toBe(0);
    expect(splat.coverage.landCoverPixels).toBeGreaterThan(splat.coverage.fallbackPixels);
    expect(splat.splat.sources).toEqual(["osm", "esa_worldcover_v200"]);
    expect(splat.layers.length).toBeGreaterThan(1);
    // eslint-disable-next-line no-console
    console.log("layers:", splat.layers.map((l) => `${l.name}(${l.bytes.byteLength}B)`).join(" "));
  });
});
