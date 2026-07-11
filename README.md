# VTrackStudio

VTrackStudio is the parent workspace for the VTrack golf simulator ecosystem. It keeps the Unreal simulator project, the future CourseForge course-builder tool, shared architecture docs, and generated course packages in separate areas.

## Workspace layout

- `unreal/` holds the existing VTrackGarageSim Unreal Engine simulator project and Unreal-side integration work.
- `courseforge/` holds the future web app, backend services, shared packages, and CourseForge-specific docs.
- `course-packages/` holds generated and sample neutral course packages.
- `docs/` holds shared architecture and pipeline documentation for the whole ecosystem.

## Current milestone

CourseForge is implementing **Milestone 17 — Course Package Readiness Gate**, a deterministic quality gate for its current neutral preview JSON export. See the [CourseForge roadmap](courseforge/docs/ROADMAP.md) for scope and exclusions.

## Development setup

Required software:

- Node.js 24 and npm
- Chromium installed through Playwright for browser tests
- Docker Desktop or another Docker Engine with Docker Compose v2, only for the optional container workflow

Install the web dependencies from the repository lockfile:

```bash
cd courseforge/apps/web
npm ci
npx playwright install chromium
```

Start normal local development:

```bash
npm run dev
```

Open `http://localhost:3000`. Stop the server with `Ctrl+C` in its terminal. Normal local development is the quickest workflow and runs Node directly on the host.

Routine verification uses:

```bash
npm run verify:fast
```

Run the complete pre-approval or pre-merge verification, including Chromium tests at both supported desktop viewports, with:

```bash
npm run verify
```

Individual commands are:

```bash
npm run test
npm run test:browser
npm run lint
npm run typecheck
npm run build
npm run start
```

`npm run start` serves an existing production build locally; run `npm run build` first and stop it with `Ctrl+C`. This is local verification, not deployment.

## Docker-based development

Docker is an optional, development-only alternative that runs the same web app in a container. From the repository root:

```bash
docker compose up --build
docker compose logs -f web
docker compose down
```

Use `Ctrl+C` to stop following logs. `docker compose down` stops the development service without deleting volumes. The Compose setup does not represent production infrastructure.

CourseForge runs without optional provider credentials. When locally configured, the recognized variable names are `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_API_KEY`, `GOLFCOURSEAPI_KEY`, and `RAPIDAPI_KEY`. Never commit their values.
