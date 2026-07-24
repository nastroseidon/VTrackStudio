# Phase 3 — Land Cover & Splat Weightmaps (Design Proposal)

**Status:** SIGNED OFF 2026-07-23, with the four council amendments in §10. M3.1 in progress. **WorldCover live gate remains CLOSED** until M3.3.
**Date:** 2026-07-23
**Roadmap phase:** 3 of 4. Follows Phase 1 (OSM geometry, merged) and Phase 2 (GLO‑30 heightmaps, merged).
**Approved so far:** reorder Phase 3 to lead with **ESA WorldCover** instead of USDA CDL.
**Still gated (this note does not grant):** WorldCover live-provider activation, CoursePackage schema change.

---

## 1. Objective

Give each course a **surface classification raster** ("splat weightmaps") so the terrain renders with correct materials — fairway, green, bunker, rough, trees, water — instead of a single flat material. Engine-neutral: CourseForge emits weightmap artifacts + a descriptor; Unreal maps them to Landscape material layers.

## 2. Source decision — ESA WorldCover (primary)

USDA CDL was the original roadmap pick (it is what Automat uses) but it is **US-only**, which would make land cover the single non-global layer in an otherwise worldwide pipeline (OSM global, GLO‑30 global). Reordered per sign-off.

| | ESA WorldCover (primary) | USDA CDL (later, US refinement) |
|---|---|---|
| Coverage | **Global** | US only |
| Resolution | **10 m** | 30 m |
| Bucket | `esa-worldcover` (eu-central-1), anonymous `--no-sign-request` ✔ | CropScape API |
| Versions | v100 (2020), v200 (2021) | annual |
| License | **CC-BY 4.0** — attribution required (DOI v200 `10.5281/zenodo.7254221`, v100 `10.5281/zenodo.5571936`) | public domain |

> ⚠️ **To verify at the live gate** (not assumed here): exact object key / tile filename convention and tile size. Docs point to the STAC endpoint `https://services.terrascope.be/stac/` and `esa-worldcover.org/en/data-access`. I will confirm with a HEAD request before any data pull, exactly as was done for GLO‑30.

### WorldCover class codes (confirmed)

| Code | Class | | Code | Class |
|---|---|---|---|---|
| 0 | No data | | 60 | Bare / sparse vegetation |
| 10 | Tree cover | | 70 | Snow and ice |
| 20 | Shrubland | | 80 | Permanent water bodies |
| 30 | Grassland | | 90 | Herbaceous wetland |
| 40 | Cropland | | 95 | Mangroves |
| 50 | Built-up | | 100 | Moss and lichen |

## 3. Key architectural point — OSM wins inside the course

WorldCover describes the *landscape*; it does not know a fairway from rough. Phase 1 already gives authoritative playing-surface polygons from OSM. So the weightmap is a **composite**, with a strict precedence:

1. **OSM course polygons** (green, tee, bunker, fairway) — authoritative inside the course.
2. **OSM natural features** (wood, water, scrub) — for in-bounds hazards.
3. **WorldCover raster** — everything else / outside the course boundary.

This keeps playing surfaces crisp (vector-derived) while the surrounding terrain gets real classification. Never let a 10 m raster overwrite a traced green.

## 4. Proposed surface layers (engine-neutral)

Rasterised to the **same grid as the heightmap** (same bounds, dimensions, `localGrid`), so Unreal can bind them to the Landscape directly.

**Eight layers** (council-amended from ten):

`fairway · green · tee · bunker · rough · trees · water · bare`

- `scrub` merged into `rough` — no gameplay distinction.
- `built` **dropped** — clubhouses, paths and structures arrive as *meshes* in Phase 4 (M4.6); a `built` splat layer would duplicate that and the two could disagree.
- Rationale: beyond ~8 layers Unreal Landscape commonly spills into extra material passes/samplers. The schema still accepts N layers; this is just the default set.

Each layer is an **8-bit grayscale PNG** (0–255 weight), one artifact per layer — matching how Unreal Landscape consumes per-layer weightmaps. Weights sum to 255 per pixel.

**Hard masks only.** Feathering is a *rendering* concern: Unreal's Landscape material can soften a hard mask at render time. Baked soft edges are lossy and irreversible; a hard mask keeps full information and can always be feathered downstream. Emit hard, soften in-engine (Phase 4).

