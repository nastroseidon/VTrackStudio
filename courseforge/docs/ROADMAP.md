# CourseForge Roadmap

The authoritative record of what shipped is the commit body on each merged PR, plus the per-phase design notes (`PHASE2_DEM_HEIGHTMAP_DESIGN.md`, `PHASE3_LANDCOVER_SPLAT_DESIGN.md`). This file summarises them; where it disagrees with a commit body, the commit body wins.

## Verified state — 2026-07-24

Reconciled against `git log origin/main` and the GitHub PR list on 2026-07-24, at `origin/main` = `4caccd8`. Where the Phase 3 section below disagrees with this block, **this block wins** until the corrections land.

- **M3.3 has shipped.** The ESA WorldCover live provider merged in **#21 → `4caccd8`**; the LIVE gate was approved and is closed out. The "Next: M3.3 … still closed" line below is stale.
- **M3.5 is not merged.** It exists as **open PR #23** (`feature/surfaces-api-ui`, head `b77862e`). It is mergeable and passes `verify:fast`, but adds **no new tests** (118 on the branch, 118 on `main`). Treat M3.5 as in review, not landed.
- **M3.6 is canopy/trees**, per `PHASE3_LANDCOVER_SPLAT_DESIGN.md` §7 — a tree-cover class plus canopy data to foliage instances, with its own LIVE gate and a schema addition. It is **not** a documentation-only "finalise Phase 3" milestone; any handoff saying otherwise is wrong.
- **Milestone-to-PR map, read from `git log`:** M1.x → #6 (`3dae504`) · M2.1–M2.5b → #7 (`7356a10`) · M2.6 → #9 (`0cf1bfa`) · M3.1 → #10 (`337e32a`) · M3.2 → #13 (`40ab2d3`) · M3.4 → #19 (`778dc24`) · M3.3 → #21 (`4caccd8`).
- **The prose corrections to the Phase 3 section below are already written** in open PR #22 (`feature/m3.3-followup`); they are deliberately not duplicated here to avoid a merge conflict. Merge order and per-PR risk for all seven open PRs are in `handoffs/PHASE3_MERGE_PLAN.md`.
- **The repository has no CI.** Nothing automatically validates any open PR; PR #16 would add it.

## Current phase: Phase 3 — Land Cover & Splat Weightmaps

Phase 3 gives each course a surface classification raster ("splat weightmaps") so terrain renders with correct materials — fairway, green, bunker, rough, trees, water — instead of one flat material. CourseForge emits weightmap artifacts plus a descriptor; Unreal maps them to Landscape material layers. Primary source is **ESA WorldCover**, chosen over USDA CDL because CDL is US-only and every other layer in the pipeline is global. Design and sign-off (2026-07-23) are in `PHASE3_LANDCOVER_SPLAT_DESIGN.md`.

**Landed:** M3.0 design + sign-off. M3.1 — additive `CourseSplatMap` / `CourseSurfaceLayer` schema plus `CoursePackage.surfaces?`, and an 8-bit hard-mask weightmap encoder over eight surface layers; PNG writer extracted to `lib/imaging/png.ts` (#10). M3.2 — polygon rasteriser: even-odd scanline fill, lat/lng-to-pixel mapping, cross-hole aggregation, and precedence painting, leaving uncovered pixels UNASSIGNED (#13). M3.4 — land-cover compositor and full splat generation: `compositeSurfaceLayers` fills UNASSIGNED pixels from a decoded class raster (OSM always wins; WorldCover class→layer mapping defined in `lib/surfaces/composite-surfaces.ts`), and `generateCourseSplatMap` chains rasterise → composite → encode with versioned-source attribution enforcement. M3.4 was built ahead of M3.3 because it is offline and fixture-testable; the live fetch plugs in at the `ClassGrid` seam.

M3.3 — the live keyless ESA WorldCover provider — landed in #21 after the live-provider gate was explicitly approved (2026-07-24). The 3° tile key convention was verified against the bucket before first use, the pinned release is recorded in `sources` (never an implicit "latest"), fetching is `fetchImpl`-injectable so the routine suite stays offline, and multi-tile courses stitch through the M2.6 mosaic. A repeatable gated live smoke exists at `tests/integration/worldcover-live-smoke.test.ts` (`WORLDCOVER_LIVE=1`); it is skipped by default. Note for M3.5: tile sizes vary widely (a few MB ocean-heavy up to 87.6 MB for N36W123), and the bucket supports range requests — COG range reads are the natural optimisation before interactive API use.

**Next: M3.5 — API + UI wiring and bundle export (BROWSER gate).** Wire WorldCover-backed splat generation into the API routes and UI, and include weightmap layers in the course bundle export. Requires `npm run verify` including Playwright.

**Remaining Phase 3 milestones:** M3.6 canopy/trees, tree-cover class and canopy data to foliage instances (own LIVE gate + schema change) · M3.7 merge to `main`. Later refinements: USDA CDL for the US, NAIP imagery, Microsoft buildings.

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

Live providers **active**: Overpass/OSM (Phase 1), Copernicus GLO-30 (Phase 2, keyless), and ESA WorldCover (Phase 3 M3.3, keyless, gate approved 2026-07-24, #21). Canopy data remains **gated** until M3.6. Attribution obligations in force: OSM data © OpenStreetMap contributors (ODbL); Copernicus DEM © DLR/Airbus, provided under Copernicus by the EU/ESA; ESA WorldCover © ESA WorldCover project, CC-BY 4.0 (v200 DOI `10.5281/zenodo.7254221`).

## Maintaining this document

Update this roadmap in the same change that lands a milestone. A roadmap that names a completed milestone as current is worse than no roadmap, because it silently misdirects the next session — and with several sessions landing work in parallel, a roadmap maintained in its own trailing PR will always be behind.

Never infer a milestone's status from a code search alone. Read the phase design note and the commit bodies. This file previously claimed Phase 2 M2.3 was unstarted and blocked on live-provider approval, when the live provider had already shipped in #7 — the error came from a narrow grep that missed an injectable `fetchImpl` call, contradicting a commit body that said so in plain text.
