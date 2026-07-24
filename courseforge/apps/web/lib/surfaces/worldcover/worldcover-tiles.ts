// ESA WorldCover 10 m land cover — tile addressing and class mapping (pure).
//
// Hosted keyless on AWS Open Data as COG GeoTIFFs, 3°x3° tiles named by their
// integer south-west corner. Key convention verified empirically against the
// bucket listing before first use:
//   v200/2021/map/ESA_WorldCover_10m_2021_v200_N54W003_Map.tif
//
// Licence: CC-BY 4.0 — attribution is mandatory wherever the data is surfaced
// or exported. See courseforge/docs/PHASE3_LANDCOVER_SPLAT_DESIGN.md.

import type { LatLngBounds } from "../../elevation/heightmap/encode-heightmap";

export const WORLDCOVER_BUCKET_URL = "https://esa-worldcover.s3.eu-central-1.amazonaws.com";

/** Tiles step in 3-degree increments. */
export const WORLDCOVER_TILE_DEGREES = 3;

/**
 * Dataset release. Pinned explicitly rather than resolving "latest", so a course
 * regenerated later reproduces identically; the resolved value is recorded in
 * the splat map's `sources`.
 */
export type WorldCoverRelease = {
  version: "v200" | "v100";
  year: "2021" | "2020";
};

export const WORLDCOVER_DEFAULT_RELEASE: WorldCoverRelease = { version: "v200", year: "2021" };

/** Provenance token for CourseSplatMap.sources, e.g. "esa_worldcover_v200". */
export function worldCoverSourceId(release: WorldCoverRelease = WORLDCOVER_DEFAULT_RELEASE): string {
  return `esa_worldcover_${release.version}`;
}

export type WorldCoverTile = {
  name: string;
  swLat: number;
  swLng: number;
};

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function snapDown(value: number): number {
  return Math.floor(value / WORLDCOVER_TILE_DEGREES) * WORLDCOVER_TILE_DEGREES;
}

/** Tile base name (e.g. `N54W003`) for the tile containing (lat, lng). */
export function worldCoverTileName(lat: number, lng: number): string {
  const swLat = snapDown(lat);
  const swLng = snapDown(lng);
  const ns = swLat >= 0 ? "N" : "S";
  const ew = swLng >= 0 ? "E" : "W";
  return `${ns}${pad(Math.abs(swLat), 2)}${ew}${pad(Math.abs(swLng), 3)}`;
}

/** S3 object key for a tile base name. */
export function worldCoverTileKey(
  name: string,
  release: WorldCoverRelease = WORLDCOVER_DEFAULT_RELEASE
): string {
  const { version, year } = release;
  return `${version}/${year}/map/ESA_WorldCover_10m_${year}_${version}_${name}_Map.tif`;
}

/** Full HTTPS URL for a tile. */
export function worldCoverTileUrl(
  name: string,
  release: WorldCoverRelease = WORLDCOVER_DEFAULT_RELEASE,
  endpoint: string = WORLDCOVER_BUCKET_URL
): string {
  return `${endpoint.replace(/\/$/, "")}/${worldCoverTileKey(name, release)}`;
}

/** The 3° extent of a tile given its integer SW corner. */
export function worldCoverTileExtent(tile: WorldCoverTile): LatLngBounds {
  return {
    south: tile.swLat,
    west: tile.swLng,
    north: tile.swLat + WORLDCOVER_TILE_DEGREES,
    east: tile.swLng + WORLDCOVER_TILE_DEGREES
  };
}

/** Every tile whose 3° cell overlaps `bounds`, row-major from the NW corner. */
export function worldCoverTilesForBounds(bounds: LatLngBounds): WorldCoverTile[] {
  const latMin = snapDown(bounds.south);
  const lngMin = snapDown(bounds.west);
  // An edge exactly on a tile boundary belongs to the lower tile.
  const latMax = snapDown(bounds.north === snapDown(bounds.north) ? bounds.north - 1e-9 : bounds.north);
  const lngMax = snapDown(bounds.east === snapDown(bounds.east) ? bounds.east - 1e-9 : bounds.east);

  const tiles: WorldCoverTile[] = [];
  for (let lat = latMax; lat >= latMin; lat -= WORLDCOVER_TILE_DEGREES) {
    for (let lng = lngMin; lng <= lngMax; lng += WORLDCOVER_TILE_DEGREES) {
      tiles.push({ name: worldCoverTileName(lat, lng), swLat: lat, swLng: lng });
    }
  }
  return tiles;
}

// --- Class mapping ---------------------------------------------------------

/** WorldCover class codes (verified against the product legend). */
export const WORLDCOVER_CLASSES = {
  NO_DATA: 0,
  TREE_COVER: 10,
  SHRUBLAND: 20,
  GRASSLAND: 30,
  CROPLAND: 40,
  BUILT_UP: 50,
  BARE_SPARSE: 60,
  SNOW_ICE: 70,
  PERMANENT_WATER: 80,
  HERBACEOUS_WETLAND: 90,
  MANGROVES: 95,
  MOSS_LICHEN: 100
} as const;

// Note: the class -> surface-layer mapping lives canonically in
// composite-surfaces.ts (WORLDCOVER_CLASS_TO_LAYER); this module only owns tile
// addressing and the raw legend codes, so there is a single mapping to maintain.
