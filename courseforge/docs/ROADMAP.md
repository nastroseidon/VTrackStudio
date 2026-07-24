# CourseForge Roadmap

The authoritative record of what shipped is the commit body on each merged PR, plus the per-phase design notes (`PHASE2_DEM_HEIGHTMAP_DESIGN.md`, `PHASE3_LANDCOVER_SPLAT_DESIGN.md`). This file summarises them; where it disagrees with a commit body, the commit body wins.

## Current phase: Phase 3 — Land Cover & Splat Weightmaps

Phase 3 gives each course a surface classification raster ("splat weightmaps") so terrain renders with correct materials — fairway, green, bunker, rough, trees, water — instead of one flat material. CourseForge emits weightmap artifacts plus a descriptor; Unreal maps them to Landscape material layers. Primary source is **ESA WorldCover**, chosen over USDA CDL because CDL is US-only and every other layer in the pipeline is global. Design and sign-off (2026-07-23) are in `PHASE3_LANDCOVER_SPLAT_DESIGN.md`.

**Landed:** M3.0 design + sign-off. M3.1 — additive `CourseSplatMap` / `CourseSurfaceLayer` schema plus `CoursePackage.surfaces?`, and an 8-bit hard-mask weightmap encoder over eight surface layers. The PNG writer was extracted to `lib/imaging/png.ts` (shared 8/16-bit) with `encodePng16Gray` kept as a wrapper so the Phase 2 API is unchanged (#10).

**Next: M3.2 — polygon rasteriser (offline, no gate).** Rasterise OSM hole geometry into per-layer coverage on the heightmap grid.

**Remaining Phase 3 milestones:** M3.3 WorldCover tile addressing, fetch, and decode (**LIVE gate — still closed**; verify key convention, licensing, attribution, live smoke) · M3.4 compositor, OSM over WorldCover, full splat generation · M3.5 API + UI wiring and bundle export (BROWSER gate) · M3.6 canopy/trees, tree-cover class and canopy data to foliage instances (own LIVE gate + schema change) · M3.7 merge to `main`. Later refinements: USDA CDL for the US, NAIP imagery, Microsoft buildings.

## Completed: Phase 2 — GLO-30 DEM Heightmaps

Complete through M2.6 and merged. M2.1–M2.5b landed together in #7: the additive heightmap schema, 16-bit PNG encoder, `geotiff` decode, the **live keyless Copernicus GLO-30 provider**, API and UI wiring, and deterministic ZIP course-bundle export. M2.6 added multi-tile mosaicking for courses straddling an integer lat/lng line, along with a tile-seam fix where `sampleGridNearest` returned NaN on a sub-grid's exact east/south edge (#9).

Heightmaps are packaged as separate artifacts referenced by path, `sha256`, and `byteLength` rather than inlined. Native GLO-30 resolution is the default, with configurable Unreal-compatible output dimensions. The `geotiff` dependency gate is closed by the provenance and license audit in `PHASE2_DEM_HEIGHTMAP_DESIGN.md` §10 — all licenses permissive, no copyleft, with an Apache-2.0 NOTICE obligation to honour if binaries are redistributed.

## Completed: Phase 1 — Provider-backed course geometry

Derives course geometry from OpenStreetMap via the Overpass API, replacing manual tracing as the primary geometry path, including a User-Agent/406 fix. Verified with a live smoke test (#6).

## Completed milestone: 17 — Course Package Readiness Gate

Milestone 17 adds a deterministic readiness gate for the neutral preview JSON export. Readiness is calculated dynamically from existing project state and is not persisted or added to the CoursePackage schema.

Preview export requires confirmed course identity, location, and boundary; a complete saved and approved trace for every expected hole; and current generated preview geometry for every expected hole. An existing stale elevation model also blocks export. Missing elevation and unconfirmed scorecard data remain non-blocking warnings.

The readiness UI separates blocking actions from warnings, reports expected-hole, complete-trace, approved-trace, and current-geometry coverage, and clearly identifies the artifact as preview JSON rather than simulator-ready output. Reopening, editing, or clearing a trace revokes readiness until the trace is saved, approved, and its preview geometry regenerated.

### Milestone 17 explicit exclusions

Milestone 17 does not persist readiness, change the CoursePackage schema or version, add source reports or multi-file packaging, generate heightmaps, masks, final terrain, or simulator-ready assets, activate live or paid providers, add cloud persistence, change Unreal code, or deploy production infrastructure.

## Completed milestone: 16 — Hole Trace Review

Milestone 16 adds a focused review workflow for saved manual hole traces. Reviewers can enter review mode, move among saved traces, jump to the next trace needing review, approve a trace, or reopen an approved trace for editing. Review state uses the existing `trace saved`, `approved`, and `needs review` hole statuses and persists through local autosave and project-file export/import.

### Milestone 16 explicit exclusions

Milestone 16 does not activate live or paid providers, add Earth Engine or USGS terrain generation, run scorecard AI, create final simulator terrain, add cloud accounts or persistence, redesign the CoursePackage schema, implement the Unreal importer, or deploy production infrastructure.

## Live provider status

Live providers are **already active** in this project: Overpass/OSM (Phase 1) and Copernicus GLO-30 (Phase 2, keyless). ESA WorldCover remains **gated and not activated** until M3.3, as does canopy data at M3.6. Attribution obligations currently in force: OSM data © OpenStreetMap contributors (ODbL); Copernicus DEM © DLR/Airbus, provided under Copernicus by the EU/ESA.

## Maintaining this document

Update this roadmap in the same change that lands a milestone. A roadmap that names a completed milestone as current is worse than no roadmap, because it silently misdirects the next session — and with several sessions landing work in parallel, a roadmap maintained in its own trailing PR will always be behind.

Never infer a milestone's status from a code search alone. Read the phase design note and the commit bodies. This file previously claimed Phase 2 M2.3 was unstarted and blocked on live-provider approval, when the live provider had already shipped in #7 — the error came from a narrow grep that missed an injectable `fetchImpl` call, contradicting a commit body that said so in plain text.
