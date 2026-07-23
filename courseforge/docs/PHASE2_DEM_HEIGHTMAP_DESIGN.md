# Phase 2 — DEM Heightmaps (Design Proposal)

**Status:** SIGNED OFF 2026-07-22 — proceed as drafted with the additions in §4/§9. M2.1 in progress on `feature/dem-heightmap-provider`.
**Date:** 2026-07-22
**Roadmap phase:** 2 of 4 (see `AUTOMAT_PORT_HANDOFF.md` §3, root `AGENTS.md` port roadmap).
**Approved so far:** (a) Copernicus GLO‑30 as the first DEM source; (b) authoring this note.
**Still gated (this note does not grant):** CoursePackage schema change, new dependency, live DEM provider activation.

---

## 1. Objective

Replace low-resolution Google Elevation point samples with a real **16-bit heightmap raster** clipped to the course boundary, suitable for an Unreal Landscape, derived from open DEM data — per "a course is a query, not an asset". Engine-neutral: CourseForge emits a neutral heightmap descriptor + bytes; Unreal-side code translates.

## 2. Facts (from inspection)

- `CourseElevationModel` (`packages/course-schema/src/courseProject.ts:56`) is point-sample based: `boundarySamplePoints`, `holeProfiles[].samplePoints`. **No raster field.**
- `source` enum: `"mock" | "google_elevation" | "earth_engine" | "usgs" | "manual"` — no Copernicus value.
- `CoursePackage.elevation?: CourseElevationModel` is the single attach point (`courseProject.ts:106`).
- Providers today (`lib/elevation/`): `mock-elevation-provider`, `google-elevation-provider`, orchestrated by `elevation-service.ts`. All emit point samples.
- Course boundary (bbox / polygon) is available from Phase 1 geometry perimeter and `project.boundary`.

## 3. Chosen source — Copernicus GLO‑30

| | Copernicus GLO‑30 (chosen) |
|---|---|
| Coverage | Global |
| Resolution | 30 m (1 arc-second) |
| Access | AWS Open Data, **keyless** (anonymous S3 / HTTPS), COG GeoTIFF |
| Bucket | `copernicus-dem-30m` (1°×1° tiles, e.g. `Copernicus_DSM_COG_10_N56_00_W003_00_DEM/…_DEM.tif`) |
| License | Open; **attribution required** (© DLR/Airbus, provided under Copernicus by the EU/ESA) — exact string to be verified before first live use |

Deferred to a later milestone: **USGS 3DEP** (US-only, 10 m/1 m) for higher US resolution; add `usgs_3dep` source then. GLO‑30 first because it is global, keyless, and authoritative.

> ⚠️ Endpoint contract (exact S3 key naming, tile origin convention, COG layout, nodata value, vertical datum EGM2008) **must be verified against Copernicus/AWS docs before the first live call** — part of the live-provider gate, not assumed here.

## 4. Proposed schema extension (additive, engine-neutral)

Additive only — existing point-sample fields untouched, so all current packages stay valid.

```ts
// New raster descriptor. Bytes are a packaged artifact, NOT inline base64,
// to keep the JSON light.
export type CourseHeightmapRaster = {
  format: "png-16" | "raw-u16";   // 16-bit grayscale
  width: number;                  // pixels
  height: number;                 // pixels
  metersPerPixel: number;         // ground sample distance of the output grid
  // 16-bit value mapping: sampleValue 0 -> minElevationMeters,
  // 65535 -> maxElevationMeters. Gives Unreal the Landscape Z scale.
  minElevationMeters: number;
  maxElevationMeters: number;
  nodataPolicy: "clampToMin" | "fillNearest";
  crs: "EPSG:4326";               // grid defined over a lat/lng bbox
  bounds: { south: number; west: number; north: number; east: number };
  // Optional local metric grid for Unreal compatibility (signed off 2026-07-22).
  // Equirectangular ENU projection centred on the bbox: lets the importer place
  // the Landscape in metres without reprojecting lat/lng at import time.
  localGrid?: {
    originLat: number;            // projection origin (bbox centre)
    originLng: number;
    widthMeters: number;          // ground extent E-W
    heightMeters: number;         // ground extent N-S
    metersPerPixelX: number;
    metersPerPixelY: number;
  };
  artifact: {                     // reference into the CoursePackage payload
    path: string;                 // e.g. "elevation/heightmap.png"
    byteLength: number;
    sha256: string;
  };
  attribution: string;            // Copernicus attribution string
};

// CourseElevationModel gains ONE optional field + one source value:
//   source: … | "copernicus_glo30" | "usgs_3dep"   (additive)
//   heightmap?: CourseHeightmapRaster
```

