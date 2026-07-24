import { describe, expect, it } from "vitest";
import { FALLBACK_LAYER, buildCompositeSplat, compositeLayerIndex } from "../../lib/surfaces/composite-splat";
import { SURFACE_LAYER_NAMES, UNASSIGNED } from "../../lib/surfaces/encode-splat";
import { WORLDCOVER_CLASSES } from "../../lib/surfaces/worldcover/worldcover-tiles";
import type { RasterGrid } from "../../lib/surfaces/rasterise-geometry";
import type { WorldCoverClassGrid } from "../../lib/surfaces/worldcover/fetch-worldcover";
import type { CourseGeometry, HoleGeometry, PolygonGeometry } from "../../lib/course-data/types";

const grid: RasterGrid = { width: 4, height: 4, bounds: { south: 0, west: 0, north: 1, east: 1 } };
const idx = (name: (typeof SURFACE_LAYER_NAMES)[number]) => SURFACE_LAYER_NAMES.indexOf(name);

/** Uniform class grid covering given bounds. */
function classGrid(code: number, bounds = grid.bounds, cols = 8, rows = 8): WorldCoverClassGrid {
  return { cols, rows, data: new Float64Array(cols * rows).fill(code), bounds };
}

describe("compositeLayerIndex", () => {
  it("fills UNASSIGNED pixels from WorldCover and leaves OSM pixels alone", () => {
    const layerIndex = new Uint8Array(16).fill(UNASSIGNED);
    layerIndex[0] = idx("green"); // OSM says green
    const out = compositeLayerIndex(layerIndex, grid, [classGrid(WORLDCOVER_CLASSES.TREE_COVER)]);

    expect(out[0]).toBe(idx("green")); // untouched
    for (let i = 1; i < 16; i++) {
      expect(out[i]).toBe(idx("trees")); // filled from land cover
    }
    // input not mutated
    expect(layerIndex[1]).toBe(UNASSIGNED);
  });

  it("maps water and rough classes via the legend", () => {
    const layerIndex = new Uint8Array(16).fill(UNASSIGNED);
    const out = compositeLayerIndex(layerIndex, grid, [classGrid(WORLDCOVER_CLASSES.PERMANENT_WATER)]);
    expect(out.every((v) => v === idx("water"))).toBe(true);

    const out2 = compositeLayerIndex(layerIndex, grid, [classGrid(WORLDCOVER_CLASSES.GRASSLAND)]);
    expect(out2.every((v) => v === idx("rough"))).toBe(true);
  });

  it("falls back to rough for nodata and unmapped classes", () => {
    const layerIndex = new Uint8Array(16).fill(UNASSIGNED);
    // NO_DATA maps to null -> fallback
    const out = compositeLayerIndex(layerIndex, grid, [classGrid(WORLDCOVER_CLASSES.NO_DATA)]);
    expect(out.every((v) => v === idx(FALLBACK_LAYER))).toBe(true);
    // no grids at all -> fallback
    const out2 = compositeLayerIndex(layerIndex, grid, []);
    expect(out2.every((v) => v === idx(FALLBACK_LAYER))).toBe(true);
  });

  it("uses the first class grid containing the point (seam behaviour)", () => {
    const westHalf = classGrid(WORLDCOVER_CLASSES.TREE_COVER, { south: 0, west: 0, north: 1, east: 0.5 });
    const eastHalf = classGrid(WORLDCOVER_CLASSES.PERMANENT_WATER, { south: 0, west: 0.5, north: 1, east: 1 });
    const layerIndex = new Uint8Array(16).fill(UNASSIGNED);
    const out = compositeLayerIndex(layerIndex, grid, [westHalf, eastHalf]);

    // cols 0-1 centres (.125,.375) in west half -> trees; cols 2-3 (.625,.875) -> water
    for (let r = 0; r < 4; r++) {
      expect(out[r * 4 + 0]).toBe(idx("trees"));
      expect(out[r * 4 + 1]).toBe(idx("trees"));
      expect(out[r * 4 + 2]).toBe(idx("water"));
      expect(out[r * 4 + 3]).toBe(idx("water"));
    }
  });

  it("produces no UNASSIGNED output ever", () => {
    const layerIndex = new Uint8Array(16).fill(UNASSIGNED);
    const out = compositeLayerIndex(layerIndex, grid, [classGrid(WORLDCOVER_CLASSES.NO_DATA)]);
    expect(Array.from(out).includes(UNASSIGNED)).toBe(false);
  });

  it("rejects a mismatched layerIndex length", () => {
    expect(() => compositeLayerIndex(new Uint8Array(3), grid, [])).toThrow(/does not match/i);
  });
});

// --- end to end -------------------------------------------------------------

const confidence = { overall: 1, tees: 1, fairways: 1, greens: 1, hazards: 1 };

function rect(west: number, south: number, east: number, north: number): PolygonGeometry {
  return {
    points: [
      { lat: south, lng: west },
      { lat: south, lng: east },
      { lat: north, lng: east },
      { lat: north, lng: west },
      { lat: south, lng: west }
    ]
  };
}

function course(partial: Partial<HoleGeometry>): CourseGeometry {
  return {
    courseId: "osm:test",
    source: "osm",
    holes: [
      {
        holeNumber: 1,
        teeBoxes: [],
        fairways: [],
        greens: [],
        bunkers: [],
        waterHazards: [],
        treeAreas: [],
        cartPaths: [],
        confidence,
        ...partial
      }
    ]
  };
}

describe("buildCompositeSplat", () => {
  it("rasterises, composites and encodes complete weightmaps end to end", () => {
    const geometry = course({ greens: [rect(0, 0.5, 0.5, 1)] }); // NW quadrant green
    const { layers, splat } = buildCompositeSplat(geometry, [classGrid(WORLDCOVER_CLASSES.GRASSLAND)], {
      bounds: grid.bounds,
      width: 4,
      height: 4,
      sources: ["osm", "esa_worldcover_v200"],
      attribution: "OSM ODbL; ESA WorldCover CC BY 4.0"
    });

    expect(layers.map((l) => l.name).sort()).toEqual(["green", "rough"]);
    expect(splat.sources).toContain("esa_worldcover_v200");
    // weights complete: every pixel covered by exactly one layer
    expect(splat.layers).toHaveLength(2);
    const total = layers.reduce((n, l) => n + l.bytes.byteLength, 0);
    expect(total).toBeGreaterThan(0);
  });

  it("carries localGrid metadata through to the splat descriptor", () => {
    const localGrid = {
      originLat: 0.5,
      originLng: 0.5,
      widthMeters: 111000,
      heightMeters: 111000,
      metersPerPixelX: 27750,
      metersPerPixelY: 27750
    };
    const { splat } = buildCompositeSplat(course({}), [classGrid(WORLDCOVER_CLASSES.TREE_COVER)], {
      bounds: grid.bounds,
      width: 4,
      height: 4,
      localGrid,
      sources: ["osm", "esa_worldcover_v200"],
      attribution: "test"
    });
    expect(splat.localGrid).toEqual(localGrid);
    expect(splat.layers.map((l) => l.name)).toEqual(["trees"]);
  });
});
