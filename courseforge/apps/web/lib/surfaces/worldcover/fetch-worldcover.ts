// Live ESA WorldCover tile fetch + decode to a class grid. The fetch is a thin,
// fetchImpl-injectable wrapper (same pattern as Copernicus fetch-glo30) so all
// tests stay offline. Tiles measured at 2.5–28 MB, so download-then-window-
// decode is acceptable, matching the GLO-30 path.

import { decodeGeotiffWindowToGrid } from "../../elevation/heightmap/decode-geotiff";
import type { ElevationGrid, LatLngBounds } from "../../elevation/heightmap/encode-heightmap";
import {
  WORLDCOVER_DEFAULT_RELEASE,
  worldCoverTileExtent,
  worldCoverTilesForBounds,
  worldCoverTileUrl,
  type WorldCoverRelease
} from "./worldcover-tiles";
import { intersectBounds } from "../../elevation/copernicus/mosaic-glo30";

export type FetchWorldCoverOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  endpoint?: string;
  release?: WorldCoverRelease;
};

/** Download one WorldCover COG tile as raw bytes. Throws on a non-ok response. */
export async function fetchWorldCoverTile(
  url: string,
  options: Pick<FetchWorldCoverOptions, "fetchImpl" | "signal"> = {}
): Promise<Uint8Array> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, { signal: options.signal });
  if (!response.ok) {
    throw new Error(`WorldCover tile fetch failed with status ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * A land-cover class sub-grid clipped to (part of) the course bounds. The
 * "elevation" values in the grid are raw WorldCover class codes (0..100) —
 * ElevationGrid is reused as a generic georeferenced numeric raster.
 */
export type WorldCoverClassGrid = ElevationGrid;

/**
 * Fetch and window-decode every WorldCover tile overlapping `bounds`, returning
 * one class sub-grid per tile (usually a single tile for a golf course; 3°
 * tiles make seams rare).
 */
export async function fetchWorldCoverClassGrids(
  bounds: LatLngBounds,
  options: FetchWorldCoverOptions = {}
): Promise<WorldCoverClassGrid[]> {
  const release = options.release ?? WORLDCOVER_DEFAULT_RELEASE;
  const tiles = worldCoverTilesForBounds(bounds);
  const grids: WorldCoverClassGrid[] = [];

  for (const tile of tiles) {
    const clip = intersectBounds(bounds, worldCoverTileExtent(tile));
    if (!clip) continue;
    const url = worldCoverTileUrl(tile.name, release, options.endpoint);
    const bytes = await fetchWorldCoverTile(url, { fetchImpl: options.fetchImpl, signal: options.signal });
    grids.push(await decodeGeotiffWindowToGrid(bytes, clip));
  }

  if (grids.length === 0) {
    throw new Error("fetchWorldCoverClassGrids: no tiles overlapped the course bounds");
  }
  return grids;
}
