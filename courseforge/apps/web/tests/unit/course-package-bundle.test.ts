import { describe, expect, it } from "vitest";
import { buildCoursePackageBundle } from "../../lib/course-package/course-package-bundle";

// Minimal ZIP reader (store method only) to prove the archive round-trips.
function readZipEntries(zip: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // Locate end-of-central-directory (no comment, so it's the last 22 bytes).
  let eocd = zip.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("EOCD not found");
  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true); // central directory offset

  const entries = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) throw new Error("bad central record");
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = new TextDecoder().decode(zip.slice(ptr + 46, ptr + 46 + nameLen));

    // Read the local header to find the data start.
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("bad local header");
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const size = view.getUint32(localOffset + 22, true); // uncompressed (== stored)
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    entries.set(name, zip.slice(dataStart, dataStart + size));

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

describe("buildCoursePackageBundle", () => {
  const pkg = { packageVersion: "0.1.0", course: { name: "Test Links" } };
  const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]);

  it("packs the CoursePackage JSON and artifacts, round-tripping", () => {
    const zip = buildCoursePackageBundle(pkg, [{ path: "elevation/heightmap.png", bytes: png }]);
    const entries = readZipEntries(zip);

    expect([...entries.keys()].sort()).toEqual(["course-package.json", "elevation/heightmap.png"]);
    expect(Array.from(entries.get("elevation/heightmap.png")!)).toEqual(Array.from(png));

    const parsed = JSON.parse(new TextDecoder().decode(entries.get("course-package.json")!));
    expect(parsed).toEqual(pkg);
  });

  it("has a valid ZIP local-file signature", () => {
    const zip = buildCoursePackageBundle(pkg);
    expect(zip[0]).toBe(0x50); // 'P'
    expect(zip[1]).toBe(0x4b); // 'K'
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
  });

  it("is deterministic (identical bytes for identical input)", () => {
    const a = buildCoursePackageBundle(pkg, [{ path: "elevation/heightmap.png", bytes: png }]);
    const b = buildCoursePackageBundle(pkg, [{ path: "elevation/heightmap.png", bytes: png }]);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it("supports a custom package json path", () => {
    const zip = buildCoursePackageBundle(pkg, [], { packageJsonPath: "package.json" });
    expect([...readZipEntries(zip).keys()]).toContain("package.json");
  });

  it("rejects duplicate archive paths", () => {
    expect(() =>
      buildCoursePackageBundle(pkg, [
        { path: "a.bin", bytes: new Uint8Array([1]) },
        { path: "a.bin", bytes: new Uint8Array([2]) }
      ])
    ).toThrow(/duplicate/i);
  });
});
