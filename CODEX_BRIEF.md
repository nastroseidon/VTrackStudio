# CODEX Brief: Codebase Structure & Governance

**For every new task: Read this → HANDOFF.md → TASK_LEDGER.md → REFOCUS.md**

---

## What Is CourseForge?

CourseForge is a course-reconstruction architecture that implements the Automat principle:

> **"A course is a query, not an asset."**

At build time or load time, CourseForge reconstructs a golf course from open geospatial data:
- **Geometry**: OpenStreetMap (OSM) via Overpass API — hole boundaries, fairways, greens, tees
- **Elevation**: Copernicus GLO-30 DEM — 30m global terrain heightmaps
- **Land Cover**: ESA WorldCover v200 — 10m classification (grassland, trees, water, etc.)

Output: **CoursePackage** — a neutral, engine-independent JSON descriptor + separate packaged PNG artifacts (heightmap, splat layers). Unreal (or any engine) imports this and builds its simulation.

---

## Repository Layout

```
VTrackStudio/
├── courseforge/                      ← Active development here
│   ├── apps/web/                     ← Next.js app (React, TypeScript)
│   │   ├── app/                      ← App Router, API routes, pages
│   │   │   ├── page.tsx              ← Main UI (geometry, elevation, surfaces handlers)
│   │   │   └── api/                  ← REST API routes
│   │   │       ├── elevation/        ← /api/elevation/generate (heightmap)
│   │   │       ├── surfaces/         ← /api/surfaces/generate (splat layers)
│   │   │       └── course-package/   ← /api/course-package/bundle (ZIP export)
│   │   ├── components/               ← React components
│   │   │   ├── ProjectStatusRail.tsx ← "Generate…" buttons, status display
│   │   │   ├── CourseMap.tsx         ← Leaflet map
│   │   │   └── ...
│   │   ├── lib/                      ← Core logic (NO DEPENDENCIES, isolated by phase)
│   │   │   ├── course-data/          ← Phase 1: OSM geometry
│   │   │   │   ├── osm/              ← Overpass API client, parsing
│   │   │   │   └── providers/        ← Course geometry providers
│   │   │   ├── elevation/            ← Phase 2: Copernicus heightmaps
│   │   │   │   ├── heightmap/        ← PNG encoder, GeoTIFF decoder
│   │   │   │   ├── copernicus/       ← Tile naming, fetching, windowing
│   │   │   │   └── *-elevation-provider.ts ← Orchestration
│   │   │   ├── surfaces/             ← Phase 3: ESA WorldCover splats
│   │   │   │   ├── worldcover/       ← Tile naming, fetching, class grids
│   │   │   │   ├── encode-splat.ts   ← 8-bit layer encoding
│   │   │   │   ├── rasterise-geometry.ts ← Polygon rasteriser (scanline, even-odd)
│   │   │   │   ├── composite-surfaces.ts ← Splat composition (OSM > WorldCover > fallback)
│   │   │   │   └── generate-splat.ts ← Live orchestration (worldcover + rasterise + encode)
│   │   │   ├── imaging/              ← Shared PNG encoder (hand-rolled, CRC32)
│   │   │   ├── course-package/       ← Bundle assembly & ZIP export
│   │   │   ├── geometry/             ← Trace-based geometry (user-drawn polygons)
│   │   │   └── hole-trace-review.ts  ← Trace approval & sequencing
│   │   ├── tests/
│   │   │   ├── unit/                 ← Vitest (deterministic, mocked, local fixtures)
│   │   │   ├── browser/              ← Playwright E2E (user flows, real browser)
│   │   │   └── ...
│   │   └── package.json              ← Dependencies (geotiff, react-leaflet, zlib, etc.)
│   ├── packages/course-schema/       ← Neutral types (CourseProject, CoursePackage, etc.)
│   │   └── src/courseProject.ts      ← Schema: definition of truth for CoursePackage
│   └── docs/                         ← Design documentation
│       ├── PHASE1_*.md               ← Phase 1 architecture (locked)
│       ├── PHASE2_*.md               ← Phase 2 architecture (locked)
│       └── PHASE3_*.md               ← Phase 3 architecture (locked)
├── CODEX_BRIEF.md                    ← This file
├── HANDOFF.md                        ← Current project state, governance, agents, skills
├── TASK_LEDGER.md                    ← Check-in/check-out registry (prevent overlap)
├── REFOCUS.md                        ← Before every council decision or scope question
├── AGENTS.md                         ← Development workflow, testing, verification
└── README.md                         ← Quick-start guide
```

---

## Phase-Gated Development Model

CourseForge is built in locked phases. Each phase has a design document, implementation milestones, and approval gates.

