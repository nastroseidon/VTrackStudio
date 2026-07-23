// Compose the live Copernicus GLO-30 pipeline: resolve the covering tile, fetch
// it, window-decode to the course bounds, and encode a 16-bit heightmap.
// The only network step is fetchGlo30Tile (fetchImpl-injectable for tests).

import { decodeGeotiffWindowToGrid } from "../heightmap/decode-geotiff";
import { encodeHeightmap, type EncodedHeightmap, type LatLngBounds } from "../heightmap/encode-heightmap";
import { fetchGlo30Tile, type FetchGlo30Options } from "./fetch-glo30";
import { COPERNICUS_GLO30_ATTRIBUTION, glo30TileUrl, tileForBounds } from "./glo30-tiles";

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
  const tile = tileForBounds(bounds);
  const url = glo30TileUrl(tile.name, options.endpoint);
  const bytes = await fetchGlo30Tile(url, { fetchImpl: options.fetchImpl, signal: options.signal });
  const grid = await decodeGeotiffWindowToGrid(bytes, bounds);

  return encodeHeightmap(grid, {
    source: "copernicus_glo30",
    attribution: COPERNICUS_GLO30_ATTRIBUTION,
    artifactPath: options.artifactPath ?? "elevation/heightmap.png",
    nodataPolicy: options.nodataPolicy,
    targetWidth: options.targetWidth,
    targetHeight: options.targetHeight
  });
}
