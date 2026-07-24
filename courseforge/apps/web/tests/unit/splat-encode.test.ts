import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { SURFACE_LAYER_NAMES, UNASSIGNED, encodeSplatMap } from "../../lib/surfaces/encode-splat";

// Independent 8-bit grayscale PNG parser, to prove the weightmaps round-trip.
function decodePng8Gray(bytes: Uint8Array): { width: number; height: number; bitDepth: number; samples: Uint8Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let ihdr: { width: number; height: number; bitDepth: number } | null = null;
  const idat: Uint8Array[] = [];
  const typeAt = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);

  while (offset < bytes.length) {
    const len = view.getUint32(offset);
    const type = typeAt(offset + 4);
    const start = offset + 8;
    if (type === "IHDR") {
      ihdr = { width: view.getUint32(start), height: view.getUint32(start + 4), bitDepth: bytes[start + 8] };
    } else if (type === "IDAT") {
      idat.push(bytes.slice(start, start + len));
    }
    offset = start + len + 4;
    if (type === "IEND") break;
  }
  if (!ihdr) throw new Error("no IHDR");

  const raw = new Uint8Array(inflateSync(Buffer.concat(idat.map((p) => Buffer.from(p)))));
  const { width, height } = ihdr;
  const samples = new Uint8Array(width * height);
  const stride = 1 + width;
  for (let y = 0; y < height; y++) {
    expect(raw[y * stride]).toBe(0); // filter: none
    for (let x = 0; x < width; x++) {
      samples[y * width + x] = raw[y * stride + 1 + x];
    }
  }
  return { ...ihdr, samples };
}

const bounds = { south: 56.3, west: -2.85, north: 56.36, east: -2.78 };

const base = {
  width: 2,
  height: 2,
  bounds,
  sources: ["osm", "esa_worldcover_v200"],
  attribution: "OSM ODbL; ESA WorldCover CC-BY 4.0"
};

describe("SURFACE_LAYER_NAMES", () => {
  it("is the council-amended eight-layer set", () => {
    expect(SURFACE_LAYER_NAMES).toEqual([
      "fairway",
      "green",
      "tee",
      "bunker",
      "rough",
      "trees",
      "water",
      "bare"
    ]);
  });
});

describe("encodeSplatMap", () => {
  it("emits one hard-mask layer per covered surface", () => {
    // pixels: fairway(0), green(1), fairway(0), water(6)
    const { layers, splat } = encodeSplatMap({ ...base, layerIndex: [0, 1, 0, 6] });

    expect(layers.map((l) => l.name)).toEqual(["fairway", "green", "water"]);
    expect(splat.format).toBe("png-8");
    expect(splat.width).toBe(2);
    expect(splat.height).toBe(2);
    expect(splat.crs).toBe("EPSG:4326");
    expect(splat.bounds).toEqual(bounds);
    expect(splat.sources).toEqual(["osm", "esa_worldcover_v200"]);
    expect(splat.layers.map((l) => l.artifact.path)).toEqual([
      "surfaces/fairway.png",
      "surfaces/green.png",
      "surfaces/water.png"
    ]);
    for (const l of splat.layers) {
      expect(l.artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(l.artifact.byteLength).toBeGreaterThan(0);
    }
  });

  it("writes 255 where the layer owns the pixel and 0 elsewhere", () => {
    const { layers } = encodeSplatMap({ ...base, layerIndex: [0, 1, 0, 6] });
    const fairway = decodePng8Gray(layers[0].bytes);
    expect(fairway.bitDepth).toBe(8);
    expect(Array.from(fairway.samples)).toEqual([255, 0, 255, 0]);

    const green = decodePng8Gray(layers[1].bytes);
    expect(Array.from(green.samples)).toEqual([0, 255, 0, 0]);
  });

  it("weights sum to 255 per pixel across layers", () => {
    const { layers } = encodeSplatMap({ ...base, layerIndex: [0, 1, 0, 6] });
    const decoded = layers.map((l) => decodePng8Gray(l.bytes).samples);
    for (let p = 0; p < 4; p++) {
      const sum = decoded.reduce((n, s) => n + s[p], 0);
      expect(sum).toBe(255);
    }
  });

  it("skips empty layers by default and can include them", () => {
    const only = encodeSplatMap({ ...base, layerIndex: [0, 0, 0, 0] });
    expect(only.layers.map((l) => l.name)).toEqual(["fairway"]);

    const all = encodeSplatMap({ ...base, layerIndex: [0, 0, 0, 0], includeEmptyLayers: true });
    expect(all.layers).toHaveLength(SURFACE_LAYER_NAMES.length);
  });

  it("treats UNASSIGNED pixels as belonging to no layer", () => {
    const { layers } = encodeSplatMap({ ...base, layerIndex: [0, UNASSIGNED, UNASSIGNED, UNASSIGNED] });
    expect(layers.map((l) => l.name)).toEqual(["fairway"]);
    expect(Array.from(decodePng8Gray(layers[0].bytes).samples)).toEqual([255, 0, 0, 0]);
  });

  it("is deterministic", () => {
    const a = encodeSplatMap({ ...base, layerIndex: [0, 1, 0, 6] });
    const b = encodeSplatMap({ ...base, layerIndex: [0, 1, 0, 6] });
    expect(a.splat.layers.map((l) => l.artifact.sha256)).toEqual(b.splat.layers.map((l) => l.artifact.sha256));
  });

  it("rejects a mismatched layerIndex length and out-of-range indices", () => {
    expect(() => encodeSplatMap({ ...base, layerIndex: [0, 1, 0] })).toThrow(/does not match/i);
    expect(() => encodeSplatMap({ ...base, layerIndex: [0, 1, 0, 99] })).toThrow(/out of range/i);
  });

  it("carries the optional local metric grid through", () => {
    const localGrid = {
      originLat: 56.33,
      originLng: -2.815,
      widthMeters: 100,
      heightMeters: 200,
      metersPerPixelX: 50,
      metersPerPixelY: 100
    };
    const { splat } = encodeSplatMap({ ...base, layerIndex: [0, 1, 0, 6], localGrid });
    expect(splat.localGrid).toEqual(localGrid);
  });
});
