// Decode a (Cloud-Optimized) GeoTIFF DEM tile into an ElevationGrid, and the
// convenience composition decode -> encode. Server-only (uses geotiff.js).
//
// This module does NOT fetch tiles — the bytes are supplied by the caller. Live
// Copernicus GLO-30 S3 fetching is M2.3, behind the live-provider gate. Kept
// here so it can be unit-tested against an in-memory GeoTIFF fixture.

import { fromArrayBuffer } from "geotiff";
import {
  encodeHeightmap,
  type ElevationGrid,
  type EncodeHeightmapOptions,
  type EncodedHeightmap,
  type LatLngBounds
} from "./encode-heightmap";

export type DecodeGeotiffOptions = {
  /** Override georeferencing; otherwise read from the GeoTIFF bounding box. */
  boundsOverride?: LatLngBounds;
  /** Band index to read as elevation (default 0). */
  band?: number;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Decode elevation samples + georeferencing from a GeoTIFF DEM tile. */
export async function decodeGeotiffToGrid(
  bytes: Uint8Array,
  options: DecodeGeotiffOptions = {}
): Promise<ElevationGrid> {
  const tiff = await fromArrayBuffer(toArrayBuffer(bytes));
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();

  const band = options.band ?? 0;
  const rasters = await image.readRasters();
  const raster = rasters[band] as ArrayLike<number> | number | undefined;
  if (raster === undefined || typeof raster === "number") {
    throw new Error(`decodeGeotiffToGrid: band ${band} is not a raster`);
  }
  if (raster.length !== width * height) {
    throw new Error("decodeGeotiffToGrid: raster length does not match dimensions");
  }

  let bounds: LatLngBounds;
  if (options.boundsOverride) {
    bounds = options.boundsOverride;
  } else {
    const [minX, minY, maxX, maxY] = image.getBoundingBox();
    bounds = { west: minX, south: minY, east: maxX, north: maxY };
  }

  const nodataRaw = image.getGDALNoData();
  const nodata = nodataRaw === null || nodataRaw === undefined ? undefined : Number(nodataRaw);

  return {
    cols: width,
    rows: height,
    data: Float64Array.from(raster, Number),
    bounds,
    nodata
  };
}

/** Decode a GeoTIFF DEM tile and encode it straight to a 16-bit heightmap. */
export async function buildHeightmapFromGeotiff(
  bytes: Uint8Array,
  encodeOptions: EncodeHeightmapOptions,
  decodeOptions: DecodeGeotiffOptions = {}
): Promise<EncodedHeightmap> {
  const grid = await decodeGeotiffToGrid(bytes, decodeOptions);
  return encodeHeightmap(grid, encodeOptions);
}