`COURSE_PACKAGE_SCHEMA.md` and the Milestone 17 readiness gate would be updated to document (not require) the new optional field. Readiness stays computed, not persisted.

## 5. Pipeline — offline-pure vs live

Same discipline as Phase 1 (pure functions + fixtures first; thin live wrapper behind the gate).

| Stage | Nature | Testable offline? |
|---|---|---|
| 1. bbox → GLO‑30 tile keys | pure | ✅ inline fixture (bbox → expected key list) |
| 2. fetch COG tiles from S3 | **LIVE (gated)** | ❌ mocked `fetchImpl` |
| 3. decode GeoTIFF → raster grid | lib (`geotiff`) | ✅ tiny fixture GeoTIFF |
| 4. resample/clip onto target grid (bilinear) over boundary | pure | ✅ in-memory raster fixture |
| 5. normalize → 16-bit + encode PNG‑16 + build descriptor | pure | ✅ deterministic bytes + sha256 |

**Dependency decision (gated):** decoding COG/GeoTIFF needs a parser. Node has none. Proposed: **`geotiff`** (geotiff.js, MIT, widely used). Hand-rolling a COG decoder is materially worse, so this meets the "reach for a library only when the alternative is worse" bar — but adding it is a **separate approval item** (audit provenance/license/transitive deps first). PNG‑16 encoding can likely be done without a new dep (raw IDAT + zlib via Node `zlib`); to be confirmed during design.

## 6. Proposed milestone breakdown (each scored independently by the council)

- **M2.0 (this note):** design + sign-off. ← current
- **M2.1 (offline, needs schema-change approval):** add `CourseHeightmapRaster` + enum values to schema; pure tiling math + descriptor builder + PNG‑16 encoder, all fixture-tested. No live calls, no `geotiff` yet if PNG encode is dep-free. Gate: schema change.
- **M2.2 (needs dep approval):** add `geotiff`; GeoTIFF decode + bilinear resample against a tiny fixture tile. Gate: new dependency.
- **M2.3 (needs live-provider approval):** thin live S3 wrapper; live smoke against a real GLO‑30 tile for a known course; verify contract, attribution, rate/etiquette. Gate: live provider.
- Wire into `elevation-service.ts` as a new provider in the chain; Google point-sampling stays as legacy fallback (not deleted).

## 7. Verification (per milestone)

`npm run verify:fast` (lint, typecheck, vitest, build) for every offline milestone. Deterministic fixtures, seeded, no network in tests. Live smoke only at M2.3 behind the gate. Never claim unrun validation.

## 8. Rollback

Each milestone on its own `feature/*` branch, additive schema only → revert = drop branch/commit; existing point-sample path unaffected.

## 9. Sign-off decisions (2026-07-22)

1. **Schema shape** — approved as drafted in §4, **plus** optional `localGrid` metric metadata for Unreal compatibility.
2. **Output resolution** — **native GLO‑30 by default**, with **configurable Unreal-compatible output dimensions** (encoder accepts optional target `width`/`height`; native when unset).
3. **Dependency** — `geotiff` approved in principle, **subject to the provenance/license audit at M2.2**.
4. **Artifact packaging** — **separate packaged heightmap artifact** (not inline base64), referenced by `artifact.path` + `sha256` + `byteLength`.

---

*OSM data © OpenStreetMap contributors (ODbL). Copernicus DEM © DLR/Airbus, provided under Copernicus by the EU/ESA — exact attribution string to be verified before live use.*
