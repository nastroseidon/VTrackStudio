# CourseForge Handoff Protocol

**Last Updated:** 2026-07-24 (M3.5 in review as open PR #23; reconciled against `git log`)

> **Provenance.** Every milestone and PR claim in this file was re-derived on 2026-07-24 from `git log origin/main` at `4caccd8` and the GitHub open-PR list. Do not hand-edit these claims at the end of a session without re-checking them — that is how the errors corrected here got in. Merge order and per-PR risk for the seven open PRs are in `handoffs/PHASE3_MERGE_PLAN.md`.

## Quick Status

- **Phase**: Phase 3 (Land Cover Splat Weightmaps) — 🔄 **M3.5 in review, not merged**
- **Current Branch**: `feature/surfaces-api-ui` (open PR #23, head `b77862e`, mergeable, awaiting merge approval). An open PR is not a merged one.
- **Project State**: All geometry, elevation, and surface-layer generation working end-to-end with open-data sources (OSM, Copernicus GLO-30, ESA WorldCover) — **on PR #23's branch**. `main` at `4caccd8` has geometry, elevation and splat generation, but not the surfaces API/UI wiring.
- **Next Milestone**: **M3.6 — canopy/trees**: a tree-cover class plus canopy data to foliage instances, with its own LIVE gate and a schema addition (`PHASE3_LANDCOVER_SPLAT_DESIGN.md` §7, `courseforge/docs/ROADMAP.md`). It is **not** a documentation-only "finalize Phase 3" milestone. M3.7 is the merge to `main`.
- **Known gap**: PR #23 adds **no new tests** — 118 on the branch, 118 on `main`. Every prior Phase 1–3 milestone added tests. See `handoffs/PHASE3_MERGE_PLAN.md` §5.
- **Council Score (M3.5)**: N/A (implementation task, no decision needed)

---

## Governance Rules

All decisions and code changes must pass Technical Strategy Council scoring:
- **Score ≥85**: Auto-proceeds to commit/push/PR (no waiting)
- **Score <85**: Requires presentation to council before proceeding
- **Merge to main**: ALWAYS requires manual user approval, even if council approves

**Council Members** (5 permanent):
- Technical Strategy Lead
- Security & Compliance
- Testing & QA
- DevOps & Reliability
- Product & Architecture

**Scoring Dimensions** (weighted):
- Correctness: 25%
- Safety/Security: 20%
- Testability: 15%
- Rollback: 10%
- Fit: 10%
- Scope: 10%
- Maintainability: 5%
- Execution Simplicity: 5%

---

## Available Agents for Parallel Work

### Always Available (No Special Setup)
- **Claude** (default general-purpose) — coding, debugging, exploration
- **Explore** — fast codebase search (patterns, symbols, keywords) — use for broad investigations
- **Plan** — architectural design, step-by-step implementation strategy
- **code-reviewer** — independent code review, find bugs, test coverage gaps

### Project-Specific (Session-Aware)
- **claude-code-guide** — Claude Code CLI questions, SDK patterns, API usage
- **general-purpose** — multi-step research, complex problem-solving

---

## Available Skills (Use via `/skill-name`)

### Core Workflow
- `/run` — Launch and drive the web app, verify changes in browser
- `/review` — Lint, type, test reporting
- `/security-review` — OWASP/supply-chain analysis (security-sensitive PRs)

### Configuration & Dev
- `/update-config` — Modify settings.json (permissions, env vars, hooks)
- `/keybindings-help` — Customize keyboard shortcuts

### Documentation & Visualization
- `/dataviz` — Chart, graph, dashboard design before coding
- `artifact-design` — HTML/Artifact rendering guidance
- `/docx` — Create Word documents
- `/pdf` — PDF operations

### Utilities
- `/simplify` — Code quality pass (reuse, efficiency, altitude cleanup)
- `/fewer-permission-prompts` — Build allowlist to reduce approval dialogs
- `/loop` — Recurring task scheduling
- `/schedule` — Cloud agent cron jobs

---

## File Boundaries & Ownership

### Canonical Phase Areas (Main Session)
- `courseforge/docs/PHASE*.md` — locked design documents (no rewrites)
- `courseforge/apps/web/lib/course-data/` — Phase 1 (OSM geometry)
- `courseforge/apps/web/lib/elevation/` — Phase 2 (Copernicus heightmaps)
- `courseforge/apps/web/lib/surfaces/` — Phase 3 (land-cover splats)
- `courseforge/apps/web/lib/imaging/` — shared PNG encoding (hand-rolled, no external libs)
- `courseforge/apps/web/lib/course-package/` — package assembly & bundle export
- `courseforge/packages/course-schema/src/` — neutral data types (owned by course-schema owner)

### API Routes (Coordination Point)
- `courseforge/apps/web/app/api/elevation/` — heightmap generation (M2.4)
- `courseforge/apps/web/app/api/surfaces/` — splat generation (M3.5)
- `courseforge/apps/web/app/api/course-package/bundle/` — hybrid byte sourcing (M2.5 + M3.5)

### UI Components (Coordination Point)
- `courseforge/apps/web/components/ProjectStatusRail.tsx` — "Generate…" buttons (heightmap + surfaces, M2.4 + M3.5)
- `courseforge/apps/web/app/page.tsx` — handlers + cache refs (M2.4 + M3.5)

### Test Suites
- `courseforge/apps/web/tests/unit/**` — deterministic, local fixtures (all phases)
- `courseforge/apps/web/tests/browser/**` — Playwright E2E (user-critical flows)

### Free Work (No Coordination Needed)
- New unit tests (if they don't modify core lib paths)
- Documentation updates in `docs/` and `courseforge/docs/`
- README or setup files
- New experimental branches (not touching `main`)

---

## Current Implementation Status

### Merged (Main) ✅

Read from `git log origin/main` on 2026-07-24. The previous version of this table was wrong about #7, #13, #15 and #21, and omitted #9, #10 and #19 entirely.

| PR | Commit | Milestone | Description |
|---|---|---|---|
| #6 | `3dae504` | M1.x | OSM course geometry via Overpass, incl. User-Agent/406 fix |
| #7 | `7356a10` | M2.1–M2.5b | Copernicus GLO-30 heightmaps: schema, 16-bit PNG encoder, `geotiff` decode, live keyless provider, API + UI, deterministic ZIP bundle export |
| #9 | `0cf1bfa` | M2.6 | Multi-tile GLO-30 mosaicking + `sampleGridNearest` tile-seam fix |
| #10 | `337e32a` | M3.1 | `CourseSplatMap` / `CourseSurfaceLayer` schema + 8-bit hard-mask encoder; PNG writer extracted to `lib/imaging/png.ts` |
| #13 | `40ab2d3` | M3.2 | Polygon rasteriser: even-odd scanline fill, lat/lng→pixel mapping, cross-hole aggregation, precedence painting |
| #19 | `778dc24` | M3.4 | Land-cover compositor + full splat generation (`compositeSurfaceLayers`, `generateCourseSplatMap`) |
| #21 | `4caccd8` | M3.3 | ESA WorldCover live provider feeding the compositor (LIVE gate approved 2026-07-24) |

There is **no PR #15 in `main`'s history.** The GLO-30 provider and the GeoTIFF decoder both landed in #7. M3.4 (#19) deliberately landed before M3.3 (#21) because the compositor is offline and fixture-testable; the live fetch plugs in at the `ClassGrid` seam.

### Open PRs 🔄

Seven, as of 2026-07-24. All seven merge cleanly into `main` and against each other — verified with `git merge-tree --write-tree` across all 21 pairs, so there are **no textual conflicts** to resolve. Order, risk and rollback per PR: `handoffs/PHASE3_MERGE_PLAN.md`.

| PR | Branch | Draft | Scope |
|---|---|---|---|
| #16 | `chore/ci-verify` | yes | `.github/workflows/verify.yml` — **the repo currently has no CI**, so nothing validates any of these PRs |
| #17 | `feature/unreal-importer-design` | yes | Unreal importer `DESIGN.md` |
| #20 | `docs/course-style-profile` | yes | Phase 6 style-profile research note |
| #22 | `feature/m3.3-followup` | no | `ROADMAP.md` M3.3 corrections + gated live WorldCover smoke test |
| #23 | `feature/surfaces-api-ui` | no | **M3.5** — surfaces API + UI + bundle integration. No new tests. |
| #24 | `feature/unreal-importer-reader` | yes | UE 5.8 `CoursePackage` reader plugin |
| #25 | `docs/m3.6-handoff-correction` | no | Corrected M3.5→M3.6 handoff; also publishes the coordination files |

### Pending Manual Approval 🔄
- **PR #23** (M3.5 surfaces API + UI): awaiting user merge approval to `main`. Recommendation in `handoffs/PHASE3_MERGE_PLAN.md` §5 — merge only if the missing test coverage has a committed owner.

### To Do (Next: M3.6 — canopy/trees)
- Tree-cover class → foliage instances, per `PHASE3_LANDCOVER_SPLAT_DESIGN.md` §7
- Requires its own **LIVE gate** approval for canopy data, and a **schema addition** — two separate approval gates
- Add the test coverage M3.5 (#23) did not
- M3.7 is the merge to `main` and the Phase 3 close-out

---

## Task Ledger (Check-In/Check-Out)

**Purpose**: Prevent parallel tasks from editing the same files without coordination.

**Format**: `[Status] [Task ID] [Path] [Owner] [Since] [Deadline]`

| Status | Task | Path | Owner | Since | Deadline | Notes |
|---|---|---|---|---|---|---|
| IN_REVIEW | M3.5-impl | `courseforge/apps/web/app/` | Session-0 | 2026-07-23 | open PR #23 | Built, not merged — PR #23 open at `b77862e` |
| FREE | M3.6-finalize | `courseforge/docs/` | — | — | — | Next: archive Phase 3, publish roadmap |
| FREE | UI-polish | `courseforge/apps/web/components/` | — | — | — | No active work |
| FREE | tests-expand | `courseforge/apps/web/tests/` | — | — | — | No active work |

**To Check Out a Task**:
1. Find a path in the ledger marked `FREE`
2. Create an issue or branch name (e.g., `feature/m3-6-finalize`)
3. Update this ledger: change status to `CHECKED_OUT`, record owner and deadline
4. Commit the ledger update: `git add TASK_LEDGER.md && git commit -m "CheckOut: M3.6-finalize (owner, deadline)"`
5. Proceed with work

**To Check In (Handoff)**:
1. Complete the task, merge PR to main (if applicable)
2. Update ledger: change status to `FREE`, clear owner/deadline
3. Create/update HANDOFF.md with new status
4. Commit: `git add TASK_LEDGER.md HANDOFF.md && git commit -m "CheckIn: M3.6-finalize handoff ready"`
5. Post the **Handoff Prompt** (see HANDOFF_PROMPT.md) in chat

---

## Session Notes & Decisions

### M3.5 Implementation (2026-07-23)
- **Type Narrowing Fix**: `handleGenerateSurfaceLayers` response handling required explicit type guards on error + splat fields (strict TypeScript)
- **API Pattern**: Mirrors elevation provider (live fetch + encoding, hybrid client cache ref)
- **UI Parity**: Surface button mirrors heightmap button (readiness guards, inline summary)
- **Test Results**: 118 tests across 15 test **files** — the "15/15" in earlier notes was a file count, not a test count. Playwright E2E gate cleared. No new tests were added by M3.5.
- **Decision**: Manual merge approval required for PR #23

### Known Constraints
- **Copernicus GLO-30**: Keyless S3 access, ~12 MB tiles, 30m global DEM
- **ESA WorldCover v200**: Keyless S3 access, 3° tiles, 10m land-cover classification
- **Hand-Rolled PNG**: No external lib (`pykng`), deterministic CRC32, IDAT zlib
- **Splat Composition**: Hard masks (no feathering), strict precedence (OSM > WorldCover > rough fallback)
- **Local Grid**: Optional ENU metric grid for Unreal compatibility (not auto-generated)
- **Bundle Export**: Deterministic ZIP (store method, fixed timestamps), Windows `Expand-Archive` interop verified

---

## Approval Checklist (Before Merge to Main)

- [ ] All tests pass (`npm run verify`)
- [ ] No TypeScript errors or ESLint warnings
- [ ] No secrets in diff (`git diff` checked)
- [ ] Commit message clear & references phase/milestone
- [ ] PR description includes architecture notes & test evidence
- [ ] Design docs updated (if applicable)
- [ ] Council score recorded (if decision was required)
- [ ] User approval explicitly given for merge to main

---

## Emergency: Task Conflicts or Reversions

If parallel tasks conflict or a merge needs rollback:

1. **Identify Conflict**: Check TASK_LEDGER.md to see who is working on what
2. **Contact Owner**: Reach out to the task owner via the ledger
3. **Stop Work**: All tasks should halt changes to conflicted paths until resolved
4. **Escalate to User**: Present the conflict, blockers, and options
5. **Update Ledger**: Record resolution and clear conflict status

---

## Quick Links

- **Design Docs**: `courseforge/docs/PHASE*.md`
- **Test Suite**: `npm run verify` (lint + type + tests + build)
- **Browser Tests**: `npm run test:browser` (Playwright)
- **Local Dev**: `npm run dev` (Next.js at `http://localhost:3000`)
- **API Endpoints**: `courseforge/apps/web/app/api/`
- **Schema Types**: `courseforge/packages/course-schema/src/courseProject.ts`
- **GitHub**: https://github.com/nastroseidon/VTrackStudio

---

## Help & Escalation

- **Code Questions**: Ask `/claude-api` or `/claude-code-guide` skill
- **Design Review**: Use `/review` skill or request council decision
- **Dependency Issues**: Check `courseforge/apps/web/package.json` and `npm audit`
- **Unresolvable Conflicts**: Escalate to user with full context from this file + TASK_LEDGER.md
