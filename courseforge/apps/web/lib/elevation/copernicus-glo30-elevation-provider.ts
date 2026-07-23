// Copernicus GLO-30 elevation provider (server-only). Builds a CourseElevationModel
// carrying a real 16-bit heightmap raster clipped to the course boundary,
// replacing Google point samples for the raster path.
//
// OSM/Copernicus attribution is preserved on the heightmap descriptor. This
// module performs a live network fetch via generateGlo30Heightmap; the HTTP API
// route / UI hookup is a following milestone (M2.4).

import type { CourseBoundary, CourseElevationModel } from "../../../../packages/course-schema/src";
import type { EncodedHeightmap, LatLngBounds } from "./heightmap/encode-heightmap";
import { generateGlo30Heightmap, type GenerateGlo30Options } from "./copernicus/generate-glo30-heightmap";

export type CopernicusElevationProviderStatus = {
  id: "copernicus_glo30";
  name: string;
  enabled: boolean;
};

export function getCopernicusElevationProviderStatus(): CopernicusElevationProviderStatus {
  // Keyless open data — always available (subject to the live-provider gate,
  // already approved for this phase).
  return { id: "copernicus_glo30", name: "Copernicus GLO-30", enabled: true };
}

/** Axis-aligned bbox of a course boundary polygon. */
export function boundsFromBoundary(boundary: CourseBoundary): LatLngBounds {
  const ring = boundary.coordinates[0] ?? [];
  if (ring.length === 0) {
    throw new Error("boundsFromBoundary: boundary has no coordinates");
  }
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { west, east, south, north };
}

export type CopernicusElevationResult = {
  model: CourseElevationModel;
  heightmapBytes: Uint8Array;
};

export type GenerateCopernicusElevationOptions = GenerateGlo30Options & {
  /** Injectable timestamp for deterministic tests. */
  generatedAt?: string;
};

/**
 * Generate a CourseElevationModel from Copernicus GLO-30 for a confirmed course
 * boundary. Returns the model (with heightmap descriptor) plus the raw PNG bytes
 * for the caller to package as a separate artifact.
 */
export async function generateCopernicusElevationModel(
  boundary: CourseBoundary,
  options: GenerateCopernicusElevationOptions = {}
): Promise<CopernicusElevationResult> {
  const bounds = boundsFromBoundary(boundary);
  const encoded: EncodedHeightmap = await generateGlo30Heightmap(bounds, options);

  const model: CourseElevationModel = {
    source: "copernicus_glo30",
    status: "generated",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    boundarySamplePoints: [],
    holeProfiles: [],
    minElevationMeters: encoded.raster.minElevationMeters,
    maxElevationMeters: encoded.raster.maxElevationMeters,
    heightmap: encoded.raster,
    warnings: []
  };

  return { model, heightmapBytes: encoded.bytes };
}
