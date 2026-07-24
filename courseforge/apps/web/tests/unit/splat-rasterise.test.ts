import { describe, expect, it } from "vitest";
import {
  SURFACE_PAINT_ORDER,
  fillPolygon,
  latLngToPixel,
  polygonsByLayer,
  rasteriseCourseGeometry,
  type RasterGrid
} from "../../lib/surfaces/rasterise-geometry";
import { SURFACE_LAYER_NAMES, UNASSIGNED, encodeSplatMap } from "../../lib/surfaces/encode-splat";
import type { CourseGeometry, HoleGeometry, PolygonGeometry } from "../../lib/course-data/types";

// A 1 x 1 degree grid, 4 x 4 pixels — each pixel is 0.25 deg, centres at .125, .375, .625, .875
const grid: RasterGrid = { width: 4, height: 4, bounds: { south: 0, west: 0, north: 1, east: 1 } };

function rect(west: number, south: number, east: number, north: number): PolygonGeometry {
  return {
    points: [
      { lat: south, lng: west },
      { lat: south, lng: east },
      { lat: north, lng: east },
      { lat: north, lng: west },
      { lat: south, lng: west } // closed ring
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

const idx = (name: (typeof SURFACE_LAYER_NAMES)[number]) => SURFACE_LAYER_NAMES.indexOf(name);

describe("latLngToPixel", () => {
  it("maps north-west to the origin and inverts latitude", () => {
    expect(latLngToPixel(grid, 1, 0)).toEqual({ x: 0, y: 0 });
    expect(latLngToPixel(grid, 0, 1)).toEqual({ x: 4, y: 4 });
    expect(latLngToPixel(grid, 0.5, 0.5)).toEqual({ x: 2, y: 2 });
  });
});

describe("fillPolygon", () => {
  it("fills the covered pixels only", () => {
    const out = new Uint8Array(16).fill(UNASSIGNED);
    // west half of the grid
    fillPolygon(out, grid, rect(0, 0, 0.5, 1), 3);
    for (let y = 0; y < 4; y++) {
      expect(out[y * 4 + 0]).toBe(3);
      expect(out[y * 4 + 1]).toBe(3);
      expect(out[y * 4 + 2]).toBe(UNASSIGNED);
      expect(out[y * 4 + 3]).toBe(UNASSIGNED);
    }
  });

  it("ignores degenerate polygons", () => {
    const out = new Uint8Array(16).fill(UNASSIGNED);
    fillPolygon(out, grid, { points: [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }] }, 1);
    fillPolygon(out, grid, { points: [] }, 1);
    expect(out.every((v) => v === UNASSIGNED)).toBe(true);
  });

  it("clips polygons extending outside the grid", () => {
    const out = new Uint8Array(16).fill(UNASSIGNED);
    fillPolygon(out, grid, rect(-5, -5, 0.5, 5), 2);
    // still only the west half is painted, nothing written out of range
    expect(out[0]).toBe(2);
    expect(out[1]).toBe(2);
    expect(out[2]).toBe(UNASSIGNED);
    expect(out.length).toBe(16);
  });

  it("leaves the grid untouched for a polygon fully outside", () => {
    const out = new Uint8Array(16).fill(UNASSIGNED);
    fillPolygon(out, grid, rect(5, 5, 6, 6), 1);
    expect(out.every((v) => v === UNASSIGNED)).toBe(true);
  });
});

describe("polygonsByLayer", () => {
  it("aggregates polygons across holes and pulls tee polygons out of teeBoxes", () => {
    const g = course([
      hole({ fairways: [rect(0, 0, 1, 1)], teeBoxes: [{ teeName: "back", polygon: rect(0, 0, 0.2, 0.2) }] }),
      hole({ holeNumber: 2, fairways: [rect(0, 0, 0.5, 0.5)], teeBoxes: [{ teeName: "no polygon" }] })
    ]);
    const byLayer = polygonsByLayer(g);
    expect(byLayer.get("fairway")).toHaveLength(2);
    expect(byLayer.get("tee")).toHaveLength(1); // the tee box without a polygon is skipped
    expect(byLayer.has("green")).toBe(false);
  });
});

describe("rasteriseCourseGeometry", () => {
  it("leaves uncovered pixels UNASSIGNED for the land-cover compositor", () => {
    const out = rasteriseCourseGeometry(course([hole({})]), grid);
    expect(out).toHaveLength(16);
    expect(out.every((v) => v === UNASSIGNED)).toBe(true);
  });

  it("applies precedence: a green overwrites the fairway beneath it", () => {
    const g = course([
      hole({
        fairways: [rect(0, 0, 1, 1)], // covers everything
        greens: [rect(0, 0, 0.5, 0.5)] // south-west quadrant
      })
    ]);
    const out = rasteriseCourseGeometry(g, grid);

    // south-west quadrant is green (rows 2-3, cols 0-1)
    expect(out[2 * 4 + 0]).toBe(idx("green"));
    expect(out[3 * 4 + 1]).toBe(idx("green"));
    // elsewhere remains fairway
    expect(out[0]).toBe(idx("fairway"));
    expect(out[1 * 4 + 3]).toBe(idx("fairway"));
  });

  it("orders bunker above water and both above fairway", () => {
    const g = course([
      hole({
        fairways: [rect(0, 0, 1, 1)],
        waterHazards: [rect(0, 0, 1, 0.5)], // south half
        bunkers: [rect(0, 0, 0.5, 0.5)] // south-west quadrant
      })
    ]);
    const out = rasteriseCourseGeometry(g, grid);
    expect(out[3 * 4 + 0]).toBe(idx("bunker")); // SW: bunker wins
    expect(out[3 * 4 + 3]).toBe(idx("water")); // SE: water over fairway
    expect(out[0 * 4 + 0]).toBe(idx("fairway")); // north: fairway
  });

  it("paint order is lowest-precedence first and ends with green", () => {
    expect(SURFACE_PAINT_ORDER[0]).toBe("trees");
    expect(SURFACE_PAINT_ORDER[SURFACE_PAINT_ORDER.length - 1]).toBe("green");
  });

  it("feeds encodeSplatMap end to end", () => {
    const g = course([hole({ fairways: [rect(0, 0, 1, 1)], greens: [rect(0, 0, 0.5, 0.5)] })]);
    const layerIndex = rasteriseCourseGeometry(g, grid);
    const { layers, splat } = encodeSplatMap({
      width: grid.width,
      height: grid.height,
      bounds: grid.bounds,
      layerIndex,
      sources: ["osm"],
      attribution: "OSM ODbL"
    });

    expect(layers.map((l) => l.name).sort()).toEqual(["fairway", "green"]);
    expect(splat.width).toBe(4);
    expect(splat.layers.every((l) => l.artifact.sha256.length === 64)).toBe(true);
  });

  it("rejects an invalid grid", () => {
    expect(() => rasteriseCourseGeometry(course([]), { ...grid, width: 0 })).toThrow(/invalid grid/i);
  });
});
