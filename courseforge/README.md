# CourseForge

CourseForge is the future course-builder app and toolchain for VTrackStudio.

## Folder layout

- `apps/web/` contains the first CourseForge Next.js web app shell.
- `services/geo/` is reserved for future geospatial and elevation processing services.
- `packages/course-schema/` is reserved for shared course package schema code.
- `packages/geometry/` is reserved for geometry helpers and course-shape utilities.
- `packages/shared-types/` is reserved for shared TypeScript or schema types.
- `docs/` holds CourseForge-specific product and technical documentation.

## Current milestone

This milestone adds a map-first CourseForge web app shell with mock course data, provider-backed imports, interactive project state, boundary tools, scorecard review, Satellite Auto-Builder prep, manual hole tracing, basic geometry preview, mock elevation/topology foundation, and MVP project save/resume support. Users can draw a manual boundary by clicking points on the map, use Auto Boundary to create a simple square estimate around the selected course, save their work locally while tracing holes, generate simple visual tee/fairway/green preview shapes from saved traces, and generate a deterministic mock elevation profile for future package context.

It does not call Places search, use Earth Engine, run scorecard AI, generate final playable geometry, export real course packages, use cloud persistence, or import anything into Unreal.

## Basic geometry preview

CourseForge can generate simple map overlays from saved manual traces:

- tee box polygons around tee points
- fairway corridor polygons around tee-to-green trace lines
- green oval polygons around green points

These shapes are visual previews for review inside CourseForge. They are not final simulator-ready course assets and are not exported to Unreal yet.

## Elevation foundation

CourseForge now has a shared elevation/topology data shape, a mock elevation generator, and a server-side Google Elevation provider. The mock generator creates deterministic sample elevation points from the course boundary and saved hole traces so the UI, save files, and Course Package JSON can carry elevation metadata. When `GOOGLE_MAPS_SERVER_API_KEY` is configured, CourseForge can request real Google Elevation samples for boundary vertices, boundary midpoints, and saved hole trace points.

Current elevation limitations:

- mock elevation is sample data only
- Google Elevation samples are point samples only, not a terrain heightmap
- no USGS or Earth Engine calls are made yet
- no terrain heightmap is generated yet
- no final playable terrain or Unreal terrain import exists yet

## Project save and backup

CourseForge autosaves the active project to browser `localStorage` on the current device. On reload, the app offers to resume the saved project or start a new session.

The web app also supports JSON project backup files:

- `Save Project` writes the current project to local browser storage.
- `Export Project File` downloads a CourseForge JSON backup.
- `Import Project File` restores a previously exported CourseForge JSON backup.

Local saves are browser/device-specific. There is no database, account system, Supabase/Postgres storage, or cloud sync yet.

## Course package export preview

CourseForge can also export a neutral Course Package JSON after the course, location, boundary, and generated geometry preview are ready. This is different from `Export Project File`:

- `Export Project File` is a CourseForge backup/resume file.
- `Export Course Package JSON` is a clean package preview intended as a future handoff format.

The Course Package JSON includes course identity, location, boundary, scorecard data when available, hole traces, generated preview geometry, mock elevation metadata when generated, warnings, and limitations. It does not include API keys, local browser save metadata, real terrain heightmaps, final playable geometry, Unreal assets, or Unreal import logic.

## Course data providers

CourseForge has a provider status endpoint at `/api/courses/providers/status`. It reports which course metadata, scorecard, and geometry providers are active, disabled, or stubbed without exposing secrets.

Current provider state:

- Mock CourseForge metadata is active for local development.
- GolfCourseAPI is prepared for server-side integration with `GOLFCOURSEAPI_KEY`, but remains disabled until endpoint mapping is confirmed.
- RapidAPI providers are prepared for server-side integration with `RAPIDAPI_KEY`, but remain stubbed until exact endpoint shapes are confirmed.

Provider keys are server-side only. Live scorecards, when available later, will still require human review and confirmation. CourseForge does not scrape proprietary golf apps or sites.

## Running the web app

From `courseforge/apps/web`:

```bash
npm install
npm run dev
```

Then open the local URL printed by Next.js, usually `http://localhost:3000`.

## Local environment

Create `courseforge/apps/web/.env.local` from the example file:

```bash
cp .env.example .env.local
```

Then add:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_SERVER_API_KEY=
GOLFCOURSEAPI_KEY=
RAPIDAPI_KEY=
```

The `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` key is client-side because the map runs in the browser and should be restricted by HTTP referrer for local development and any deployed app domains. `GOOGLE_MAPS_SERVER_API_KEY` is server-side only and is used for Google Elevation API requests from API routes. Provider keys are server-side only. The app still runs without these keys and shows disabled provider status where live sources are not configured.

Do not commit `.env.local`; it is ignored by the root `.gitignore`.

## Next milestone

The next milestone can replace the mock search results with a more complete prototype flow while still keeping real Places search, Earth Engine, scorecard AI, and Unreal import logic out until those integrations are intentionally designed.
