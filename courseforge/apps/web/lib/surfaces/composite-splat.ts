// Composite surface classification (Phase 3 M3.4): OSM-derived polygons win,
// WorldCover fills the gaps, and anything still unresolved becomes rough.
//
// Precedence (strict, per the Phase 3 design note):
//   1. OSM course polygons  — authoritative; a 10 m raster never overwrites them
//   2. WorldCover classes   — everything no polygon covered
//   3. "rough" fallback     — WorldCover nodata / unmapped classes, so the
//                             final grid is always complete (no UNASSIGNED out)
//
// Pure: class grids are supplied by the caller (fetch lives behind the M3.3
// wrapper), so everything here is fixture-testable offline.

import type { CourseGeometry } from "../course-data/types";
import type { CourseSurfaceLayerName, CourseSplatMap, CourseHeightmapRaster } from "../../../../packages/course-schema/src";
import type { LatLngBounds } from "../elevation/heightmap/encode-heightmap";
import { sampleGridNearest } from "../elevation/copernicus/mosaic-glo30";
import { SURFACE_LAYER_NAMES, UNASSIGNED, encodeSplatMap, type EncodedSplatLayer } from "./encode-splat";
import { rasteriseCourseGeometry, type RasterGrid } from "./rasterise-geometry";
import { layerForWorldCoverClass } from "./worldcover/worldcover-tiles";
import type { WorldCoverClassGrid } from "./worldcover/fetch-worldcover";

/** Background surface for pixels neither polygons nor land cover resolve. */
export const FALLBACK_LAYER: CourseSurfaceLayerName = "rough";

/**
 * Fill UNASSIGNED pixels in a layer assignment from WorldCover class grids
 * (nearest-neighbour at the pixel centre; first grid containing the point
 * wins). Pixels still unresolved get the rough fallback. Returns a NEW array;
 * the input is not mutated. The result contains no UNASSIGNED values.
 */
export function compositeLayerIndex(
  layerIndex: Uint8Array,
  grid: RasterGrid,
  classGrids: WorldCoverClassGrid[],
  layerNames: readonly CourseSurfaceLayerName[] = SURFACE_LAYER_NAMES
): Uint8Array {
  if (layerIndex.length !== grid.width * grid.height) {
    throw new Error("compositeLayerIndex: layerIndex length does not match grid");
  }

  const fallbackIndex = layerNames.indexOf(FALLBACK_LAYER);
  if (fallbackIndex < 0) {
    throw new Error(`compositeLayerIndex: fallback layer "${FALLBACK_LAYER}" not in layer set`);
  }

  const out = layerIndex.slice();
  const { west, east, south, north } = grid.bounds;
  const spanX = east - west;
  const spanY = north - south;

  for (let r = 0; r < grid.height; r++) {
    const lat = north - ((r + 0.5) / grid.height) * spanY;
    for (let c = 0; c < grid.width; c++) {
      const i = r * grid.width + c;
      if (out[i] !== UNASSIGNED) continue; // OSM polygons win

      const lng = west + ((c + 0.5) / grid.width) * spanX;
      let resolved = fallbackIndex;
      for (const classGrid of classGrids) {
        const code = sampleGridNearest(classGrid, lat, lng);
        if (Number.isNaN(code)) continue; // outside this grid / nodata
        const layer = layerForWorldCoverClass(code);
        if (layer !== null) {
          const idx = layerNames.indexOf(layer);
          if (idx >= 0) {
            resolved = idx;
          }
        }
        break; // first grid containing the point decides (mapped or fallback)
      }
      out[i] = resolved;
    }
  }

  return out;
}

export type BuildSplatOptions = {
  bounds: LatLngBounds;
  width: number;
  height: number;
  localGrid?: CourseHeightmapRaster["localGrid"];
  sources: string[];
  attribution: string;
  artifactDir?: string;
};

export type BuiltSplat = {
  layers: EncodedSplatLayer[];
  splat: CourseSplatMap;
};

/**
 * Full offline splat build: rasterise OSM geometry, composite WorldCover
 * classes underneath, encode per-layer weightmaps. The caller supplies the
 * class grids (from fetchWorldCoverClassGrids or a fixture), keeping this pure.
 */
export function buildCompositeSplat(
  geometry: CourseGeometry,
  classGrids: WorldCoverClassGrid[],
  options: BuildSplatOptions
): BuiltSplat {
  const grid: RasterGrid = { width: options.width, height: options.height, bounds: options.bounds };
  const osmLayer = rasteriseCourseGeometry(geometry, grid);
  const complete = compositeLayerIndex(osmLayer, grid, classGrids);

  return encodeSplatMap({
    width: options.width,
    height: options.height,
    bounds: options.bounds,
    localGrid: options.localGrid,
    layerIndex: complete,
    sources: options.sources,
    attribution: options.attribution,
    artifactDir: options.artifactDir
  });
}
