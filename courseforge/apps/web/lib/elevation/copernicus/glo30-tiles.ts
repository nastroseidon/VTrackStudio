// Copernicus GLO-30 tile addressing (pure). Tiles are 1°x1°, named by their
// integer south-west corner, hosted keyless on AWS Open Data as COG GeoTIFFs.
// See courseforge/docs/PHASE2_DEM_HEIGHTMAP_DESIGN.md.

import type { LatLngBounds } from "../heightmap/encode-heightmap";

export const GLO30_BUCKET_URL = "https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com";

// Copernicus DEM licence requires attribution wherever the data is surfaced or
// exported. Exact wording per the ESA/Copernicus DEM licence.
export const COPERNICUS_GLO30_ATTRIBUTION =
  "Copernicus DEM — produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and " +
  "© Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European " +
  "Union and ESA; all rights reserved.";

export type Glo30Tile = {
  name: string;
  swLat: number;
  swLng: number;
};

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/** GLO-30 tile folder/file base name for the tile containing (lat, lng). */
export function glo30TileName(lat: number, lng: number): string {
  const swLat = Math.floor(lat);
  const swLng = Math.floor(lng);
  const ns = swLat >= 0 ? "N" : "S";
  const ew = swLng >= 0 ? "E" : "W";
  return `Copernicus_DSM_COG_10_${ns}${pad(Math.abs(swLat), 2)}_00_${ew}${pad(Math.abs(swLng), 3)}_00_DEM`;
}

/** S3 object key for a tile base name (`<name>/<name>.tif`). */
export function glo30TileKey(name: string): string {
  return `${name}/${name}.tif`;
}

/** Full HTTPS URL for a tile. */
export function glo30TileUrl(name: string, endpoint: string = GLO30_BUCKET_URL): string {
  return `${endpoint.replace(/\/$/, "")}/${glo30TileKey(name)}`;
}

/**
 * The single GLO-30 tile covering `bounds`. Throws if the bbox spans more than
 * one integer-degree tile — multi-tile mosaicking is a later milestone, and an
 * honest error beats a silently truncated course.
 */
export function tileForBounds(bounds: LatLngBounds): Glo30Tile {
  const swLat = Math.floor(bounds.south);
  const swLng = Math.floor(bounds.west);
  if (Math.floor(bounds.north) !== swLat || Math.floor(bounds.east) !== swLng) {
    throw new Error(
      "tileForBounds: course bounds span more than one GLO-30 tile; multi-tile mosaicking is not yet supported"
    );
  }
  return { name: glo30TileName(bounds.south, bounds.west), swLat, swLng };
}
