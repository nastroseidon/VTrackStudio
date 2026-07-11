# Overall Architecture

VTrackStudio is the parent workspace for the VTrack golf simulator ecosystem. It intentionally separates the existing Unreal Engine simulator from CourseForge, the future course-builder app and toolchain.

The current Unreal simulator project is VTrackGarageSim, also referred to as VTrackGarageSim-Unreal. It is currently targeted around Unreal Engine 5.5.4, with a planned future migration path to Unreal Engine 5.8.0.

## Major areas

- `unreal/` contains the Unreal simulator project and Unreal-side integration code.
- `courseforge/` contains the future web app, services, shared packages, and CourseForge product documentation.
- `course-packages/` contains generated and sample course packages.
- `docs/` contains shared architecture documentation that applies across the ecosystem.

## CourseForge and Unreal separation

CourseForge generates neutral course packages instead of directly authoring Unreal project assets. A CoursePackage is intended to describe the course layout, scorecard, terrain, surface masks, metadata, and source report in a simulator-ready but engine-neutral format.

Unreal imports those packages through the planned `CourseForgeImporter` plugin. The importer is responsible for translating CoursePackage data into Unreal terrain, masks, gameplay markers, and course objects.

The web app and Unreal project are intentionally separated so CourseForge can evolve as a course-authoring product without being tightly coupled to Unreal project internals. This also makes it easier to test course package generation independently and keep Unreal Engine version migrations isolated.
