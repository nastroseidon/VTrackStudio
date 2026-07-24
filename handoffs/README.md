# Handoff Prompts Registry

This directory stores handoff prompts between completed milestones and the next task. Each handoff includes current project state, scope definition, governance rules, and instructions for the next task.

## How to Use

When starting a new task:
1. Read `../README.md` → "For New Tasks" section
2. Read `../CODEX_BRIEF.md` (structure + governance)
3. Read `../HANDOFF.md` (current state + rules + agents)
4. Read `../TASK_LEDGER.md` (check if your path is free)
5. Read `../REFOCUS.md` (scope focus + anti-patterns)
6. **Read the current handoff prompt** (see below)

---

## Current Handoff

**Milestone**: M3.5 → M3.6  
**Date**: 2026-07-24  
**File**: [M3.5-to-M3.6.md](M3.5-to-M3.6.md)  
**Status**: Ready for M3.6 finalization (Phase 3 docs + Phase 4 roadmap)

→ **Next task starts here**: Read [M3.5-to-M3.6.md](M3.5-to-M3.6.md)

---

## Handoff History

| From | To | Date | File | Status |
|---|---|---|---|---|
| M3.5 | M3.6 | 2026-07-24 | [M3.5-to-M3.6.md](M3.5-to-M3.6.md) | 🟢 Active |

---

## Handoff Maintenance

When a milestone completes:
1. Create new file: `handoffs/M[X]-to-M[X+1].md` (copy template from most recent)
2. Update `Status` column in this README
3. Update `## Current Handoff` section above
4. Commit to main: `git add handoffs/ && git commit -m "CheckIn: M[X] complete, M[X+1] handoff ready"`

**Template** (copy from latest handoff file):
- Current project state (completed milestones, implementation summary)
- M[X+1] scope definition (in-scope, out-of-scope, deliverables)
- First-steps checklist
- Governance rules (TL;DR)
- Data sources table
- Agents & skills for this milestone
- Work plan outline
- Quick links
- Session info (user, runtime, date)