### Completed Phases ✅

| Phase | Topic | Design Doc | Status | PRs |
|---|---|---|---|---|
| Phase 1 | **OSM Geometry** | `courseforge/docs/PHASE1_...md` | ✅ Complete (M1.1) | #6, #7 |
| Phase 2 | **Copernicus Heightmaps** | `courseforge/docs/PHASE2_...md` | ✅ Complete (M2.1–2.6) | #13, #15 |
| Phase 3 | **ESA WorldCover Splats** | `courseforge/docs/PHASE3_...md` | ✅ Complete (M3.1–3.5) | #21, #23 |

### In Progress 🔄

- **M3.6**: Finalize Phase 3 (archive design docs, publish roadmap for Phase 4+)

### Future Phases 🔮

- **Phase 4**: Simulator Integration (Unreal CourseForgeImporter, landscape binding)
- **Phase 5**: Live Provider Expansion (Google Maps API, USGS 3DEP, local rasters)
- **Phase 6**: Cloud Workflow (API backend, scheduled regeneration, CDN caching)

---

## File Ownership & Coordination Rules

### Owned by Phase (Main Session Only)

These paths are the canonical implementation for each phase. Do NOT modify without coordination:

- `courseforge/docs/PHASE*.md` — **Locked design documents** (can add notes, cannot rewrite)
- `courseforge/apps/web/lib/course-data/` — **Phase 1 only** (OSM geometry)
- `courseforge/apps/web/lib/elevation/` — **Phase 2 only** (heightmaps)
- `courseforge/apps/web/lib/surfaces/` — **Phase 3 only** (splat layers)
- `courseforge/apps/web/lib/imaging/` — **Shared across phases** (PNG encoding, hand-rolled)

### Coordination Points (Multiple Tasks May Touch)

These paths require check-in/check-out via TASK_LEDGER.md:

- `courseforge/apps/web/app/api/elevation/` — heightmap generation API
- `courseforge/apps/web/app/api/surfaces/` — splat generation API
- `courseforge/apps/web/app/api/course-package/` — bundle export (hybrid byte sourcing)
- `courseforge/apps/web/app/page.tsx` — main handler orchestration + cache refs
- `courseforge/apps/web/components/ProjectStatusRail.tsx` — button/status UI

### Free Work (No Coordination Needed)

