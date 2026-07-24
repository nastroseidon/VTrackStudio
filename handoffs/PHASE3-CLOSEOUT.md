---
**COPY THIS ENTIRE SECTION AND PASTE INTO THE NEXT TASK'S CHAT**

---

# HANDOFF: Phase 3 Close-Out — doc reconciliation + PR merge order

**Task type:** documentation + repository triage. **No source changes.**
**Runs in:** a cloud session with its own clone. See §1 — this constrains you in ways local sessions aren't.
**Written:** 2026-07-24, from verified state.

You are working on **VTrackStudio CourseForge** — golf course reconstruction from open geospatial data (OSM geometry + Copernicus GLO-30 elevation + ESA WorldCover land cover → a neutral, engine-agnostic `CoursePackage`).

Phase 3 is functionally finished but cannot close: **7 pull requests are open with no agreed merge order**, and the project's own tracking documents contradict the repository. Your job is to fix the second problem and propose a solution to the first.

---

## 1. You are in the cloud — read this before anything else

Your clone sees **only what is on `origin`.** Several things previous sessions relied on are unreachable to you:

| Thing | Status for you |
|---|---|
| `AUTOMAT_PORT_HANDOFF.md` | ❌ **Unreachable.** Lives at `H:\Claude\`, outside the repo entirely. Prior handoffs call it "the authoritative record." You cannot read it. Do not cite it. |
| 4 commits on local `main` | ❌ Unreachable. Someone committed `CODEX_BRIEF.md`, `HANDOFF.md`, `TASK_LEDGER.md`, `REFOCUS.md`, `README.md` and `handoffs/` **directly to a local `main`** and never pushed. `origin/main` is `4caccd8` and has no `handoffs/` directory. |
| `handoffs/M3.5-to-M3.6.md` | ⚠️ Only on `origin/docs/m3.6-handoff-correction` (PR #25), not on `main`. |
| `H:\Claude\tools\node-...` | ❌ Local-only. Use your environment's own Node 24. |

**A previous cloud session lost time to exactly this** — it was pointed at `handoffs/M3.5-to-M3.6.md` on `main`, correctly found it did not exist, and stopped. Start with:

```bash
git fetch origin
git show origin/docs/m3.6-handoff-correction:handoffs/M3.5-to-M3.6.md
```

That is the most accurate document in the project. **Read it before proceeding** — it contains verified state and four blockers, and this handoff assumes you have.

---

## 2. Verified state (checked 2026-07-24 — verify anything you rely on)

**`origin/main` = `4caccd8`.** `verify:fast` PASS: lint, typecheck, **118 tests / 15 test files**, `next build` clean.

### Merged to `main`

| Milestone | What | PR | Commit |
|---|---|---|---|
| M1.x | OSM geometry provider (Overpass) | #6 | `3dae504` |
| M2.1–M2.5b | Copernicus GLO-30 heightmaps, ZIP bundle | #7 | `7356a10` |
| M2.6 | Multi-tile DEM mosaic | #9 | `0cf1bfa` |
| M3.1 | Splat schema + 8-bit encoder | #10 | `337e32a` |
| M3.2 | Polygon rasteriser | #13 | `40ab2d3` |
| M3.4 | Land-cover compositor | #19 | `778dc24` |
| M3.3 | ESA WorldCover live provider | #21 | `4caccd8` |

M3.4 landed before M3.3 deliberately — it is offline and fixture-testable; the live fetch plugs into the `ClassGrid` seam.

### The 7 open PRs — your triage subject

| PR | Branch | Draft | Scope | Notes |
|---|---|---|---|---|
| **#23** | `feature/surfaces-api-ui` | no | **M3.5** API + UI + bundle | `b77862e`, **MERGEABLE**, `verify:fast` passes. **Adds zero tests** (118 → 118). |
| **#25** | `docs/m3.6-handoff-correction` | no | Corrected handoff | Also carries the 4 stray `main` commits — merging publishes the coordination files |
| #16 | `chore/ci-verify` | yes | `.github/workflows/verify.yml` | **The repo has no CI.** Nothing validates any of these PRs. |
| #17 | `feature/unreal-importer-design` | yes | Unreal importer DESIGN.md | Codex-owned |
| #20 | `docs/course-style-profile` | yes | Phase 6 research note | Codex-owned |
| #22 | `feature/m3.3-followup` | no | Doc update | Likely superseded — check against #25 |
| #24 | `feature/unreal-importer-reader` | yes | Unreal CoursePackage reader | Codex-owned |

### In flight — do not touch
Another session is building **M3.6 (canopy/trees)** on branch `feature/m3.6-canopy`, based on `b77862e`. It owns `lib/surfaces/**`, `packages/course-schema/**`, and `tests/**`. Its first commit is M3.5's missing test coverage. **Stay out of those paths.**

---

## 3. Documents that contradict the repository

This is the actual assignment. Each has been verified wrong:

| File | Claim | Reality |
|---|---|---|
| `courseforge/docs/ROADMAP.md:11` | "**Next: M3.3** — WorldCover … LIVE gate — still closed" | M3.3 **merged** as `4caccd8`; gate cleared |
| `HANDOFF.md:3` | "M3.5 complete" | PR #23 is **open**, not merged |
| `HANDOFF.md:7` | "✅ M3.5 COMPLETE" | Same |
| `HANDOFF.md:10` | "Next Milestone: M3.6 (**Finalize Phase 3 & Roadmap**)" | M3.6 is **canopy/trees + foliage**, per `ROADMAP.md:13` and `PHASE3_LANDCOVER_SPLAT_DESIGN.md` §7 — a live-gated code milestone, not docs |
| `handoffs/M3.5-to-M3.6.md` (on #25) | Phase 2 PRs "#13, #15" | #13 is M3.2. #15 unverified. |

**Root cause worth understanding, not just patching:** these documents are written by hand at the end of a session and never re-checked. That produced a duplicated M3.5 (two sessions built it in parallel), a false "gh is not installed" note that cost a round-trip, and a cloud session that stalled on a missing file. Every claim you write must come from `git log`, `gh pr view`, or a command you ran.

---

## 4. Scope

### In scope ✅
1. **Reconcile the docs.** `ROADMAP.md`, `HANDOFF.md`, and any doc asserting milestone/PR state. Every claim traceable to `git log` or `gh`.
2. **Propose a merge order for the 7 PRs** — dependencies, conflicts, and what each unblocks. A recommendation for the user to approve, in `handoffs/PHASE3_MERGE_PLAN.md`.
3. **Add a provenance line** to each reconciled doc: what it was verified against and when.
4. **Flag contradictions you cannot resolve** rather than guessing.

### Out of scope ❌
- Any change under `courseforge/apps/web/lib/**`, `components/**`, `app/**`, `packages/**`, `tests/**`
- Merging anything (user-only, always)
- M3.6 canopy/trees work — another session owns it
- `.github/**` — PR #16 owns it
- Rewriting design docs. `PHASE3_LANDCOVER_SPLAT_DESIGN.md` is **signed off and locked**; if it is wrong, say so, don't edit it

### Deliverables
- `courseforge/docs/ROADMAP.md` — corrected
- `HANDOFF.md` — corrected
- `handoffs/PHASE3_MERGE_PLAN.md` — new; ordered merge proposal with rationale and risk per PR
- One PR, not draft

---

## 5. Governance

**Council scoring** — Correctness 25%, Safety 20%, Testability 15%, Rollback 10%, Fit 10%, Scope 10%, Maintainability 5%, Simplicity 5%.

- **≥85** → auto-proceed: commit, push, open PR without asking
- **<85** → present to the user first
- **Merging to `main`** → always explicit user approval, no exceptions
- Never ask the user anything without a score and a recommendation attached

Docs-only work is low-risk and should clear 85 routinely. If it doesn't, your scope has probably drifted.

**Anti-patterns:** no work outside this milestone; no refactors or invented abstractions; no "future flexibility." If `REFOCUS.md` is reachable on your branch, read it before any council submission.

---

## 6. Environment

Cloud session — use your own Node 24 toolchain. All npm commands run from `courseforge/apps/web/`; there is no root package.

```bash
cd courseforge/apps/web && npm ci && npm run verify:fast
```

Expect **118 tests passing**. Docs-only changes shouldn't move that number — if it changes, you've edited something you shouldn't have.

**Gotcha:** `.next/types` goes stale and fails `typecheck` with phantom "cannot find module" errors after a route is added. `rm -rf .next` first. Unlikely to bite you (docs-only) but it has cost two sessions already.

`gh` is installed and authenticated in local sessions (2.96.0, account `nastroseidon`). Confirm your own cloud environment with `gh auth status` before relying on it; fall back to the web UI if absent.

---

## 7. Steps

1. **Fetch and read the real handoff** (§1). `git fetch origin && git show origin/docs/m3.6-handoff-correction:handoffs/M3.5-to-M3.6.md`
2. **Establish ground truth yourself.** `git log --oneline origin/main -15`, then `gh pr list --state open` and `gh pr view <n>` for each. Build your own table — do not copy §2 without checking it.
3. **Branch:** `git checkout -b docs/phase3-closeout origin/main`
4. **Reconcile** `ROADMAP.md` and `HANDOFF.md` against what you established. Cite evidence inline (PR number + commit SHA).
5. **Write `handoffs/PHASE3_MERGE_PLAN.md`** — merge order, dependencies, conflict risk, what each PR unblocks, and an explicit recommendation. Call out that #23 has no test coverage and that #25 carries 4 unrelated commits.
6. **Verify:** `npm run verify:fast` — 118 tests, unchanged.
7. **PR:** state exactly what you verified, what you did not, and residual risk. Do not overstate.

---

## 8. What "done" means

- No milestone or PR claim in `ROADMAP.md` or `HANDOFF.md` contradicts `git log`
- Every corrected claim cites a PR number or commit SHA
- A merge plan exists that the user can approve or reject in one read
- Contradictions you couldn't resolve are listed explicitly, not silently dropped
- `verify:fast` still passes at 118 tests

**If you find this handoff wrong about something, that is expected and useful — correct it in your PR and say so. That is the whole point of the task.**
