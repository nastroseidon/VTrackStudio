# CourseForge Roadmap

## Current milestone: 17 — Course Package Readiness Gate

Milestone 17 adds a deterministic readiness gate for the current neutral preview JSON export. Readiness is calculated dynamically from existing project state and is not persisted or added to the CoursePackage schema.

Preview export requires confirmed course identity, location, and boundary; a complete saved and approved trace for every expected hole; and current generated preview geometry for every expected hole. An existing stale elevation model also blocks export. Missing elevation and unconfirmed scorecard data remain non-blocking warnings.

The readiness UI separates blocking actions from warnings, reports expected-hole, complete-trace, approved-trace, and current-geometry coverage, and clearly identifies the artifact as preview JSON rather than simulator-ready output. Reopening, editing, or clearing a trace revokes readiness until the trace is saved, approved, and its preview geometry regenerated.

## Milestone 17 explicit exclusions

Milestone 17 does not persist readiness, change the CoursePackage schema or version, add source reports or multi-file packaging, generate heightmaps, masks, final terrain, or simulator-ready assets, activate live or paid providers, add cloud persistence, change Unreal code, or deploy production infrastructure.

## Completed milestone: 16 — Hole Trace Review

Milestone 16 adds a focused review workflow for saved manual hole traces. Reviewers can enter review mode, move among saved traces, jump to the next trace needing review, approve a trace, or reopen an approved trace for editing. Review state uses the existing `trace saved`, `approved`, and `needs review` hole statuses and persists through local autosave and project-file export/import.

This milestone preserves the existing tracing, geometry-preview, elevation, map, and neutral CoursePackage behavior.

### Milestone 16 explicit exclusions

Milestone 16 does not activate live or paid providers, add Earth Engine or USGS terrain generation, run scorecard AI, create final simulator terrain, add cloud accounts or persistence, redesign the CoursePackage schema, implement the Unreal importer, or deploy production infrastructure.

## Future direction

Later milestones may improve provider-backed search and geometry inputs, terrain/topology generation, final neutral CoursePackage contents, and Unreal-side import. Each live provider or cross-system integration requires a separate product, licensing, cost, and architecture decision.
