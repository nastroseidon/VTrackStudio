# REFOCUS: Before Every Council Decision or Scope Question

**Read this every time you are about to make a council submission, propose new work, or consider changing scope.**

---

## Core Purpose (Anchor)

```
"A course is a query, not an asset."

CourseForge reconstructs golf courses at build/load time from open geospatial 
data (OSM, Copernicus, ESA WorldCover). Neutral CoursePackage descriptor + 
separate packaged artifacts. Phase-gated: geometry → elevation → surfaces → 
integration.
```

**Your job is to execute the current phase milestone, not to redesign the system or add features beyond that milestone.**

---

## The Refocus Questions

Ask yourself these **before submitting council decisions or proposing new work**:

### 1. **Is This In The Current Milestone?**
- Check HANDOFF.md: What is the current milestone (M3.5, M3.6, etc.)?
- Is your proposed work explicitly in that milestone's definition?
- If NO → do not do it. Escalate to user.

### 2. **Is This Required For The Milestone To Land?**
- The milestone has a definition. Does this work block that definition from being true?
- If NO → it is nice-to-have. Nice-to-have is scope creep. Do not do it.

### 3. **Would I Do This If The User Didn't Ask?**
- Would you proactively refactor this code, add this test, improve this docs, or reorganize this structure?
- If YES → you are inventing work. Stop. Escalate to user.

### 4. **Does This Change Visible Behavior?**
- Does this change what the user sees in the app, what they can do, or what the package contains?
- If the answer is "only for future phases" → it is infrastructure speculation. Stop.

### 5. **Is There A Council Decision Here?**
- Is someone proposing a tradeoff, architecture change, or risky decision?
- If YES → score it (correctness 25%, safety 20%, testability 15%, rollback 10%, fit 10%, scope 10%, maintainability 5%, simplicity 5%).
- Score ≥85? Proceed to commit/push/PR.
- Score <85? Present to council before proceeding.

### 6. **Am I Adding Abstractions Or Helpers Before I Use Them?**
- Are you creating utility functions "for future use"?
- Are you splitting code "in case we need to reuse it later"?
- If YES → stop. Write the minimum that solves the current milestone. If a second use appears, refactor then.

### 7. **Is This Documented In HANDOFF.md Or TASK_LEDGER.md?**
- If your work affects paths listed in HANDOFF.md's "File Boundaries," is another task already checked out there?
- If YES → coordinate via the ledger or wait for that task to check in.
- If NO → update TASK_LEDGER.md to check out your path before starting.

### 8. **Am I Testing What Matters, Not What's Easy?**
- Are you writing tests that verify the actual user flow or contract the code claims?
- Or are you writing tests because it looks good to have high coverage?
- If you cannot run the app and see it working, the test suite alone does not prove success.

---

## Anti-Patterns: Stop If You See Yourself Doing This

| Anti-Pattern | Why It's Wrong | What To Do Instead |
|---|---|---|
| **"I'll add this config option for future flexibility"** | Future scenarios are speculation. You do not know what future code needs. | Hard-code the value. When the future arrives and needs to change it, change it then. |
| **"I'll refactor this to be more reusable"** | Three lines of similar code is not a pattern; one use is not reuse. | Copy the code. When you see a third use, refactor then. |
| **"I'll improve performance here because it might matter later"** | Premature optimization. No user complaint. No profile data. | Ship the slow version. If users hit it, profile and fix. |
| **"I'll add this test to improve coverage"** | A test that doesn't verify behavior the user cares about is noise. | Only test user-critical flows, contracts, and boundaries. |
| **"I'll add this type safety now"** | TypeScript already stops you. If the code is working, the types are good enough. | Commit what works. Add types when they prevent real bugs. |
| **"I'll reorganize the file structure to be 'cleaner'"** | Reorganizations are expensive, error-prone, and delay real work. | Keep the structure as-is. Move files when a real reason appears (too big, wrong layer). |
| **"I should add error handling for edge case X"** | If the edge case cannot happen (internal code, framework guarantees), do not handle it. | Only handle errors at system boundaries (user input, external APIs). Trust internal code. |
| **"Let me add comprehensive logging"** | Logging is a feature, not a fix. If you do not have a specific debugging problem, logging will not solve one. | Add logging when you are debugging a specific issue. Remove it once fixed (or leave it if you keep hitting it). |

