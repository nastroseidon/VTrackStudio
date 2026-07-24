import { describe, expect, it } from "vitest";
import {
  WORLDCOVER_CLASS_TO_LAYER,
  WORLDCOVER_NODATA,
  compositeSurfaceLayers,
  sampleClassNearest,
  type ClassGrid
} from "../../lib/surfaces/composite-surfaces";
import {
  OSM_ATTRIBUTION,
  WORLDCOVER_ATTRIBUTION,
  generateCourseSplatMap
} from "../../lib/surfaces/generate-splat";
import { SURFACE_LAYER_NAMES, UNASSIGNED } from "../../lib/surfaces/encode-splat";
import type { RasterGrid } from "../../lib/surfaces/rasterise-geometry";
import type { CourseGeometry, HoleGeometry, PolygonGeometry } from "../../lib/course-data/types";

// A 1 x 1 degree grid, 4 x 4 pixels — same fixture geometry as splat-rasterise.
const grid: RasterGrid = { width: 4, height: 4, bounds: { south: 0, west: 0, north: 1, east: 1 } };

const idx = (name: (typeof SURFACE_LAYER_NAMES)[number]) => SURFACE_LAYER_NAMES.indexOf(name);

/** Uniform class raster covering the whole grid. */
function uniformClasses(code: number, width = 4, height = 4): ClassGrid {
  return {
    width,
    height,
    bounds: { south: 0, west: 0, north: 1, east: 1 },
    classes: new Uint8Array(width * height).fill(code)
  };
}

function baseWith(assignments: Record<number, number>): Uint8Array {
  const base = new Uint8Array(grid.width * grid.height).fill(UNASSIGNED);
  for (const [i, v] of Object.entries(assignments)) {
    base[Number(i)] = v;
  }
  return base;
}

describe("sampleClassNearest", () => {
  const classes = new Uint8Array([10, 20, 80, 30]);
  const cg: ClassGrid = { width: 2, height: 2, bounds: { south: 0, west: 0, north: 1, east: 1 }, classes };

  it("samples the containing cell", () => {
    expect(sampleClassNearest(cg, 0.75, 0.25)).toBe(10); // NW
    expect(sampleClassNearest(cg, 0.75, 0.75)).toBe(20); // NE
    expect(sampleClassNearest(cg, 0.25, 0.25)).toBe(80); // SW
    expect(sampleClassNearest(cg, 0.25, 0.75)).toBe(30); // SE
  });

  it("returns undefined outside the bounds rather than a sentinel", () => {
    expect(sampleClassNearest(cg, 1.5, 0.5)).toBeUndefined();
    expect(sampleClassNearest(cg, 0.5, -0.1)).toBeUndefined();
  });

  it("clamps the inclusive east and south edges instead of reading off the grid", () => {
    // The GLO-30 mosaic seam bug (M2.6) was exactly this failure mode.
    expect(sampleClassNearest(cg, 0, 1)).toBe(30); // SE corner, both edges inclusive
    expect(sampleClassNearest(cg, 1, 1)).toBe(20); // NE corner
    expect(sampleClassNearest(cg, 0, 0)).toBe(80); // SW corner
  });
});

