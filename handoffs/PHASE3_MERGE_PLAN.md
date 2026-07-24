# Phase 3 Close-Out — Proposed Merge Order for the 7 Open PRs

**Status:** proposal awaiting user approval. **Nothing here has been merged.** Merging to `main` requires explicit user approval, always.

**Provenance.** Every claim below was established on **2026-07-24** from this repository, not inherited from a prior handoff:

- `git log origin/main` at `4caccd8`
- the GitHub API list of open pull requests (7: #16, #17, #20, #22, #23, #24, #25)
- `git diff --stat <merge-base> origin/<branch>` per branch, for the file lists
- `git merge-tree --write-tree` for every branch against `origin/main` **and** for all 21 branch pairs, for conflict risk
- `npm run verify:fast` in `courseforge/apps/web` on this branch

---

## 1. Headline findings

**1. There are no textual merge conflicts anywhere.** All seven branches merge cleanly into `origin/main`, and all 21 pairwise combinations merge cleanly against each other. Merge order is therefore driven by *review dependency and risk*, not by conflict avoidance. Ordering still matters — see finding 3.

**2. The repository has no CI, so no open PR has been validated by anything except its author's local run.** PR #16 would add `.github/workflows/verify.yml`. Until it lands, "passes `verify:fast`" means one person's machine.

**3. PR #22 is not superseded — it is the ROADMAP correction.** The close-out handoff listed #22 as "likely superseded — check against #25". That is wrong. #22 rewrites the three stale `ROADMAP.md` passages (M3.3 "still closed", the remaining-milestone list, and live-provider status) correctly, and adds a gated live smoke test. #25 does not touch `ROADMAP.md` at all; the two do not overlap. **This PR deliberately does not restate #22's roadmap prose**, to keep the two from colliding — it adds only a conflict-free "Verified state" block at the top of `ROADMAP.md`. Merge #22 and the stale lines are fixed at the source.

**4. PR #23 (M3.5) adds zero test coverage.** 118 tests on `main`, 118 tests on `b77862e`. It adds a live-fetching API route, a bundle regeneration fallback, a UI handler, and a schema field — none covered. Every prior milestone in Phases 1–3 added tests. This is the single largest risk in the queue.

**5. PR #25 carries four commits that have nothing to do with its stated purpose.** Its title is "correct the M3.5→M3.6 handoff", but the branch also publishes `CODEX_BRIEF.md`, `HANDOFF.md`, `TASK_LEDGER.md`, `REFOCUS.md`, a `README.md` change and `handoffs/` — commits `d9ce4ed`, `7c54efc`, `1c78575`, `26c4b55`, made directly to a local `main` in violation of `AGENTS.md`. Merging #25 publishes all of it. The PR body already offers to rebase; see §3.

**6. `HANDOFF.md` is factually wrong and does not exist on `main`.** It exists only on #25's branch. Its errors are listed in §4 — they must be fixed *on #25* before it merges, or immediately after. They could not be fixed in this PR without either duplicating the file onto `main` (guaranteeing a conflict with #25) or stacking this branch on #25.

---

## 2. Recommended merge order

| Step | PR | Branch | Why here |
|---|---|---|---|
| 1 | **#16** | `chore/ci-verify` | Draft. Land first so everything after it is actually validated. Touches only `.github/` — cannot break the app. Needs un-drafting and one green run. |
| 2 | **#22** | `feature/m3.3-followup` | Makes `ROADMAP.md` true. Nearly free, and every later PR is read against a correct roadmap. |
| 3 | **#25** | `docs/m3.6-handoff-correction` | Publishes the coordination files and the corrected handoff. Land only after the §3 decision and the §4 `HANDOFF.md` fixes. |
| 4 | **#23** | `feature/surfaces-api-ui` | M3.5. The only functional change in the queue. **Recommended: hold until test coverage exists** — see §5. |
| 5 | **#17** | `feature/unreal-importer-design` | Draft. Design doc for the Unreal importer; logically precedes the implementation in #24. |
| 6 | **#24** | `feature/unreal-importer-reader` | Draft. The importer implementation. Reads `CoursePackage` — merge after #23 so it is validated against the final Phase 3 package shape. |
| 7 | **#20** | `docs/course-style-profile` | Draft. Phase 6 research note. No dependency in either direction; land whenever. |

Steps 1–3 are documentation and CI only and can go in one sitting. Step 4 is the decision point. Steps 5–7 are Codex-owned drafts and are not urgent.

### Dependencies, stated precisely

- **Hard (order matters):** none. No PR fails to apply if another lands first.
- **Soft (review quality):** #16 before everything (validation) · #22 before #25 (a corrected roadmap makes the handoff readable) · #17 before #24 (design before implementation) · #23 before #24 (the reader should be checked against the shipped package shape).
- **Unblocks:** #23 unblocks M3.6 canopy work, which is already in flight on `feature/m3.6-canopy` based on `b77862e` · #16 unblocks trustworthy review of everything else · #22 + #25 unblock the next session starting from accurate state.

---

## 3. Decision required: what to do with #25's four extra commits

`d9ce4ed`, `7c54efc`, `1c78575`, `26c4b55` were committed directly to a local `main`, against `AGENTS.md`. They are documentation only — no source changes — so the blast radius is small, but merging #25 as-is silently ratifies both the bypass and ~800 lines of coordination scaffolding under one "correct a handoff" title.

Three options, in order of preference:

1. **Rebase #25 onto `origin/main` and split.** #25 becomes the single-file handoff correction it claims to be; the four coordination commits go into their own PR that can be reviewed on its merits. The PR author has already offered this in the PR body. **Recommended.**
2. **Merge as-is, with the PR body amended** to state plainly that it also publishes the coordination files. Fast; leaves a misleading title in the history.
3. **Drop the coordination files.** Only if the scaffolding is not wanted — but `handoffs/` is where this document lives, so at minimum that directory should survive.

---

## 4. `HANDOFF.md` corrections needed on #25

Not applied here — the file exists only on #25's branch (see §1 finding 6). Whoever lands #25 should apply these; every one was checked against `git log`.

| Line / section | Current claim | Verified reality |
|---|---|---|
| L3 | "M3.5 complete, PR #23 awaiting merge" | PR #23 is **open**. Say "M3.5 in review". |
| L7 | "✅ M3.5 COMPLETE" | Same. An open PR is not a merged one. |
| L10 | "Next Milestone: M3.6 (Finalize Phase 3 & Roadmap)" | M3.6 is **canopy/trees + foliage**, a live-gated code milestone with a schema change (`PHASE3_LANDCOVER_SPLAT_DESIGN.md` §7, `ROADMAP.md`). |
| "Merged (Main)" table | #7 = "OSM geometry provider tests" | #7 = **M2.1–M2.5b**, Copernicus GLO-30 + ZIP bundle (`7356a10`). |
| same | #13 = "M2.1 heightmap schema + PNG encoder" | #13 = **M3.2**, the polygon rasteriser (`40ab2d3`). |
| same | #15 = "GeoTIFF decoder + GLO-30 provider" | **#15 is not in `main`'s history at all.** The GLO-30 provider landed in #7. |
| same | #21 = "M3.1–3.4 … (multi-tile)" | #21 is **M3.3 alone** (`4caccd8`). M3.1 = #10, M3.2 = #13, M3.4 = #19. Multi-tile mosaic = #9 (M2.6). |
| same | #9, #10, #19 | Missing entirely from the table. |
| Task Ledger row | "M3.5-impl … ✅ Merged PR #23" | Not merged. |
| "To Do (Next: M3.6)" | archive docs / publish Phase 4 roadmap / write completion summary | Wrong milestone — that is the docs-only M3.6 that the signed-off design doc contradicts. |
| Session Notes | "Test Results: 15/15 pass" | 15 test **files**; **118 tests**. |

---

## 5. Recommendation on #23 (M3.5)

**Hold #23 until it has test coverage, or merge it with an explicitly filed coverage follow-up.**

The case for holding: it adds a route that performs a live external fetch, a bundle path that silently regenerates surfaces when the client cache is cold and 409s when it cannot, and a new optional schema field — with nothing asserting any of it. There is no CI. The regeneration fallback in particular has failure modes (cold cache + missing `providerCourseId`) that only a test will pin down.

The case for merging now: it is mergeable, `verify:fast` passes, and the in-flight M3.6 session is already based on `b77862e` — its stated first commit is exactly M3.5's missing coverage. If that session is real and near, the coverage arrives without blocking.

**Recommended:** confirm the M3.6 session's first commit is landing soon. If yes, merge #23 and let the coverage follow immediately behind it. If not, hold #23 and add the tests first. Do not merge #23 and leave the coverage unowned.

---

## 6. Per-PR risk

| PR | Scope | Conflicts | Risk | Rollback |
|---|---|---|---|---|
| #16 | 1 file, `.github/workflows/verify.yml`, +53 | none | **Low.** Cannot affect the app. Worst case the workflow is misconfigured and fails on itself. Untested against a real runner — expect one or two fixup commits. | Revert; nothing depends on it |
| #17 | 1 file, `unreal/…/DESIGN.md`, +111 | none | **Low.** Prose only, no build impact. | Trivial revert |
| #20 | 1 file, `courseforge/docs/PHASE6_…md`, +156 | none | **Low.** Phase 6 research note, no commitment. | Trivial revert |
| #22 | 3 files, +74/−5: `fetch-worldcover.ts` (comment only), a gated integration test, `ROADMAP.md` | none | **Low.** The live smoke is skipped unless `WORLDCOVER_LIVE=1`. Note it lands a file under `tests/`, which the in-flight M3.6 session claims — no textual conflict, but tell that session. | Trivial revert |
| #23 | 6 files, +203/−1, incl. a new API route and a schema field | none | **Medium.** The only behavioural change in the queue, zero new tests, live external fetch, no CI. Additive schema field (`surfaces?`) so existing packages stay valid. | Revert is clean, but the in-flight M3.6 branch is based on it — reverting after M3.6 starts is expensive |
| #24 | 8 files, +664/−2, UE 5.8 plugin | none | **Medium-low.** Editor-only, creates no assets, no live import. Nothing in the Node toolchain builds or tests it, so `verify:fast` says nothing about it — the author's UE 5.8 BuildPlugin + automation run is the only evidence. | Revert; self-contained under `unreal/` |
| #25 | 8 files, +1257/−1 across 7 commits | none | **Low as code, medium as governance.** Docs only, but see §3 and §4. | Trivial revert |

---

## 7. Contradictions left unresolved

Listed rather than guessed at.

1. **`HANDOFF.md` cannot be corrected from a branch off `main`.** The close-out brief asked for `main`-based work *and* a corrected `HANDOFF.md`; those are mutually exclusive, since the file is only on #25. Corrections specified in §4 instead of applied. **Needs:** a decision on §3 first.
2. **The M3.6 session's existence is unverified.** `feature/m3.6-canopy` does **not exist on `origin`** — `git ls-remote --heads origin` lists 17 branches and it is not among them. Its status is therefore taken on the handoff's word, and §5's recommendation depends on it. **Needs:** confirmation from the user.
3. **`AUTOMAT_PORT_HANDOFF.md` is unreadable from a cloud session.** It lives at `H:\Claude\`, outside the repository and outside version control, yet prior handoffs call it the authoritative record. Nothing in this document relies on it. **Needs:** it should be moved into the repo or demoted from "authoritative".
4. **`REFOCUS.md` was not read before this submission**, as governance requires — it is on #25's branch, not `main`. Noted rather than skipped silently.
5. **Test counts are from Node 22.22.2, not the Node 24.18.0 the project standardises on** — this cloud environment's toolchain. The count matched (118) so the discrepancy appears immaterial, but it is not the documented configuration.
6. **`PHASE3_LANDCOVER_SPLAT_DESIGN.md` is signed off and locked and was not edited.** Nothing in it was found to be wrong.

---

## 8. What was verified for this document, and what was not

**Verified:** `origin/main` = `4caccd8` · the seven open PRs, their numbers, branches, draft state, head SHAs and file lists, from the GitHub API · every merged milestone→PR→SHA mapping, from `git log` · zero conflicts across all 7 branches and all 21 pairs, from `git merge-tree` · #23's test count (118, unchanged from `main`), from the diff · that `feature/m3.6-canopy` is absent from `origin`.

**Not verified:** any branch's `verify:fast` except this one — `main` and #23 were not independently re-run here · #24's UE 5.8 build, which no tooling in this environment can run · #16's workflow against a real GitHub runner · the live WorldCover smoke in #22, which requires `WORLDCOVER_LIVE=1` and a network pull · GitHub's own mergeability computation, which was not queried; conflict results above are local `git merge-tree`.
