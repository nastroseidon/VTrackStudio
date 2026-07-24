// Deterministic surface fixtures shared by the M3.5 route tests. No network:
// the land-cover raster is a hand-built ClassGrid, exactly as the offline
// compositor tests use.

import type { CourseGeometry, HoleGeometry, PolygonGeometry } from "../../lib/course-data/types";
import type { ClassGrid } from "../../lib/surfaces/composite-surfaces";
import type { RasterGrid } from "../../lib/surfaces/rasterise-geometry";

/** A 1 x 1 degree grid, 4 x 4 pixels — the same shape the rasteriser tests use. */
export const testGrid: RasterGrid = {
  width: 4,
  height: 4,
  bounds: { south: 0, west: 0, north: 1, east: 1 }
};

export const testBounds = testGrid.bounds;

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
    confidence: { overall: 1, tees: 1, fairways: 1, greens: 1, hazards: 1 },
    ...partial
  };
}

/** One hole whose fairway covers the west half of the grid. */
export function createTestGeometry(courseId = "osm:way/1"): CourseGeometry {
  return {
    courseId,
    source: "osm",
    holes: [hole({ fairways: [rect(0, 0, 0.5, 1)] })]
  };
}

/** WorldCover class 30 (grassland) everywhere — fills the pixels OSM leaves open. */
export function createTestClassGrid(classCode = 30): ClassGrid {
  return {
    width: testGrid.width,
    height: testGrid.height,
    bounds: testGrid.bounds,
    classes: new Uint8Array(testGrid.width * testGrid.height).fill(classCode)
  };
}