describe("compositeSurfaceLayers", () => {
  it("never overwrites an OSM pixel with land cover", () => {
    const base = baseWith({ 0: idx("green"), 5: idx("bunker") });
    const { layerIndex, osmPixels } = compositeSurfaceLayers({
      base,
      grid,
      classGrid: uniformClasses(80) // water everywhere
    });
    expect(layerIndex[0]).toBe(idx("green"));
    expect(layerIndex[5]).toBe(idx("bunker"));
    expect(osmPixels).toBe(2);
  });

  it("fills UNASSIGNED pixels from the class raster", () => {
    const { layerIndex, landCoverPixels, fallbackPixels } = compositeSurfaceLayers({
      base: baseWith({}),
      grid,
      classGrid: uniformClasses(10) // tree cover
    });
    expect(landCoverPixels).toBe(16);
    expect(fallbackPixels).toBe(0);
    expect([...layerIndex].every((v) => v === idx("trees"))).toBe(true);
  });

  it("leaves no UNASSIGNED pixel under any input", () => {
    const { layerIndex } = compositeSurfaceLayers({ base: baseWith({}), grid });
    expect([...layerIndex]).not.toContain(UNASSIGNED);
  });

  it("falls back for nodata, unmapped codes, and pixels outside the class raster", () => {
    // Class raster covers only the west half of the grid.
    const westHalf: ClassGrid = {
      width: 2,
      height: 4,
      bounds: { south: 0, west: 0, north: 1, east: 0.5 },
      classes: new Uint8Array([10, 10, WORLDCOVER_NODATA, 10, 42, 10, 10, 10]) // nodata + unknown 42
    };
    const { layerIndex, landCoverPixels, fallbackPixels } = compositeSurfaceLayers({
      base: baseWith({}),
      grid,
      classGrid: westHalf
    });
    // East half (8 px) is outside the raster; nodata and code 42 also fall back.
    expect(fallbackPixels).toBe(10);
    expect(landCoverPixels).toBe(6);
    expect(layerIndex[3]).toBe(idx("rough")); // east column -> fallback
  });

  it("honours a custom fallback layer and rejects an invalid one", () => {
    const { layerIndex } = compositeSurfaceLayers({ base: baseWith({}), grid, fallbackLayer: "bare" });
    expect(layerIndex[0]).toBe(idx("bare"));
    expect(() =>
      compositeSurfaceLayers({ base: baseWith({}), grid, layerNames: ["green"], fallbackLayer: "rough" })
    ).toThrow(/fallback layer/);
  });

  it("maps every confirmed WorldCover class to one of the eight layers", () => {
    for (const [code, layer] of Object.entries(WORLDCOVER_CLASS_TO_LAYER)) {
      expect(SURFACE_LAYER_NAMES, `class ${code}`).toContain(layer);
    }
    // Council amendments: shrubland is rough (scrub merged), built-up is bare (built dropped).
    expect(WORLDCOVER_CLASS_TO_LAYER[20]).toBe("rough");
    expect(WORLDCOVER_CLASS_TO_LAYER[50]).toBe("bare");
  });

  it("rejects mismatched base or classGrid dimensions and out-of-range base values", () => {
    expect(() => compositeSurfaceLayers({ base: new Uint8Array(3), grid })).toThrow(/base length/);
    expect(() =>
      compositeSurfaceLayers({
        base: baseWith({}),
        grid,
        classGrid: { width: 2, height: 2, bounds: grid.bounds, classes: new Uint8Array(3) }
      })
    ).toThrow(/classGrid length/);
    expect(() => compositeSurfaceLayers({ base: baseWith({ 0: 200 }), grid })).toThrow(/out of range/);
  });
});

// --- full generation ---

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

const confidence = { overall: 1, tees: 1, fairways: 1, greens: 1, hazards: 1 };

function hole(partial: Partial<HoleGeometry>): HoleGeometry {
  return {
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
  };
}

function course(holes: HoleGeometry[]): CourseGeometry {
  return { courseId: "osm:test", source: "osm", holes };
}

describe("generateCourseSplatMap", () => {
  const geometry = course([hole({ greens: [rect(0, 0.5, 0.5, 1)] })]); // NW quadrant green

  it("chains rasterise, composite, and encode into complete weightmaps", () => {
    const { splat, layers, coverage } = generateCourseSplatMap({
      geometry,
      grid,
      classGrid: uniformClasses(10),
      landCoverSource: "esa_worldcover_v200"
    });

    expect(coverage.osmPixels).toBe(4); // 2x2 NW quadrant
    expect(coverage.landCoverPixels).toBe(12);
    expect(coverage.fallbackPixels).toBe(0);
    expect(layers.map((l) => l.name).sort()).toEqual(["green", "trees"]);
    expect(splat.sources).toEqual(["osm", "esa_worldcover_v200"]);
    expect(splat.attribution).toBe(`${OSM_ATTRIBUTION}; ${WORLDCOVER_ATTRIBUTION}`);
  });

  it("is deterministic — identical inputs give identical sha256", () => {
    const opts = { geometry, grid, classGrid: uniformClasses(10), landCoverSource: "esa_worldcover_v200" };
    const a = generateCourseSplatMap(opts);
    const b = generateCourseSplatMap(opts);
    expect(a.splat.layers.map((l) => l.artifact.sha256)).toEqual(b.splat.layers.map((l) => l.artifact.sha256));
  });

  it("works without land cover, attributing OSM only", () => {
    const { splat, coverage } = generateCourseSplatMap({ geometry, grid });
    expect(coverage.fallbackPixels).toBe(12);
    expect(splat.sources).toEqual(["osm"]);
    expect(splat.attribution).toBe(OSM_ATTRIBUTION);
  });

  it("requires a versioned land-cover source when a class grid is supplied", () => {
    expect(() => generateCourseSplatMap({ geometry, grid, classGrid: uniformClasses(10) })).toThrow(
      /landCoverSource is required/
    );
  });
});
