// Live ESA WorldCover tile fetch + decode into the compositor's ClassGrid
// (Phase 3 M3.3). The fetch is a thin, fetchImpl-injectable wrapper (same
// pattern as Copernicus fetch-glo30) so all tests stay offline.
//
// Tile sizes vary far more than GLO-30: ocean-heavy tiles compress to a few
// MB, but dense-land tiles are large — N36W123 (California coast) is 87.6 MB
// by HEAD. Download-then-window-decode is correct-but-heavy for those; the
// bucket serves Accept-Ranges: bytes, so COG range reads via geotiff `fromUrl`
// (pulling only the course window, ~100s of KB) are the natural optimisation
// when M3.5 wires this into an interactive API route.

import { decodeGeotiffWindowToGrid } from "../../elevation/heightmap/decode-geotiff";
import type { ElevationGrid, LatLngBounds } from "../../elevation/heightmap/encode-heightmap";
import { intersectBounds, mosaicDimsFromSubGrids, mosaicSubGrids } from "../../elevation/copernicus/mosaic-glo30";
import { WORLDCOVER_NODATA, type ClassGrid } from "../composite-surfaces";
import {
  WORLDCOVER_DEFAULT_RELEASE,
  worldCoverTileExtent,
  worldCoverTilesForBounds,
  worldCoverTileUrl,
  type WorldCoverRelease
} from "./worldcover-tiles";

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

/** Convert a decoded numeric raster into the compositor's ClassGrid shape. */
export function toClassGrid(grid: ElevationGrid): ClassGrid {
  const classes = new Uint8Array(grid.cols * grid.rows);
  for (let i = 0; i < classes.length; i++) {
    const v = grid.data[i];
    // NaN (mosaic gap / decode nodata) becomes WorldCover's own nodata code so
    // the compositor's fallback path handles it.
    classes[i] = Number.isNaN(v) ? WORLDCOVER_NODATA : v;
  }
  return { width: grid.cols, height: grid.rows, bounds: grid.bounds, classes };
}

/**
 * Fetch every WorldCover tile overlapping `bounds`, window-decode each to its
 * intersection, and return ONE ClassGrid over the course bounds — multi-tile
 * courses (rare with 3° tiles) are stitched with the M2.6 mosaic, whose
 * nearest-neighbour sampling is exactly right for categorical data.
 */
export async function fetchWorldCoverClassGrid(
  bounds: LatLngBounds,
  options: FetchWorldCoverOptions = {}
): Promise<ClassGrid> {
  const release = options.release ?? WORLDCOVER_DEFAULT_RELEASE;
  const tiles = worldCoverTilesForBounds(bounds);
  const subGrids: ElevationGrid[] = [];

  for (const tile of tiles) {
    const clip = intersectBounds(bounds, worldCoverTileExtent(tile));
    if (!clip) continue;
    const url = worldCoverTileUrl(tile.name, release, options.endpoint);
    const bytes = await fetchWorldCoverTile(url, { fetchImpl: options.fetchImpl, signal: options.signal });
    subGrids.push(await decodeGeotiffWindowToGrid(bytes, clip));
  }

  if (subGrids.length === 0) {
    throw new Error("fetchWorldCoverClassGrid: no tiles overlapped the course bounds");
  }
  if (subGrids.length === 1) {
    return toClassGrid(subGrids[0]);
  }
  const dims = mosaicDimsFromSubGrids(subGrids, bounds);
  return toClassGrid(mosaicSubGrids(subGrids, bounds, dims.cols, dims.rows));
}
