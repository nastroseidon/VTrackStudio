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
 * one integer-degree tile. Prefer `tilesForBounds` for the general case; this
 * remains for single-tile callers that want an explicit guard.
 */
export function tileForBounds(bounds: LatLngBounds): Glo30Tile {
  const swLat = Math.floor(bounds.south);
  const swLng = Math.floor(bounds.west);
  if (Math.floor(bounds.north) !== swLat || Math.floor(bounds.east) !== swLng) {
    throw new Error(
      "tileForBounds: course bounds span more than one GLO-30 tile; use tilesForBounds for mosaicking"
    );
  }
  return { name: glo30TileName(bounds.south, bounds.west), swLat, swLng };
}

/** The 1° geographic extent of a tile given its integer SW corner. */
export function tileExtent(tile: Glo30Tile): LatLngBounds {
  return { south: tile.swLat, west: tile.swLng, north: tile.swLat + 1, east: tile.swLng + 1 };
}

/**
 * Every GLO-30 tile whose 1° cell overlaps `bounds`, row-major from the NW
 * corner. A course straddling an integer lat/lng line yields >1 tile.
 */
export function tilesForBounds(bounds: LatLngBounds): Glo30Tile[] {
  const swLatMin = Math.floor(bounds.south);
  const swLngMin = Math.floor(bounds.west);
  // A bbox edge exactly on an integer belongs to the lower tile, so use the
  // floor of a value nudged off the boundary for the max side.
  const swLatMax = Math.floor(bounds.north === Math.floor(bounds.north) ? bounds.north - 1e-9 : bounds.north);
  const swLngMax = Math.floor(bounds.east === Math.floor(bounds.east) ? bounds.east - 1e-9 : bounds.east);

  const tiles: Glo30Tile[] = [];
  for (let lat = swLatMax; lat >= swLatMin; lat--) {
    for (let lng = swLngMin; lng <= swLngMax; lng++) {
      tiles.push({ name: glo30TileName(lat, lng), swLat: lat, swLng: lng });
    }
  }
  return tiles;
}
