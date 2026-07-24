// Full splat generation (Phase 3 M3.4): course geometry + optional land cover
// -> encoded per-layer weightmap artifacts and a CourseSplatMap descriptor.
//
// This is the one entry point callers should need. It chains the three pure
// stages already built:
//
//   M3.2 rasteriseCourseGeometry  -> per-pixel OSM assignment, UNASSIGNED holes
//   M3.4 compositeSurfaceLayers   -> holes filled from land cover, no UNASSIGNED
//   M3.1 encodeSplatMap           -> one 8-bit PNG per layer + descriptor
//
// Pure and deterministic: same inputs produce identical bytes and sha256. The
// land-cover raster is passed in already decoded, so the still-gated live
// WorldCover fetch (M3.3) stays outside this module.

import type { CourseGeometry } from "../course-data/types";
import type { CourseSurfaceLayerName, CourseHeightmapRaster } from "../../../../packages/course-schema/src";
import { encodeSplatMap, SURFACE_LAYER_NAMES, type EncodedSplatMap } from "./encode-splat";
import { rasteriseCourseGeometry, type RasterGrid } from "./rasterise-geometry";
import { compositeSurfaceLayers, type ClassGrid, type CompositeSurfacesResult } from "./composite-surfaces";

/** OSM's required attribution — the geometry source is always present. */
export const OSM_ATTRIBUTION = "OSM data © OpenStreetMap contributors (ODbL)";

/** ESA WorldCover is CC-BY 4.0; attribution is a licence condition, not a courtesy. */
export const WORLDCOVER_ATTRIBUTION = "ESA WorldCover © ESA WorldCover project, CC-BY 4.0";

export type GenerateSplatOptions = {
  geometry: CourseGeometry;
  /** Must match the heightmap grid so Unreal can bind both to one Landscape. */
  grid: RasterGrid;
  /** Decoded land-cover raster. Omit and every uncovered pixel takes the fallback. */
  classGrid?: ClassGrid;
  /**
   * Land-cover source identifier recorded in `sources`, e.g.
   * `esa_worldcover_v200`. Required whenever `classGrid` is supplied: §10.2
   * requires the resolved version be recorded so a regenerated course is
   * reproducible, never an implicit "latest".
   */
  landCoverSource?: string;
  layerNames?: readonly CourseSurfaceLayerName[];
  fallbackLayer?: CourseSurfaceLayerName;
  localGrid?: CourseHeightmapRaster["localGrid"];
  artifactDir?: string;
  includeEmptyLayers?: boolean;
};

export type GeneratedSplatMap = EncodedSplatMap & {
  /** Pixel provenance counts — useful for readiness reporting and diagnostics. */
  coverage: Omit<CompositeSurfacesResult, "layerIndex">;
};

/**
 * Generate splat weightmaps for a course.
 *
 * Throws if `classGrid` is given without `landCoverSource`, because an
 * unversioned land-cover source makes the output irreproducible.
 */
export function generateCourseSplatMap(options: GenerateSplatOptions): GeneratedSplatMap {
  const {
    geometry,
    grid,
    classGrid,
    landCoverSource,
    fallbackLayer,
    localGrid,
    artifactDir,
    includeEmptyLayers
  } = options;
  const layerNames = options.layerNames ?? SURFACE_LAYER_NAMES;

  if (classGrid && !landCoverSource) {
    throw new Error(
      "generateCourseSplatMap: landCoverSource is required when classGrid is supplied, " +
        "so the resolved land-cover version is recorded in sources"
    );
  }

  const base = rasteriseCourseGeometry(geometry, grid, layerNames);

  const { layerIndex, ...coverage } = compositeSurfaceLayers({
    base,
    grid,
    classGrid,
    layerNames,
    fallbackLayer
  });

  const sources = ["osm"];
  const attributions = [OSM_ATTRIBUTION];
  if (classGrid && landCoverSource) {
    sources.push(landCoverSource);
    attributions.push(WORLDCOVER_ATTRIBUTION);
  }

  const encoded = encodeSplatMap({
    width: grid.width,
    height: grid.height,
    bounds: grid.bounds,
    localGrid,
    layerNames,
    layerIndex,
    sources,
    attribution: attributions.join("; "),
    artifactDir,
    includeEmptyLayers
  });

  return { ...encoded, coverage };
}
