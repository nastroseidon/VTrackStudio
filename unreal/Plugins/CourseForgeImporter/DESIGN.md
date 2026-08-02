# CourseForgeImporter Design Groundwork

**Status:** Design only. No Unreal project, asset, or CoursePackage was imported.
**Date:** 2026-07-23
**Scope:** Read-only inspection of the two sibling VTrack Unreal repositories and the current neutral CoursePackage contract.

## 1. Evidence examined

- `H:\Claude\VTrackGarageSim-Unreal\unreal\VTrackGarageSim.uproject`
- `H:\Claude\VTrackGarageSim-Unreal\unreal\Source\VTrackGarageSim\` runtime module, targets, shot data, networking, and game mode
- `H:\Claude\Fable79-VTrackGarageSim-Unreal\unreal\VTrackGarageSim.uproject`
- `H:\Claude\Fable79-VTrackGarageSim-Unreal\unreal\Source\VTrackGarageSim\` runtime module, targets, shot data, networking, ball flight, and session code
- `courseforge/packages/course-schema/src/courseProject.ts`
- `courseforge/docs/PHASE2_DEM_HEIGHTMAP_DESIGN.md`
- `courseforge/docs/PHASE3_LANDCOVER_SPLAT_DESIGN.md`

## 2. Observed facts

### Unreal versions and module layout

| Repository | Engine association | Runtime module | Notable dependencies |
|---|---|---|---|
| `VTrackGarageSim-Unreal` | UE 5.5 | `VTrackGarageSim` | Core, Engine, Json, JsonUtilities, WebSockets, UMG, Niagara |
| `Fable79-VTrackGarageSim-Unreal` | UE 5.3 | `VTrackGarageSim` | Core, Engine, WebSockets, Json, JsonUtilities; Slate private |

- Both `.uproject` files declare one `Runtime` module and no CourseForge importer module.
- Neither inspected repository contains a `.uplugin` file. The CourseForgeImporter directory in this repository contains only a placeholder README.
- The UE 5.5 repository has game and editor targets using `BuildSettingsVersion.V5` and `EngineIncludeOrderVersion.Unreal5_5`. The UE 5.3 repository uses `BuildSettingsVersion.V2`.
- The inspected READMEs describe opening the `.uproject`, generating project files when prompted, building the C++ module, and exercising a local Node connector with mock shots. No reproducible Unreal command-line build or automation-test script was found in the inspected files.

### Current course and runtime behavior

- No inspected runtime source references CoursePackage, heightmaps, splat maps, Landscape, or course loading.
- The UE 5.5 game mode explicitly initializes a fixed-camera range prototype and spawns `AVTrackShotDebugActor`; it says course/game-mode work does not yet exist.
- The UE 5.3 variant receives shots, launches `ABallFlightActor`, and persists shot-session data. It is also a range/prototype flow, not a course loader.

### Launch-monitor boundary

- Both projects receive local WebSocket messages from a Node/TypeScript connector on port 8765. The connector receives GSPro/Open Connect-style TCP data on port 49152 and normalizes it before sending to Unreal.
- The UE 5.5 `FGolfShotData` carries ID, source, club, timestamp, ball data, and club data. Its receiver parses the `payload` object and broadcasts `OnGolfShotReceived`.
- The UE 5.3 `FGolfShotData` carries ID, timestamp, club, ball data, and club data; its receiver invokes ball flight and session recording before broadcasting a shot delegate.
- Course import does not need, and must not modify, this shot-data or connector boundary.

### Current CoursePackage contract

- `course-package.json` is the neutral manifest. It may contain optional `elevation.heightmap` and `surfaces` descriptors.
- A heightmap is a separate 16-bit grayscale PNG artifact, normally `elevation/heightmap.png`. Its 0..65535 samples map linearly to `minElevationMeters..maxElevationMeters`.
- `localGrid`, when present, provides the course-centred metric width, height, and pixel dimensions. The grid is explicitly intended to let an importer place terrain in metres without reprojecting latitude/longitude.
- A splat map is optional. Its 8-bit grayscale PNG layers share the heightmap grid and default to `fairway`, `green`, `tee`, `bunker`, `rough`, `trees`, `water`, and `bare`.
- CourseForge keeps attribution, artifact paths, hashes, dimensions, bounds, and provenance in the neutral package. It contains no Unreal types or asset paths.

## 3. Inferences and recommended ownership

These are implementation recommendations, not observations of existing code.

1. Create `CourseForgeImporter` as a plugin with a narrow **Editor** module. Its job is import-time translation, not runtime loading. Keep any later runtime course-selection system separate.
2. The importer should read a ZIP bundle into a validated intermediate representation before creating any Unreal asset. Validate manifest version, artifact presence, SHA-256, PNG bit depth, dimensions, and the equality of heightmap/splat grids.
3. Translate the neutral raster only at the plugin boundary:
   - heightmap pixels -> Unreal Landscape height samples;
   - `minElevationMeters` / `maxElevationMeters` -> documented Landscape vertical scale and offset;
   - `localGrid.widthMeters` / `heightMeters` -> Landscape X/Y placement and scale;
   - splat PNGs -> named Landscape material-layer import inputs.
4. Preserve the source bundle and a generated import report beside generated assets. The report should record package hash, schema version, source attribution, imported artifact hashes, mapping choices, and errors. This gives regeneration and rollback without manually patching generated terrain.
5. Do not change CourseForge schema for Unreal-specific needs. If implementation proves that essential metadata is absent, record the exact missing neutral concept here and raise it for a separate schema decision.

## 4. What a Landscape import realistically requires

The following is an implementation checklist inferred from the neutral contract and ordinary Unreal editor workflow; exact UE 5.5 editor APIs must be confirmed against the installed engine before code is written.

1. An editor-only plugin/module with Landscape editor and asset-import dependencies, isolated from `VTrackGarageSim` runtime and the shot connector.
2. ZIP and JSON parsing plus PNG decoding that can preserve 16-bit grayscale height values and 8-bit layer values. Library selection must be audited before adoption.
3. A target content path, collision policy, and deterministic naming convention. Re-import must either replace a clearly owned generated asset set or stop safely; it must never overwrite hand-authored assets by discovery.
4. Landscape-compatible dimensions. The importer must reject or explicitly resample unsupported raster dimensions rather than silently distort terrain.
5. A Landscape material with the eight named layer inputs (or an explicit mapping supplied at import time). Package hard masks remain hard; material feathering is an engine-side concern.
6. Controlled Editor import tests using a small fixture bundle. This is a mandatory approval gate because it creates or changes Unreal assets. It is not authorized by this design document.

## 5. Phased implementation proposal

| Step | Deliverable | Boundary | Validation |
|---|---|---|---|
| 4.1 | Plugin descriptor, editor module skeleton, manifest/ZIP reader, validation report | No asset creation | C++ module build + fixture parsing tests |
| 4.2 | 16-bit heightmap decoder and pure scale/placement conversion | No asset creation | Fixed PNG and scale fixtures |
| 4.3 | Splat decoder and explicit layer-name mapping | No asset creation | Fixed 8-layer fixture |
| 4.4 | Editor Landscape import behind a user-invoked command | **Approval required** | Disposable test project, generated-asset manifest, visual/scale checks |
| 4.5 | Re-import/rollback behavior and import provenance report | **Approval required** | Repeated fixture import and recovery test |

## 6. Council decision

**Decision:** Proceed only with this design report and later non-asset package-reader code; do not import assets or alter the shot/connector path.

**Score: 93/100.** Evidence/correctness 23/25; safety and licensing 20/20; testability 14/15; rollback 10/10; CourseForge/VTrack fit 10/10; scope discipline 10/10; maintainability 4/5; execution simplicity 2/5.

- Conservative Systems Engineer: additive Editor-only boundary and fixture-first validation minimize blast radius.
- Software and Systems Architect: CourseForge remains neutral; Unreal owns translation; runtime and connector remain untouched.
- Product and User Advocate: establishes a route from authored courses to playability without destabilizing the current range prototype.
- Quality, Security, and Operations Lead: validation, provenance, deterministic naming, and safe failure are required before asset creation.
- Adversarial Risk Analyst: engine-version differences, Landscape dimension rules, material availability, and asset overwrite risk preclude a live import now.

## 7. Unresolved questions before package-reader implementation

- Which Unreal repository/version is the importer's first integration target: UE 5.5 `VTrackGarageSim-Unreal`, UE 5.3 `Fable79-VTrackGarageSim-Unreal`, or both?
- Which exact Unreal 5.5 Landscape import API and dependency set is available in the target installation?
- What Landscape component/section sizing policy should CourseForge output dimensions target?
- Which generated-content root and Landscape material own imported layers?
- Should bundle parsing use Unreal's built-in archive facilities or a separately audited ZIP library?

## 8. Explicit non-goals

- No live Unreal Editor import, asset creation, or generated-content deletion.
- No runtime course streaming, gameplay, ball physics, launch-monitor, connector, UI, multiplayer, or schema changes.
- No CourseForge provider activation or paid/licensed asset dependency.
