# VTrackStudio

VTrackStudio is the parent workspace for the VTrack golf simulator ecosystem. It keeps the Unreal simulator project, the future CourseForge course-builder tool, shared architecture docs, and generated course packages in separate areas.

## Workspace layout

- `unreal/` holds the existing VTrackGarageSim Unreal Engine simulator project and Unreal-side integration work.
- `courseforge/` holds the future web app, backend services, shared packages, and CourseForge-specific docs.
- `course-packages/` holds generated and sample neutral course packages.
- `docs/` holds shared architecture and pipeline documentation for the whole ecosystem.

## Current milestone

This first milestone is structure only. It creates safe folders and planning documents without changing simulator gameplay code, adding real Google APIs, implementing Earth Engine, or building the Unreal importer.

## Next milestone

The next milestone will be a mock CourseForge web app shell that demonstrates the intended course-building flow without real external integrations.
