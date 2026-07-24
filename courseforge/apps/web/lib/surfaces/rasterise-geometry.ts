// Rasterise OSM-derived course geometry into a per-pixel surface layer
// assignment (Phase 3 M3.2). The result feeds encodeSplatMap.
//
// Playing surfaces come from vector polygons, never from a land-cover raster:
// a 10 m classification must not overwrite a traced green. Pixels no polygon
// covers are left UNASSIGNED so the M3.4 compositor can fill them from
// WorldCover. See courseforge/docs/PHASE3_LANDCOVER_SPLAT_DESIGN.md.
//
// Pure and deterministic: no network, no clock, no randomness.

import type { CourseGeometry, PolygonGeometry } from "../course-data/types";
import type { CourseSurfaceLayerName } from "../../../../packages/course-schema/src";
import type { LatLngBounds } from "../elevation/heightmap/encode-heightmap";
import { SURFACE_LAYER_NAMES, UNASSIGNED } from "./encode-splat";

export type RasterGrid = {
  width: number;
  height: number;
  bounds: LatLngBounds;
};

/**
 * Paint order, lowest precedence first — later layers overwrite earlier ones
 * where polygons overlap. Greens/tees are the most specific and must win;
 * broad areas like fairway and tree cover sit underneath.
 */
export const SURFACE_PAINT_ORDER: readonly CourseSurfaceLayerName[] = [
  "trees",
  "fairway",
  "water",
  "bunker",
  "tee",
  "green"
] as const;

/** Convert a lat/lng to fractional pixel coordinates on the grid. */
export function latLngToPixel(
  grid: RasterGrid,
  lat: number,
  lng: number
): { x: number; y: number } {
  const { west, east, south, north } = grid.bounds;
  return {
    x: ((lng - west) / (east - west)) * grid.width,
    y: ((north - lat) / (north - south)) * grid.height
  };
}

/**
 * Scanline-fill a polygon into `target` with `value`, using the even-odd rule.
 * Cost is proportional to the polygon's area rather than the whole grid, which
 * matters because a course has many small polygons on a large raster.
 *
 * Tolerates closed rings (first point repeated), polygons extending outside the
 * grid, and degenerate polygons (fewer than 3 points are ignored).
 */
export function fillPolygon(
  target: Uint8Array,
  grid: RasterGrid,
  polygon: PolygonGeometry,
  value: number
): void {
  const pts = polygon?.points ?? [];
  if (pts.length < 3) {
    return;
  }

  const px = new Array<number>(pts.length);
  const py = new Array<number>(pts.length);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = latLngToPixel(grid, pts[i].lat, pts[i].lng);
    px[i] = p.x;
    py[i] = p.y;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const yStart = Math.max(0, Math.floor(minY));
  const yEnd = Math.min(grid.height - 1, Math.ceil(maxY));
  const xs: number[] = [];

  for (let y = yStart; y <= yEnd; y++) {
    const sy = y + 0.5; // sample at the pixel centre
    xs.length = 0;

    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const yi = py[i];
      const yj = py[j];
      // Half-open crossing test avoids double-counting shared vertices.
      if ((yi <= sy && yj > sy) || (yj <= sy && yi > sy)) {
        const t = (sy - yi) / (yj - yi);
        xs.push(px[i] + t * (px[j] - px[i]));
      }
    }
    if (xs.length < 2) {
      continue;
    }
    xs.sort((a, b) => a - b);

    for (let k = 0; k + 1 < xs.length; k += 2) {
      let x0 = Math.ceil(xs[k] - 0.5);
      let x1 = Math.floor(xs[k + 1] - 0.5);
      if (x1 < 0 || x0 > grid.width - 1) continue;
      if (x0 < 0) x0 = 0;
      if (x1 > grid.width - 1) x1 = grid.width - 1;
      const row = y * grid.width;
      for (let x = x0; x <= x1; x++) {
        target[row + x] = value;
      }
    }
  }
}

/** Collect the polygons contributing to each surface layer, across all holes. */
export function polygonsByLayer(geometry: CourseGeometry): Map<CourseSurfaceLayerName, PolygonGeometry[]> {
  const byLayer = new Map<CourseSurfaceLayerName, PolygonGeometry[]>();
  const push = (name: CourseSurfaceLayerName, polys: PolygonGeometry[] | undefined) => {
    if (!polys?.length) return;
    const existing = byLayer.get(name);
    if (existing) {
      existing.push(...polys);
    } else {
      byLayer.set(name, [...polys]);
    }
  };

  for (const hole of geometry.holes ?? []) {
    push("trees", hole.treeAreas);
    push("fairway", hole.fairways);
    push("water", hole.waterHazards);
    push("bunker", hole.bunkers);
    push("green", hole.greens);
    push(
      "tee",
      (hole.teeBoxes ?? [])
        .map((teeBox) => teeBox.polygon)
        .filter((polygon): polygon is PolygonGeometry => Boolean(polygon))
    );
  }

  return byLayer;
}

/**
 * Rasterise course geometry to a per-pixel layer assignment. Pixels not covered
 * by any polygon are UNASSIGNED, for the land-cover compositor to fill.
 */
export function rasteriseCourseGeometry(
  geometry: CourseGeometry,
  grid: RasterGrid,
  layerNames: readonly CourseSurfaceLayerName[] = SURFACE_LAYER_NAMES
): Uint8Array {
  if (grid.width < 1 || grid.height < 1) {
    throw new Error("rasteriseCourseGeometry: invalid grid dimensions");
  }

  const out = new Uint8Array(grid.width * grid.height).fill(UNASSIGNED);
  const byLayer = polygonsByLayer(geometry);

  for (const layerName of SURFACE_PAINT_ORDER) {
    const polygons = byLayer.get(layerName);
    if (!polygons?.length) continue;

    const index = layerNames.indexOf(layerName);
    if (index < 0) continue; // layer not in the active set — skip rather than throw

    for (const polygon of polygons) {
      fillPolygon(out, grid, polygon, index);
    }
  }

  return out;
}
