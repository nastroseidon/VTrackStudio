// Encode surface classification into per-layer 8-bit weightmaps (Phase 3 M3.1).
//
// Input is a per-pixel layer assignment (hard masks — see the Phase 3 design
// note): each pixel belongs to exactly one surface layer, so weights trivially
// sum to 255. Feathering is deliberately left to the engine's material, because
// baked soft edges are lossy and cannot be undone downstream.
//
// Pure and deterministic: same input, same bytes, same sha256.

import { createHash } from "node:crypto";
import { encodePngGray } from "../imaging/png";
import type {
  CourseSplatMap,
  CourseSurfaceLayer,
  CourseSurfaceLayerName,
  CourseHeightmapRaster
} from "../../../../packages/course-schema/src";
import type { LatLngBounds } from "../elevation/heightmap/encode-heightmap";

/** Default engine-neutral surface layers (council-amended to eight). */
export const SURFACE_LAYER_NAMES: readonly CourseSurfaceLayerName[] = [
  "fairway",
  "green",
  "tee",
  "bunker",
  "rough",
  "trees",
  "water",
  "bare"
] as const;

/** Sentinel for "no layer assigned" in a layerIndex grid. */
export const UNASSIGNED = 255;

export type EncodeSplatOptions = {
  width: number;
  height: number;
  bounds: LatLngBounds;
  localGrid?: CourseHeightmapRaster["localGrid"];
  /** Layer name per index used by `layerIndex`. Defaults to SURFACE_LAYER_NAMES. */
  layerNames?: readonly CourseSurfaceLayerName[];
  /** Row-major per-pixel index into `layerNames`; UNASSIGNED (255) for none. */
  layerIndex: ArrayLike<number>;
  sources: string[];
  attribution: string;
  /** Directory prefix for layer artifacts inside the package. */
  artifactDir?: string;
  /** Emit layers with no coverage too (default false — skips empty artifacts). */
  includeEmptyLayers?: boolean;
};

export type EncodedSplatLayer = {
  name: CourseSurfaceLayerName;
  bytes: Uint8Array;
  path: string;
};

export type EncodedSplatMap = {
  layers: EncodedSplatLayer[];
  splat: CourseSplatMap;
};

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Build one 8-bit weightmap PNG per surface layer from a per-pixel assignment.
 * Layers with no covered pixels are skipped unless `includeEmptyLayers`.
 */
export function encodeSplatMap(options: EncodeSplatOptions): EncodedSplatMap {
  const {
    width,
    height,
    bounds,
    localGrid,
    layerIndex,
    sources,
    attribution,
    artifactDir = "surfaces",
    includeEmptyLayers = false
  } = options;
  const layerNames = options.layerNames ?? SURFACE_LAYER_NAMES;

  if (width < 1 || height < 1) {
    throw new Error("encodeSplatMap: invalid dimensions");
  }
  if (layerIndex.length !== width * height) {
    throw new Error("encodeSplatMap: layerIndex length does not match dimensions");
  }

  const pixelCount = width * height;
  const counts = new Array<number>(layerNames.length).fill(0);
  for (let i = 0; i < pixelCount; i++) {
    const idx = layerIndex[i];
    if (idx === UNASSIGNED) continue;
    if (idx < 0 || idx >= layerNames.length) {
      throw new Error(`encodeSplatMap: layer index ${idx} out of range`);
    }
    counts[idx]++;
  }

  const layers: EncodedSplatLayer[] = [];
  const descriptors: CourseSurfaceLayer[] = [];

  for (let li = 0; li < layerNames.length; li++) {
    if (counts[li] === 0 && !includeEmptyLayers) {
      continue;
    }
    const mask = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      mask[i] = layerIndex[i] === li ? 255 : 0;
    }
    const bytes = encodePngGray(width, height, mask, 8);
    const name = layerNames[li];
    const path = `${artifactDir}/${name}.png`;

    layers.push({ name, bytes, path });
    descriptors.push({
      name,
      artifact: { path, byteLength: bytes.byteLength, sha256: sha256Hex(bytes) }
    });
  }

  const splat: CourseSplatMap = {
    format: "png-8",
    width,
    height,
    crs: "EPSG:4326",
    bounds,
    localGrid,
    layers: descriptors,
    sources,
    attribution
  };

  return { layers, splat };
}
