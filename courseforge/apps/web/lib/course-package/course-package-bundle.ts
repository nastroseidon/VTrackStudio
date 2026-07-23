// Deterministic CoursePackage bundle (ZIP) builder. Packs the neutral
// CoursePackage JSON together with binary artifacts (heightmap PNG, and later
// weightmaps / imagery) at the paths their descriptors reference.
//
// Store method (no compression) — artifacts like PNG are already compressed, and
// "store" keeps the output byte-stable for deterministic tests. No new
// dependency: the ZIP structure is written by hand. Fixed timestamps so the same
// inputs always produce identical bytes.

export type BundleArtifact = {
  /** POSIX path inside the archive, e.g. "elevation/heightmap.png". */
  path: string;
  bytes: Uint8Array;
};

export type BuildBundleOptions = {
  /** Filename for the serialized CoursePackage JSON. */
  packageJsonPath?: string;
};

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

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Fixed DOS date/time (1980-01-01 00:00) for reproducible archives.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

type PreparedEntry = {
  name: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
};

/**
 * Build a deterministic ZIP archive from a CoursePackage object plus artifacts.
 * The CoursePackage is serialized to pretty JSON at `packageJsonPath`
 * (default "course-package.json").
 */
export function buildCoursePackageBundle(
  coursePackage: unknown,
  artifacts: BundleArtifact[] = [],
  options: BuildBundleOptions = {}
): Uint8Array {
  const packageJsonPath = options.packageJsonPath ?? "course-package.json";
  const entriesInput: BundleArtifact[] = [
    { path: packageJsonPath, bytes: utf8(`${JSON.stringify(coursePackage, null, 2)}\n`) },
    ...artifacts
  ];

  const seen = new Set<string>();
  for (const e of entriesInput) {
    if (seen.has(e.path)) {
      throw new Error(`buildCoursePackageBundle: duplicate archive path "${e.path}"`);
    }
    seen.add(e.path);
  }

  const localChunks: Uint8Array[] = [];
  const prepared: PreparedEntry[] = [];
  let offset = 0;

  for (const entry of entriesInput) {
    const name = utf8(entry.path);
    const data = entry.bytes;
    const crc = crc32(data);

    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // local file header signature
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0, true); // flags
    view.setUint16(8, 0, true); // method: store
    view.setUint16(10, DOS_TIME, true);
    view.setUint16(12, DOS_DATE, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true); // compressed size
    view.setUint32(22, data.length, true); // uncompressed size
    view.setUint16(26, name.length, true);
    view.setUint16(28, 0, true); // extra length
    header.set(name, 30);

    prepared.push({ name, data, crc, offset });
    localChunks.push(header, data);
    offset += header.length + data.length;
  }

  const centralChunks: Uint8Array[] = [];
  let centralSize = 0;
  for (const entry of prepared) {
    const record = new Uint8Array(46 + entry.name.length);
    const view = new DataView(record.buffer);
    view.setUint32(0, 0x02014b50, true); // central directory signature
    view.setUint16(4, 20, true); // version made by
    view.setUint16(6, 20, true); // version needed
    view.setUint16(8, 0, true); // flags
    view.setUint16(10, 0, true); // method
    view.setUint16(12, DOS_TIME, true);
    view.setUint16(14, DOS_DATE, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.data.length, true);
    view.setUint32(24, entry.data.length, true);
    view.setUint16(28, entry.name.length, true);
    view.setUint16(30, 0, true); // extra length
    view.setUint16(32, 0, true); // comment length
    view.setUint16(34, 0, true); // disk number start
    view.setUint16(36, 0, true); // internal attributes
    view.setUint32(38, 0, true); // external attributes
    view.setUint32(42, entry.offset, true); // local header offset
    record.set(entry.name, 46);

    centralChunks.push(record);
    centralSize += record.length;
  }

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // end of central directory signature
  eocdView.setUint16(8, prepared.length, true); // entries on this disk
  eocdView.setUint16(10, prepared.length, true); // total entries
  eocdView.setUint32(12, centralSize, true); // central directory size
  eocdView.setUint32(16, offset, true); // central directory offset
  eocdView.setUint16(20, 0, true); // comment length

  const all = [...localChunks, ...centralChunks, eocd];
  const total = all.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const chunk of all) {
    out.set(chunk, p);
    p += chunk.length;
  }
  return out;
}
