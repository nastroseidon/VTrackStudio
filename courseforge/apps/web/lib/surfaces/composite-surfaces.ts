// Composite OSM-derived playing surfaces over a land-cover class raster
// (Phase 3 M3.4). Input is the UNASSIGNED-holed grid from M3.2's rasteriser;
// output is a complete per-pixel layer assignment with no UNASSIGNED left, so
// the encoder's "weights sum to 255 per pixel" invariant holds.
//
// Precedence is fixed by the Phase 3 design note §3: OSM polygons are
// authoritative inside the course and are never overwritten by land cover. A
// 10 m classification must not overwrite a traced green, so this only ever
// fills holes — it does not blend or arbitrate.
//
// Pure and deterministic: no network, no clock, no randomness. The live
// WorldCover fetch is M3.3 and is still gated; this module takes an already
// decoded class grid so it is fully testable offline.

import type { CourseSurfaceLayerName } from "../../../../packages/course-schema/src";
import type { LatLngBounds } from "../elevation/heightmap/encode-heightmap";
import { SURFACE_LAYER_NAMES, UNASSIGNED } from "./encode-splat";
import type { RasterGrid } from "./rasterise-geometry";

/** A decoded land-cover raster: row-major class codes on a lat/lng bbox. */
export type ClassGrid = {
  width: number;
  height: number;
  bounds: LatLngBounds;
  /** Row-major class codes, `width * height` long. */
  classes: ArrayLike<number>;
};

/** WorldCover's own "no data" code. */
export const WORLDCOVER_NODATA = 0;

/**
 * ESA WorldCover v200 class code -> engine-neutral surface layer.
 *
 * The design note (§2) confirms the class codes but does not fix this mapping,
 * so it is defined here and deliberately kept explicit rather than clever.
 * Two entries follow council amendments in §10.1 rather than the raw semantics:
 * shrubland collapses into `rough` (scrub was merged), and built-up becomes
 * `bare` because the `built` layer was dropped — structures arrive as meshes in
 * Phase 4 M4.6, and a `built` splat layer could disagree with them.
 */
export const WORLDCOVER_CLASS_TO_LAYER: Readonly<Record<number, CourseSurfaceLayerName>> = {
  10: "trees", // tree cover
  20: "rough", // shrubland — scrub merged into rough (§10.1)
  30: "rough", // grassland
  40: "rough", // cropland
  50: "bare", // built-up — `built` layer dropped (§10.1); meshes own structures in M4.6
  60: "bare", // bare / sparse vegetation
  70: "bare", // snow and ice
  80: "water", // permanent water bodies
  90: "water", // herbaceous wetland
  95: "trees", // mangroves
  100: "rough" // moss and lichen
};

export type CompositeSurfacesOptions = {
  /** Per-pixel layer assignment from M3.2, with UNASSIGNED holes. */
  base: ArrayLike<number>;
  /** Target grid — must match the heightmap grid (§4). */
  grid: RasterGrid;
  /** Decoded land-cover raster. Omit to fill every hole with `fallbackLayer`. */
  classGrid?: ClassGrid;
  /** Layer name per index. Defaults to SURFACE_LAYER_NAMES. */
  layerNames?: readonly CourseSurfaceLayerName[];
  /**
   * Layer for pixels with no OSM polygon and no usable class: outside the
   * class raster, nodata, or an unrecognised code. Defaults to `rough`, the
   * safest playable surface — never leave a hole, or the weights stop summing.
   */
  fallbackLayer?: CourseSurfaceLayerName;
  /** Override or extend the class mapping (e.g. a future v100 table). */
  classToLayer?: Readonly<Record<number, CourseSurfaceLayerName>>;
};

export type CompositeSurfacesResult = {
  /** Complete assignment, guaranteed free of UNASSIGNED. */
  layerIndex: Uint8Array;
  /** Pixels taken from OSM polygons. */
  osmPixels: number;
  /** Pixels taken from the class raster. */
  landCoverPixels: number;
  /** Pixels that fell back — no polygon and no usable class. */
  fallbackPixels: number;
};