## 5. Proposed schema extension (additive)

```ts
export type CourseSurfaceLayerName =
  | "fairway" | "green" | "tee" | "bunker" | "rough" | "trees" | "water" | "bare";

export type CourseSurfaceLayer = {
  name: CourseSurfaceLayerName;
  artifact: { path: string; byteLength: number; sha256: string };
};

export type CourseSplatMap = {
  format: "png-8";
  width: number;              // matches the heightmap grid
  height: number;
  bounds: { south: number; west: number; north: number; east: number };
  localGrid?: CourseHeightmapRaster["localGrid"];
  layers: CourseSurfaceLayer[];
  sources: string[];          // e.g. ["osm", "esa_worldcover_v200"]
  attribution: string;        // OSM ODbL + ESA WorldCover CC-BY
};

// CourseElevationModel is untouched. CoursePackage gains:
//   surfaces?: CourseSplatMap
```

Additive only — existing packages stay valid. The Phase 2 ZIP bundle already carries arbitrary artifacts, so no export-format change is needed.

## 6. Pipeline — offline-pure vs live

| Stage | Nature | Offline-testable? |
|---|---|---|
| 1. bbox → WorldCover tile keys | pure | ✅ |
| 2. fetch tiles | **LIVE (gated)** | ❌ mocked `fetchImpl` |
| 3. decode GeoTIFF → class grid | reuses Phase 2 `geotiff` decoder | ✅ |
| 4. rasterise OSM polygons onto the grid | pure | ✅ |
| 5. composite (OSM over WorldCover) + weight normalisation | pure | ✅ |
| 6. encode 8-bit PNG layers + descriptor | pure | ✅ |

Same discipline as Phase 2: pure first, thin live wrapper behind the gate, `fetchImpl` injection everywhere.

## 7. Milestones

- **M3.0 (this note)** — design + sign-off.
- **M3.1 (offline, `SCHEMA` gate)** — `CourseSplatMap` schema + 8-bit PNG layer encoder + weight normalisation, fixture-tested. Reuses the Phase 2 encoder patterns.
- **M3.2 (offline)** — polygon rasteriser: OSM hole geometry → per-layer coverage on the heightmap grid.
- **M3.3 (`LIVE` gate)** — WorldCover tile addressing + fetch + decode; verify key convention, licensing, attribution; live smoke.
- **M3.4 (offline)** — compositor (OSM over WorldCover) + full splat generation.
- **M3.5 (`BROWSER` gate)** — API + UI wiring; include layers in the bundle export.
- **M3.6** — canopy/trees: tree-cover class + Meta/WRI canopy → foliage instances (own `LIVE` gate + schema).
- **M3.7** — merge to `main`.
- Later: USDA CDL as a US-only refinement; NAIP imagery; Microsoft buildings.

## 8. Verification

`npm run verify:fast` per offline milestone; `npm run verify` (browser) for M3.5. Deterministic fixtures, no network in tests. Live smoke only at M3.3 behind the gate.

## 9. Rollback

Each milestone its own `feature/*` branch; schema additive; splat is optional so absent `surfaces` leaves existing behaviour untouched.

## 10. Sign-off decisions (2026-07-23) — council amendments applied

1. **Layer list** — **8 layers** (§4). `scrub` merged into `rough`; `built` dropped (meshes own structures in M4.6). Schema keeps the layer set extensible.
2. **WorldCover version** — **v200 (2021) default, as a parameter not a constant**. The resolved version is recorded in `sources` (e.g. `esa_worldcover_v200`) so a regenerated course is reproducible; never implicit "latest".
3. **Blending** — **hard masks in the package**; feathering is an engine-side material concern (Phase 4). Hard is lossless and reversible; baked soft edges are not.
4. **Live-provider gate** — **still CLOSED**. Deliberately deferred to M3.3 so the first live call runs against already-tested decode/composite code. At the gate, HEAD-verify the tile key convention and `Accept-Ranges` before any data pull (the equivalent check caught the real URL shape for GLO‑30).

**Council Recommendation Confidence for Phase 3 as amended: 88/100.**

---

*Attribution to preserve on export: OSM data © OpenStreetMap contributors (ODbL); Copernicus DEM © DLR/Airbus–EU/ESA; ESA WorldCover © ESA WorldCover project, CC-BY 4.0.*
