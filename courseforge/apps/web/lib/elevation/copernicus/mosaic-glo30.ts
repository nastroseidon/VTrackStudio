// Pure multi-tile mosaic helpers for GLO-30 (Phase 2 M2.6). A course bbox that
// straddles an integer lat/lng line overlaps >1 GLO-30 tile; these stitch the
// per-tile clipped sub-grids into one grid aligned to the course bounds.
// Network/decoding lives in generate-glo30-heightmap.ts; this stays testable.

import type { ElevationGrid, LatLngBounds } from "../heightmap/encode-heightmap";

/** Intersection of two bboxes, or null if they do not overlap. */
export function intersectBounds(a: LatLngBounds, b: LatLngBounds): LatLngBounds | null {
  const west = Math.max(a.west, b.west);
  const east = Math.min(a.east, b.east);
  const south = Math.max(a.south, b.south);
  const north = Math.min(a.north, b.north);
  if (east <= west || north <= south) {
    return null;
  }
  return { west, east, south, north };
}

function isNodata(value: number, nodata?: number): boolean {
  return Number.isNaN(value) || (nodata !== undefined && value === nodata);
}

/**
 * Nearest-neighbour sample from a grid at (lat, lng); NaN if outside/nodata.
 *
 * Membership is decided geographically (inclusive of the far edges) and only
 * then converted to an index, so a point sitting exactly on the east/south edge
 * clamps into the last column/row instead of falling off the grid — otherwise
 * pixels landing on a tile seam would come back as nodata.
 */
export function sampleGridNearest(grid: ElevationGrid, lat: number, lng: number): number {
  const { west, east, south, north } = grid.bounds;
  if (lng < west || lng > east || lat < south || lat > north) {
    return Number.NaN;
  }
  const degPerColX = (east - west) / grid.cols;
  const degPerRowY = (north - south) / grid.rows;
  const col = Math.min(grid.cols - 1, Math.max(0, Math.floor((lng - west) / degPerColX)));
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor((north - lat) / degPerRowY)));
  const v = grid.data[row * grid.cols + col];
  return isNodata(v, grid.nodata) ? Number.NaN : v;
}

/**
 * Default output dimensions for a mosaic: the finest (smallest degrees-per-pixel)
 * resolution among the sub-grids, applied across the full bounds.
 */
export function mosaicDimsFromSubGrids(
  subGrids: ElevationGrid[],
  bounds: LatLngBounds
): { cols: number; rows: number } {
  let minDegX = Infinity;
  let minDegY = Infinity;
  for (const g of subGrids) {
    minDegX = Math.min(minDegX, (g.bounds.east - g.bounds.west) / g.cols);
    minDegY = Math.min(minDegY, (g.bounds.north - g.bounds.south) / g.rows);
  }
  if (!Number.isFinite(minDegX) || !Number.isFinite(minDegY)) {
    throw new Error("mosaicDimsFromSubGrids: no sub-grids");
  }
  return {
    cols: Math.max(1, Math.round((bounds.east - bounds.west) / minDegX)),
    rows: Math.max(1, Math.round((bounds.north - bounds.south) / minDegY))
  };
}

/**
 * Stitch clipped per-tile sub-grids into one grid over `bounds` at the given
 * dimensions. Each output pixel samples the first sub-grid that contains its
 * centre; gaps become nodata (NaN).
 */
export function mosaicSubGrids(
  subGrids: ElevationGrid[],
  bounds: LatLngBounds,
  targetCols: number,
  targetRows: number
): ElevationGrid {
  if (targetCols < 1 || targetRows < 1) {
    throw new Error("mosaicSubGrids: target dimensions must be >= 1");
  }
  const out = new Float64Array(targetCols * targetRows);
  const spanX = bounds.east - bounds.west;
  const spanY = bounds.north - bounds.south;

  for (let r = 0; r < targetRows; r++) {
    const lat = bounds.north - ((r + 0.5) / targetRows) * spanY;
    for (let c = 0; c < targetCols; c++) {
      const lng = bounds.west + ((c + 0.5) / targetCols) * spanX;
      let value = Number.NaN;
      for (const sub of subGrids) {
        if (lat <= sub.bounds.north && lat >= sub.bounds.south && lng >= sub.bounds.west && lng <= sub.bounds.east) {
          const s = sampleGridNearest(sub, lat, lng);
          if (!Number.isNaN(s)) {
            value = s;
            break;
          }
        }
      }
      out[r * targetCols + c] = value;
    }
  }

  return { cols: targetCols, rows: targetRows, data: out, bounds, nodata: undefined };
}
