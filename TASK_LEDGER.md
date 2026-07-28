# Task Ledger: Check-In / Check-Out Registry

**Purpose**: Single source of truth for what paths are being actively worked on. Prevents parallel agents/tasks from editing the same files without coordination.

**Last Updated**: 2026-07-24 (Phase 3 close-out doc reconciliation; M3.5 in review, not complete)

---

## Active Work Registry

| Status | Task ID | Primary Path(s) | Owner | Started | Deadline | Est. Duration | Notes |
|---|---|---|---|---|---|---|---|
| 🔄 IN_REVIEW | M3.5-api-ui | `apps/web/app/api/surfaces/`, `apps/web/app/page.tsx`, `components/ProjectStatusRail.tsx` | Session-0 | 2026-07-23 | open PR #23 | 2h | Built at `b77862e`, **not merged**. Adds no tests (118 → 118). |
| ✅ COMPLETE | phase3-closeout-docs | `courseforge/docs/ROADMAP.md`, `HANDOFF.md`, `TASK_LEDGER.md`, `handoffs/` | Session-cloud | 2026-07-24 | 2026-07-24 | 1h | Doc reconciliation + `handoffs/PHASE3_MERGE_PLAN.md`. Docs only, no source changes. |

---

## Free Paths (Ready to Check Out)

| Path | Last Owner | Est. Next Work | Notes |
|---|---|---|---|
| `courseforge/docs/PHASE3*.md` | Session-0 | None — locked | Signed off 2026-07-23. **Not** an M3.6 deliverable: M3.6 is canopy/trees (§7 of that document), not doc archival. |
| `courseforge/apps/web/lib/surfaces/` | Session-0 | Extensions (Phase 4+) | Stable, no changes expected soon |
| `courseforge/apps/web/lib/elevation/` | Session-0 | Extensions (Phase 4+) | Stable, no changes expected soon |
| `courseforge/apps/web/tests/` | Session-0 | M3.5's missing coverage | ⚠️ Claimed by the in-flight M3.6 session (`feature/m3.6-canopy`, unverified — the branch is not on `origin`). Coordinate before editing. PR #22 also lands a file here. |
| `courseforge/apps/web/components/` | Session-0 | UI polish, accessibility | Available for improvements |

---

## Check-Out Template

When starting a new task, update this ledger:

```markdown
| IN_PROGRESS | TASK-ID | primary/paths | @owner-handle | YYYY-MM-DD | YYYY-MM-DD | Xh | Brief context |
```

Then commit:
```bash
git add TASK_LEDGER.md && git commit -m "CheckOut: TASK-ID (owner, duration, context)"
```

---

## Check-In Template (Handoff)

When finishing a task, update ledger and create handoff:

1. Change status to ✅ COMPLETE
2. Update HANDOFF.md with new project state
3. Commit:
   ```bash
   git add TASK_LEDGER.md HANDOFF.md && git commit -m "CheckIn: TASK-ID (merged/ready for next)"
   ```
4. Paste the **Handoff Prompt** (from REFOCUS.md section "Handoff Template") into chat

---

## Conflict Resolution

If two tasks need the same path:
1. Check TASK_LEDGER.md for who is already there
2. Contact that owner (check `@handle` in row)
3. Coordinate via PR review, shared branch, or sequential handoff
4. Update ledger to reflect coordination (add `| Coordinated with TASK-ID` to Notes)

---

## Stale Task Recovery

If a task shows `IN_PROGRESS` but is no longer active (>24h without update):
1. Verify the branch is abandoned (check git log)
2. Contact the owner to confirm status
3. If no response, escalate to user
4. User can force-change status to FREE or mark as ABANDONED