- Any **new** test file (if it doesn't modify existing test paths)
- `courseforge/docs/` — additional docs, guides, architecture notes
- `README.md`, setup, deployment files
- New feature branches that don't touch `main`

---

## Governance: Technical Strategy Council

**All decisions must pass Council scoring** (see HANDOFF.md for details).

### Decision Flow

1. **Propose change** → self-score on 8 dimensions (correctness, safety, testability, rollback, fit, scope, maintainability, simplicity)
2. **Score ≥85?** → Auto-proceed to commit/push/PR (no waiting)
3. **Score <85?** → Present to council (5 permanent members) before proceeding
4. **Merge to main** → ALWAYS requires manual user approval (no auto-merge, even if council approves)

### Anti-Patterns to Avoid (See REFOCUS.md)

- Do not invent work outside the current milestone
- Do not optimize before profiling
- Do not refactor before a third use
- Do not add abstractions "for future flexibility"
- Do not test things that cannot fail (or should not fail)

---

## Key Technical Constraints

### Data Sources (Approved, No Licensing Burden)

| Source | Type | Access | License | Notes |
|---|---|---|---|---|
| **OpenStreetMap** | Geometry | Keyless HTTP API (Overpass) | ODbL | Polygon boundaries, tee/green/fairway |
| **Copernicus GLO-30** | Elevation DEM | Keyless AWS S3 (registry.opendata.aws) | Free to use | 30m global, ~12 MB/tile, bilinear resample |
| **ESA WorldCover v200** | Land Cover | Keyless AWS S3 (eu-central-1) | CC-BY 4.0 | 10m, 3° tiles, 10 classes (tree, grass, water, etc.) |

### Implementation Rules

- **No external PNG library** — hand-rolled CRC32, IDAT/zlib, deterministic output
- **No HTTP caching library** — bare `fetch()` with inline content-range window-read
- **Deterministic tests** — in-memory fixtures, no live API calls (except approved smoke tests)
- **Hard masks, no feathering** — splat layers are per-pixel hard classification (rendering engine handles feathering)
- **Strict precedence** — OSM polygons > WorldCover classes > "rough" fallback (never UNASSIGNED)
- **Local metric grid optional** — Unreal compatibility aid, not auto-generated

---

## Development Workflow (Quick Checklist)

### Before Starting Work

1. `cd courseforge/apps/web`
2. `git status` — ensure working tree is clean
3. Read **HANDOFF.md** (current state, current milestone, file boundaries)
4. Read **TASK_LEDGER.md** — check if your path is already checked out
5. Check out your path in TASK_LEDGER.md: `git add TASK_LEDGER.md && git commit -m "CheckOut: M[X]-[task]"`
6. `git checkout main && git pull origin main`
7. `git checkout -b feature/m[X]-[task-slug]`

### During Work

- Keep commits focused (one logical change per commit)
- Run `npm run verify:fast` before pushing (lint, type, tests, build)
- Run `npm run verify` before requesting merge (adds audit + Playwright)
- Test in the app: `npm run dev`, browse to `http://localhost:3000`, verify the flow
- No refactoring outside the current milestone scope (see REFOCUS.md)

### Before Pushing

- `git diff --cached` — review your staged changes
- Ensure no secrets, `.env.local`, or generated folders are included
- Run final checks: `npm run verify` (if browser behavior changed) or `npm run verify:fast` (otherwise)

### PR & Merge

- Push to remote: `git push -u origin feature/m[X]-[task-slug]`
- Create PR via `gh pr create` (include design notes, test evidence, council score if applicable)
- Wait for user approval to merge (manual only, no auto-merge)
- Merge via GitHub (Squash and Merge is preferred)
- Update TASK_LEDGER.md: mark task as ✅ COMPLETE, check in path
- Create handoff prompt for next task

---

## Quick Command Reference

| Task | Command | From | Notes |
|---|---|---|---|
| Local dev server | `npm run dev` | `courseforge/apps/web/` | http://localhost:3000 |
| Type check | `npm run typecheck` | `courseforge/apps/web/` | No build output |
| Lint | `npm run lint` | `courseforge/apps/web/` | ESLint |
| Unit tests | `npm run test` | `courseforge/apps/web/` | Vitest, fast, deterministic |
| Unit tests watch | `npm run test:watch` | `courseforge/apps/web/` | Re-run on file change |
| Browser tests | `npm run test:browser` | `courseforge/apps/web/` | Playwright E2E |
| Routine check | `npm run verify:fast` | `courseforge/apps/web/` | lint + type + test + build |
| Full verification | `npm run verify` | `courseforge/apps/web/` | + audit + browser tests |
| Build only | `npm run build` | `courseforge/apps/web/` | Production build |
| Serve build | `npm run start` | `courseforge/apps/web/` | After `npm run build` |

---

## Escalation & Help

| Problem | Action |
|---|---|
| **Type errors after changes** | Run `npm run typecheck`, fix, commit. Do not weaken TypeScript config. |
| **Test failures** | Debug with `npm run test:watch`, fix root cause, re-run full suite. Do not skip tests. |
| **Lint errors** | Run `npm run lint`, fix, commit. Do not disable rules. |
| **Dependency conflicts** | Check `courseforge/apps/web/package.json`, run `npm ci`, audit if needed. Escalate to user if unresolvable. |
| **Path already checked out** | Check TASK_LEDGER.md, contact owner, coordinate via PR or sequential handoff. |
| **Scope confusion** | Read REFOCUS.md "Am I In Scope" decision tree. If still unclear, escalate to user. |
| **Council score unclear** | Use the scorecard in REFOCUS.md. If score <85, present to council before proceeding. |

---

## Links & References

- **GitHub Repo**: https://github.com/nastroseidon/VTrackStudio
- **Governance**: HANDOFF.md (Technical Strategy Council)
- **Coordination**: TASK_LEDGER.md (check-in/check-out)
- **Scope Focus**: REFOCUS.md (before every decision)
- **Workflow**: AGENTS.md (development rules, testing expectations)
- **Phase 1 Design**: `courseforge/docs/PHASE1_*.md` (locked)
- **Phase 2 Design**: `courseforge/docs/PHASE2_*.md` (locked)
- **Phase 3 Design**: `courseforge/docs/PHASE3_*.md` (locked)

---

## How To Use This Guide

1. **First time?** → Read this file, then HANDOFF.md
2. **Before any coding?** → Check TASK_LEDGER.md, update your path, read REFOCUS.md
3. **When finished?** → Update TASK_LEDGER.md to COMPLETE, update HANDOFF.md, post handoff prompt
4. **Unsure if in scope?** → Read REFOCUS.md, decide tree, escalate if needed
5. **Council decision?** → Score on REFOCUS.md dimensions, proceed if ≥85, present if <85

---

**Last Updated**: 2026-07-24 (M3.5 complete, Phase 3 fully operational)
