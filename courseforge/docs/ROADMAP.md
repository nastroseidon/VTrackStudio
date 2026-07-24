# CourseForge Roadmap

## Current milestone: Phase 2 M2.3 — Live GLO-30 Elevation Provider (gated, not started)

M2.3 is the next Phase 2 DEM milestone. It adds a thin live wrapper over the Copernicus GLO-30 S3 endpoint, a live smoke test against a real tile for a known course, and verification of the endpoint contract, attribution string, and request etiquette. Design and acceptance criteria are in `PHASE2_DEM_HEIGHTMAP_DESIGN.md` §6.

**M2.3 is blocked on live-provider approval.** Activating a live external provider requires a separate product, licensing, cost, and architecture decision, and the exact Copernicus attribution string must be verified before live use. No M2.3 implementation work should begin before that approval.

Today the tiling code builds GLO-30 tile URLs (`lib/elevation/copernicus/glo30-tiles.ts`) but nothing fetches them. The elevation path remains offline and fixture-driven, with Google point sampling retained as the legacy fallback.

## Completed: Phase 2 M2.2 — GeoTIFF Decode

Adds the `geotiff` dependency, GeoTIFF decode, and bilinear resampling against fixture tiles. The dependency gate from the Phase 2 sign-off is closed: the provenance and license audit is recorded in `PHASE2_DEM_HEIGHTMAP_DESIGN.md` §10. Landed with M2.1.

## Completed: Phase 2 M2.1 — Heightmap Schema, Tiling, and Encoder

Adds the additive `CourseHeightmapRaster` schema extension, tiling math, the heightmap descriptor builder, and the PNG-16 encoder, with course bundle export. Heightmaps are packaged as separate artifacts referenced by path, `sha256`, and `byteLength` rather than inlined. All offline and fixture-tested.

## Completed: Provider-backed course geometry

Derives course geometry from OpenStreetMap via the Overpass API, feeding the existing Phase 1 geometry perimeter and course boundary. OSM data © OpenStreetMap contributors (ODbL).

## Completed milestone: 17 — Course Package Readiness Gate

Milestone 17 adds a deterministic readiness gate for the current neutral preview JSON export. Readiness is calculated dynamically from existing project state and is not persisted or added to the CoursePackage schema.

Preview export requires confirmed course identity, location, and boundary; a complete saved and approved trace for every expected hole; and current generated preview geometry for every expected hole. An existing stale elevation model also blocks export. Missing elevation and unconfirmed scorecard data remain non-blocking warnings.

The readiness UI separates blocking actions from warnings, reports expected-hole, complete-trace, approved-trace, and current-geometry coverage, and clearly identifies the artifact as preview JSON rather than simulator-ready output. Reopening, editing, or clearing a trace revokes readiness until the trace is saved, approved, and its preview geometry regenerated.

### Milestone 17 explicit exclusions

Milestone 17 does not persist readiness, change the CoursePackage schema or version, add source reports or multi-file packaging, generate heightmaps, masks, final terrain, or simulator-ready assets, activate live or paid providers, add cloud persistence, change Unreal code, or deploy production infrastructure.

## Completed milestone: 16 — Hole Trace Review

Milestone 16 adds a focused review workflow for saved manual hole traces. Reviewers can enter review mode, move among saved traces, jump to the next trace needing review, approve a trace, or reopen an approved trace for editing. Review state uses the existing `trace saved`, `approved`, and `needs review` hole statuses and persists through local autosave and project-file export/import.

This milestone preserves the existing tracing, geometry-preview, elevation, map, and neutral CoursePackage behavior.

### Milestone 16 explicit exclusions

Milestone 16 does not activate live or paid providers, add Earth Engine or USGS terrain generation, run scorecard AI, create final simulator terrain, add cloud accounts or persistence, redesign the CoursePackage schema, implement the Unreal importer, or deploy production infrastructure.

## Future direction

After M2.3, later milestones may improve provider-backed search and geometry inputs, terrain and topology generation, final neutral CoursePackage contents, and Unreal-side import. Each live provider or cross-system integration requires a separate product, licensing, cost, and architecture decision.

## Maintaining this document

Update this roadmap in the same change that lands a milestone. A roadmap that names a completed milestone as current is worse than no roadmap, because it silently misdirects the next session.
