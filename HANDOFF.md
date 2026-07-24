# CourseForge Handoff Protocol

**Last Updated:** 2026-07-24 (M3.5 complete, PR #23 awaiting merge)

## Quick Status

- **Phase**: Phase 3 (Land Cover Splat Weightmaps) ✅ M3.5 COMPLETE
- **Current Branch**: `feature/surfaces-api-ui` (PR #23, manual merge approval pending)
- **Project State**: All geometry, elevation, and surface-layer generation working end-to-end with open-data sources (OSM, Copernicus GLO-30, ESA WorldCover)
- **Next Milestone**: M3.6 (Finalize Phase 3 & Roadmap) after PR #23 merge
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
| PR | Date | Milestone | Description |
|---|---|---|---|
| #6 | 2026-07-21 | M1.1 | OSM geometry provider (Overpass API, route parsing) |
| #7 | 2026-07-21 | M1.1 | OSM geometry provider tests |
| #13 | 2026-07-21 | M2.1 | Heightmap schema + PNG encoder (16-bit, hand-rolled) |
| #15 | 2026-07-22 | M2.2 | GeoTIFF decoder + Copernicus GLO-30 provider |
| #21 | 2026-07-23 | M3.1–3.4 | Land-cover schema, rasteriser, WorldCover provider, compositor (multi-tile) |

### In Review (Feature Branch) 🔄
| PR | Branch | Milestone | Status |
|---|---|---|---|
| #23 | `feature/surfaces-api-ui` | M3.5 | API wiring + UI + bundle integration (awaiting manual merge approval) |

### Pending Manual Approval 🔄
- **PR #23** (M3.5 surfaces API + UI): Awaiting user merge approval to main

### To Do (Next: M3.6)
- Archive Phase 3 design docs (lock PHASE3*.md, add retrospective notes)
- Publish roadmap to Phase 4+ (simulator integration, Unreal importer, etc.)
- Create M3.6 completion summary (all milestones, final status, lessons learned)

---

## Task Ledger (Check-In/Check-Out)

**Purpose**: Prevent parallel tasks from editing the same files without coordination.

**Format**: `[Status] [Task ID] [Path] [Owner] [Since] [Deadline]`

| Status | Task | Path | Owner | Since | Deadline | Notes |
|---|---|---|---|---|---|---|
| CHECKED_OUT | M3.5-impl | `courseforge/apps/web/app/` | Session-0 | 2026-07-23 | COMPLETE | ✅ Merged PR #23 |
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
- **Test Results**: 15/15 pass, Playwright E2E gate cleared
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
