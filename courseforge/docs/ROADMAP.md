# CourseForge Roadmap

## Current milestone: 16 — Hole Trace Review

Milestone 16 adds a focused review workflow for saved manual hole traces. Reviewers can enter review mode, move among saved traces, jump to the next trace needing review, approve a trace, or reopen an approved trace for editing. Review state uses the existing `trace saved`, `approved`, and `needs review` hole statuses and persists through local autosave and project-file export/import.

This milestone preserves the existing tracing, geometry-preview, elevation, map, and neutral CoursePackage behavior.

## Explicit exclusions

Milestone 16 does not activate live or paid providers, add Earth Engine or USGS terrain generation, run scorecard AI, create final simulator terrain, add cloud accounts or persistence, redesign the CoursePackage schema, implement the Unreal importer, or deploy production infrastructure.

## Future direction

Later milestones may improve provider-backed search and geometry inputs, terrain/topology generation, final neutral CoursePackage contents, and Unreal-side import. Each live provider or cross-system integration requires a separate product, licensing, cost, and architecture decision.
