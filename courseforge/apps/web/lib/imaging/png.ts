// Minimal deterministic grayscale PNG encoder shared by the terrain artifacts:
// 16-bit heightmaps (Phase 2) and 8-bit surface weightmaps (Phase 3).
//
// Hand-rolled rather than pulling a PNG dependency: the format is small and
// well specified, and writing it ourselves keeps the output byte-stable so
// artifact sha256 hashes are reproducible.

import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Wrap a payload in a PNG chunk (length + type + data + CRC). */
export function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) typeBytes[i] = type.charCodeAt(i);
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);

  const out = new Uint8Array(4 + body.length + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(4 + body.length, crc32(body));
  return out;
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Encode a single-channel grayscale PNG at 8 or 16 bits per sample.
 * `samples` is row-major, length width*height. 16-bit samples are written
 * big-endian per the PNG spec. Filter type 0 (none) on every scanline.
 */
export function encodePngGray(
  width: number,
  height: number,
  samples: ArrayLike<number>,
  bitDepth: 8 | 16
): Uint8Array {
  if (samples.length !== width * height) {
    throw new Error("encodePngGray: sample count does not match dimensions");
  }

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = bitDepth;
  ihdr[9] = 0; // colour type: grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const bytesPerSample = bitDepth === 16 ? 2 : 1;
  const raw = new Uint8Array(height * (1 + width * bytesPerSample));
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const s = samples[y * width + x];
      if (bitDepth === 16) {
        raw[p++] = (s >>> 8) & 0xff;
        raw[p++] = s & 0xff;
      } else {
        raw[p++] = s & 0xff;
      }
    }
  }
  const idat = deflateSync(raw, { level: 9 });

  const parts = [
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", new Uint8Array(idat.buffer, idat.byteOffset, idat.byteLength)),
    pngChunk("IEND", new Uint8Array(0))
  ];
  const total = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