/**
 * Nearest-neighbour sample of a class grid at a lat/lng.
 *
 * Returns `undefined` outside the grid rather than a sentinel, so an
 * out-of-bounds sample can't be confused with a real class code. Nearest
 * neighbour is correct here specifically because class codes are categorical —
 * interpolating between "water" and "trees" is meaningless.
 */
export function sampleClassNearest(grid: ClassGrid, lat: number, lng: number): number | undefined {
  const { west, east, south, north } = grid.bounds;
  if (lng < west || lng > east || lat < south || lat > north) {
    return undefined;
  }
  // Clamp guards the inclusive east/south edge, where the raw index would be
  // exactly `width`/`height` and read off the end of the row or the array.
  const col = Math.min(grid.width - 1, Math.max(0, Math.floor(((lng - west) / (east - west)) * grid.width)));
  const row = Math.min(grid.height - 1, Math.max(0, Math.floor(((north - lat) / (north - south)) * grid.height)));
  return grid.classes[row * grid.width + col];
}

/**
 * Fill the UNASSIGNED holes in an OSM assignment from land cover.
 *
 * OSM pixels pass through untouched — this never overwrites a traced surface.
 */
export function compositeSurfaceLayers(options: CompositeSurfacesOptions): CompositeSurfacesResult {
  const {
    base,
    grid,
    classGrid,
    fallbackLayer = "rough",
    classToLayer = WORLDCOVER_CLASS_TO_LAYER
  } = options;
  const layerNames = options.layerNames ?? SURFACE_LAYER_NAMES;

  if (grid.width < 1 || grid.height < 1) {
    throw new Error("compositeSurfaceLayers: invalid grid dimensions");
  }
  const pixelCount = grid.width * grid.height;
  if (base.length !== pixelCount) {
    throw new Error("compositeSurfaceLayers: base length does not match grid dimensions");
  }
  if (classGrid && classGrid.classes.length !== classGrid.width * classGrid.height) {
    throw new Error("compositeSurfaceLayers: classGrid length does not match its dimensions");
  }

  const fallbackIndex = layerNames.indexOf(fallbackLayer);
  if (fallbackIndex < 0) {
    throw new Error(`compositeSurfaceLayers: fallback layer "${fallbackLayer}" is not in layerNames`);
  }

  // Resolve class code -> layer index once, so the per-pixel loop is a lookup.
  const classToIndex = new Map<number, number>();
  for (const [code, layerName] of Object.entries(classToLayer)) {
    const index = layerNames.indexOf(layerName);
    if (index >= 0) {
      classToIndex.set(Number(code), index);
    }
  }

  const { west, east, south, north } = grid.bounds;
  const lngSpan = east - west;
  const latSpan = north - south;

  const out = new Uint8Array(pixelCount);
  let osmPixels = 0;
  let landCoverPixels = 0;
  let fallbackPixels = 0;

  for (let y = 0; y < grid.height; y++) {
    // Sample at the pixel centre, matching latLngToPixel's convention.
    const lat = north - ((y + 0.5) / grid.height) * latSpan;
    const rowOffset = y * grid.width;

    for (let x = 0; x < grid.width; x++) {
      const i = rowOffset + x;
      const baseValue = base[i];

      if (baseValue !== UNASSIGNED) {
        if (baseValue < 0 || baseValue >= layerNames.length) {
          throw new Error(`compositeSurfaceLayers: base layer index ${baseValue} out of range`);
        }
        out[i] = baseValue;
        osmPixels++;
        continue;
      }

      let resolved: number | undefined;
      if (classGrid) {
        const lng = west + ((x + 0.5) / grid.width) * lngSpan;
        const code = sampleClassNearest(classGrid, lat, lng);
        if (code !== undefined && code !== WORLDCOVER_NODATA) {
          resolved = classToIndex.get(code);
        }
      }

      if (resolved === undefined) {
        out[i] = fallbackIndex;
        fallbackPixels++;
      } else {
        out[i] = resolved;
        landCoverPixels++;
      }
    }
  }

  return { layerIndex: out, osmPixels, landCoverPixels, fallbackPixels };
}
