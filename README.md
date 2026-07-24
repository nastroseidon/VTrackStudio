# VTrackStudio

VTrackStudio is the parent workspace for the VTrack golf simulator ecosystem. It keeps the Unreal simulator project, the future CourseForge course-builder tool, shared architecture docs, and generated course packages in separate areas.

## Workspace layout

- `unreal/` holds the existing VTrackGarageSim Unreal Engine simulator project and Unreal-side integration work.
- `courseforge/` holds the future web app, backend services, shared packages, and CourseForge-specific docs.
- `course-packages/` holds generated and sample neutral course packages.
- `docs/` holds shared architecture and pipeline documentation for the whole ecosystem.

## Current milestone

**Phase 3 (ESA WorldCover Land-Cover Splats)**: ✅ M3.5 COMPLETE (surfaces API + UI wiring). Awaiting merge approval for PR #23. Next: M3.6 (finalize Phase 3 docs, publish Phase 4 roadmap).

See [HANDOFF.md](HANDOFF.md) for current project state, council governance, and milestone definition.

## For New Tasks or Parallel Work

If you are starting a new task on this repository, **read these files in order**:

1. **[CODEX_BRIEF.md](CODEX_BRIEF.md)** — Codebase structure, governance model, file ownership, workflow checklist
2. **[HANDOFF.md](HANDOFF.md)** — Current project state, milestone definition, council scoring rules, available agents/skills, file boundaries
3. **[TASK_LEDGER.md](TASK_LEDGER.md)** — Check-in/check-out registry. Update this file when starting your task to prevent overlap with parallel work.
4. **[REFOCUS.md](REFOCUS.md)** — Anti-scope-creep prompt. Read before any council decision or when considering new work.

### Quick Start for New Task

```bash
cd courseforge/apps/web
# Read the coordination files above (CODEX_BRIEF → HANDOFF → TASK_LEDGER → REFOCUS)
# Update TASK_LEDGER.md to check out your task path
git checkout main && git pull origin main
git checkout -b feature/m[X]-[your-task-slug]
git add TASK_LEDGER.md && git commit -m "CheckOut: M[X]-[task] (owner, eta)"
npm run verify:fast  # baseline check
# Start work (see REFOCUS.md for scope guidance)
```

### Key Rules
- **Council Scoring**: All decisions scored on 8 dimensions (correctness, safety, testability, rollback, fit, scope, maintainability, simplicity). ≥85 auto-proceeds; <85 requires council. Merge to main always manual.
- **File Ownership**: Phase lib/ paths locked to main session. API routes + UI: coordination points (check TASK_LEDGER.md). Docs + tests: free work.
- **Check-In/Check-Out**: Update TASK_LEDGER.md when starting (IN_PROGRESS) and finishing (COMPLETE). Prevents parallel tasks from editing the same files.
- **Scope Focus**: Read REFOCUS.md before every decision. Avoids premature optimization, abstractions, and features outside current milestone.

---

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
