// Compose the live Copernicus GLO-30 pipeline: resolve the covering tile, fetch
// it, window-decode to the course bounds, and encode a 16-bit heightmap.
// The only network step is fetchGlo30Tile (fetchImpl-injectable for tests).

import { decodeGeotiffWindowToGrid } from "../heightmap/decode-geotiff";
import {
  encodeHeightmap,
  type ElevationGrid,
  type EncodedHeightmap,
  type LatLngBounds
} from "../heightmap/encode-heightmap";
import { fetchGlo30Tile, type FetchGlo30Options } from "./fetch-glo30";
import { COPERNICUS_GLO30_ATTRIBUTION, glo30TileUrl, tileExtent, tilesForBounds } from "./glo30-tiles";
import { intersectBounds, mosaicDimsFromSubGrids, mosaicSubGrids } from "./mosaic-glo30";

export type GenerateGlo30Options = FetchGlo30Options & {
  /** Override the S3 endpoint (tests / mirrors). */
  endpoint?: string;
  /** Packaged artifact path for the heightmap descriptor. */
  artifactPath?: string;
  nodataPolicy?: "clampToMin" | "fillNearest";
  targetWidth?: number;
  targetHeight?: number;
};

/**
 * Fetch the GLO-30 tile covering `bounds` and produce a clipped 16-bit
 * heightmap. Throws if the bounds span multiple tiles (see tileForBounds).
 */
export async function generateGlo30Heightmap(
  bounds: LatLngBounds,
  options: GenerateGlo30Options = {}
): Promise<EncodedHeightmap> {
  const tiles = tilesForBounds(bounds);
  const fetchOpts = { fetchImpl: options.fetchImpl, signal: options.signal };

  let grid: ElevationGrid;
  if (tiles.length === 1) {
    // Single-tile fast path: window-decode straight to the course bounds.
    const bytes = await fetchGlo30Tile(glo30TileUrl(tiles[0].name, options.endpoint), fetchOpts);
    grid = await decodeGeotiffWindowToGrid(bytes, bounds);
  } else {
    // Multi-tile: window-decode each tile's intersection with the course bbox,
    // then stitch the sub-grids into one grid aligned to the full bounds.
    const subGrids: ElevationGrid[] = [];
    for (const tile of tiles) {
      const clip = intersectBounds(bounds, tileExtent(tile));
      if (!clip) continue;
      const bytes = await fetchGlo30Tile(glo30TileUrl(tile.name, options.endpoint), fetchOpts);
      subGrids.push(await decodeGeotiffWindowToGrid(bytes, clip));
    }
    if (subGrids.length === 0) {
      throw new Error("generateGlo30Heightmap: no tiles overlapped the course bounds");
    }
    const dims = mosaicDimsFromSubGrids(subGrids, bounds);
    grid = mosaicSubGrids(subGrids, bounds, dims.cols, dims.rows);
  }

  return encodeHeightmap(grid, {
    source: "copernicus_glo30",
    attribution: COPERNICUS_GLO30_ATTRIBUTION,
    artifactPath: options.artifactPath ?? "elevation/heightmap.png",
    nodataPolicy: options.nodataPolicy,
    targetWidth: options.targetWidth,
    targetHeight: options.targetHeight
  });
}