---

## The "Am I In Scope?" Decision Tree

```
Start
  ↓
Is this in the current milestone definition (HANDOFF.md)?
  ├─ NO → STOP. Ask user.
  └─ YES → Continue
  ↓
Would I do this if it weren't explicitly asked?
  ├─ YES → STOP. This is invention. Ask user.
  └─ NO → Continue
  ↓
Does this change user-visible behavior or the final artifact?
  ├─ NO → Is it infrastructure for a future phase?
  │   ├─ YES → STOP. Speculation. Ask user.
  │   └─ NO → Continue (it's cleanup or docs for this phase)
  └─ YES → Continue
  ↓
Is the path already checked out by another task (TASK_LEDGER.md)?
  ├─ YES → Coordinate with that task. Do not proceed alone.
  └─ NO → Continue
  ↓
Can I test this locally in the app or in a deterministic test suite?
  ├─ NO → STOP. Untestable work is unmergeable work.
  └─ YES → Proceed with implementation
```

---

## Council Scoring Checklist

**Before submitting a decision to council, score it yourself first:**

| Dimension | Weight | Score | Reasoning |
|---|---|---|---|
| Correctness | 25% | /25 | Does it solve the problem? Are there edge cases? |
| Safety / Security | 20% | /20 | Any injection, auth, or data leak risks? |
| Testability | 15% | /15 | Can it be tested deterministically? Is test coverage clear? |
| Rollback | 10% | /10 | Can this be reverted without side effects? |
| Fit | 10% | /10 | Does it align with Automat principles and the current milestone? |
| Scope | 10% | /10 | Is this the minimum needed or has it crept? |
| Maintainability | 5% | /5 | Will future developers understand this? |
| Simplicity | 5% | /5 | Fewest lines, fewest dependencies, fewest concepts? |

**Total**: ___ / 100

- **≥85**: Submit with confidence. Score auto-proceeds to commit/push/PR (no council wait).
- **<85**: Present to council with this scorecard before proceeding.

---

## Handoff Template

When you complete a milestone and are about to hand off to the next task:

### 1. Update the Ledger
```bash
git add TASK_LEDGER.md HANDOFF.md && git commit -m "CheckIn: M[X]-[summary] ready for handoff"
```

### 2. Copy This Prompt Into Chat

Replace placeholders with actual values:

---

## HANDOFF: [MILESTONE] Complete

**From**: [Your Session ID]  
**To**: Next Task  
**Date**: [YYYY-MM-DD]  
**PR**: #[number] merged

### Current State
- **Milestone**: [M3.5 surface-layers API + UI]
- **Status**: ✅ COMPLETE and merged to main
- **Tests**: [e.g., 15/15 pass, Playwright E2E cleared]
- **Blockers**: None

### Implementation Summary
- **Files Changed**: [list key files]
- **Design Docs**: [reference any PHASE*.md changes]
- **New Endpoints**: [/api/surfaces/generate, etc.]
- **UI Updates**: [ProjectStatusRail "Generate Surface Layers" button, etc.]

### For The Next Task

**Do not do any of these**:
- Refactor the surfaces lib (Phase 4+ work)
- Add performance optimization (no profile data)
- Expand test coverage beyond the milestone (current coverage is sufficient)
- Reorganize file structure

**You should do**:
1. Read HANDOFF.md (this file) for governance, agents, skills, file boundaries
2. Check TASK_LEDGER.md and update your path to `IN_PROGRESS`
3. Run `npm run verify` to confirm the baseline
4. Refer to the milestone definition in the HANDOFF.md status table
5. When complete, repeat this handoff process

### Check Out Your Next Task
```bash
git checkout main && git pull origin main
git checkout -b feature/m3-6-[your-task]
# Update TASK_LEDGER.md
git add TASK_LEDGER.md && git commit -m "CheckOut: M3.6-[task] (owner, duration)"
# Start work
```

---

### Questions?
- Council scoring: Read the scorecard template above
- File ownership: Check HANDOFF.md "File Boundaries" section
- Toolkit: Use agents and skills listed in HANDOFF.md
- Conflicts: Update TASK_LEDGER.md and escalate to user

**Next milestone definition**: [Reference HANDOFF.md for M3.6 or later]
