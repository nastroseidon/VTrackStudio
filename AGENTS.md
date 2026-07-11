# VTrackStudio Agent Guide

## Purpose and repository layout

VTrackStudio is the parent workspace for the VTrack golf simulator ecosystem. It keeps course-authoring, neutral interchange data, shared design documentation, and Unreal integration separate so each can evolve and be verified independently.

- `courseforge/` contains CourseForge, the course-builder web app and its planned services and shared packages.
- `courseforge/apps/web/` is the active Next.js web application. Run all current npm commands from this directory.
- `courseforge/docs/` contains CourseForge product, provider, data-licensing, and CoursePackage documentation.
- `course-packages/` is reserved for generated and sample engine-neutral CoursePackage artifacts and fixtures.
- `docs/` contains architecture and pipeline documentation shared across CourseForge and the simulator.
- `unreal/` contains the Unreal simulator and Unreal-side integration work. The `CourseForgeImporter` is currently a placeholder for a future importer of neutral CoursePackages.

CourseForge must remain separated from Unreal project internals. CourseForge produces neutral packages; Unreal-side code translates those packages into simulator assets. Preserve source attribution and the Google-data guardrails documented in `courseforge/docs/`.

## Current web commands

Use the repository's npm lockfile. From `courseforge/apps/web/`:

```bash
npm ci                 # clean, reproducible dependency install
npm install            # use only when intentionally changing dependencies/lockfile
npm run dev            # local Next.js development server
npm run lint           # ESLint
npm run typecheck      # strict TypeScript check without build-info output
npm run test           # deterministic Vitest unit and integration tests
npm run test:watch     # Vitest watch mode
npm run test:browser   # Chromium Playwright tests at supported desktop viewports
npm run verify:fast    # routine lint, typecheck, tests, and production build
npm run verify         # complete verification, including browser tests
npm run build          # production build verification
npm run start          # serve an already-created production build
```

The app normally runs at `http://localhost:3000`. Copy `.env.example` to `.env.local` only when local environment configuration is needed. Never commit `.env.local`, print secret values, pass secrets into client code, or expose server-only provider keys. The app is expected to work with optional provider keys unset.

There is no root npm package; run npm scripts from `courseforge/apps/web/`. Use `npm run verify:fast` as the normal routine check and `npm run verify` as the complete pre-approval or pre-merge check. Playwright starts and stops its own local server.

## Required development workflow

1. Read the root `README.md`, the relevant area README, and relevant files in `docs/` and `courseforge/docs/` before editing.
2. Inspect `git status` before work. Preserve user changes and avoid modifying unrelated files.
3. For web work, inspect `courseforge/apps/web/package.json` and the affected source before choosing commands or dependencies.
4. Make the smallest scoped change that meets the request. Do not change visible behavior during infrastructure-only, documentation-only, or workflow-setup tasks.
5. Run the checks appropriate to every affected area. Web source changes normally require `npm run verify:fast`; use `npm run verify` when browser behavior is affected or before approval/merge.
6. For visible UI changes, run the app and verify the affected workflow in a real browser at relevant viewport sizes. Check browser console errors and warnings, failed network requests, loading/empty/error states, and interactions. Record screenshots when they help review the change.
7. Review the final diff and rerun `git status`. Report what changed, commands run and results, UI/browser evidence, limitations, and any follow-up work.

## Testing and verification expectations

- Do not weaken TypeScript, ESLint, or build settings to make checks pass.
- Add or update focused unit tests for deterministic logic and integration tests for boundaries such as API routes and provider normalization when test infrastructure is available.
- Add or update Playwright coverage for user-critical flows. The current configuration covers Chromium at 1440x900 and 1920x1080.
- `npm run verify:fast` runs lint, strict type checking, Vitest, and the production build. `npm run verify` adds Playwright and must exit nonzero on any failure.
- Browser automation should retain screenshots and traces on failure. Browser checks should fail on unexpected console errors and failed same-origin/API network requests, with explicit allowlists only for known intentional cases.
- Tests must be deterministic, must not require production credentials, and must use mock/local providers unless live integration testing is explicitly approved.
- If a required test layer does not exist, state that clearly in completion reporting; do not represent lint or build checks as test coverage.

## Docker and local tooling

The root `compose.yaml` and `courseforge/apps/web/Dockerfile` are development-only. They use environment-variable passthrough, contain no credential values, and health-check the local home page. Routine local image builds, `docker compose up --build`, `docker compose logs -f web`, `docker compose down` without volume deletion, status inspection, and log review do not require approval. Deleting images, databases, or volumes (including `docker compose down -v`) requires user approval.

Reusable VS Code tasks in `.vscode/tasks.json` invoke the same documented npm and Compose commands used in terminals rather than duplicating workflow logic.

## Git workflow

`main` is the stable branch. GitHub rulesets are configured for `main`, but GitHub does not enforce them for this private repository on the current plan. Treat this protected-style workflow as mandatory repository policy even when GitHub technically permits an action. In particular, a direct push to `main` is never acceptable merely because GitHub allows it.

Do not implement routine features, fixes, refactors, tests, or UI changes directly on `main`. Before beginning an implementation task:

1. Run `git status` and confirm the working tree is clean. If it is not clean, preserve the existing work and stop for user direction rather than switching branches or discarding changes.
2. Check out `main`.
3. Fetch `origin`.
4. Confirm local `main` is current with `origin/main`.
5. Create and check out a short, descriptive task branch using exactly one of these forms:
   - `feature/<short-description>`
   - `fix/<short-description>`
   - `test/<short-description>`
   - `chore/<short-description>`

Additional Git requirements:

- Keep commits focused and do not mix unrelated cleanup with requested work.
- Run `npm run verify` from `courseforge/apps/web/` before presenting implementation work as merge-ready.
- Stop before committing unless the user explicitly approved committing.
- Do not push, open a pull request, merge, or delete a branch without explicit user approval.
- Always stop before merging into `main`, even when earlier approval covered committing, pushing, or opening a pull request.
- Prefer **Squash and merge** for GitHub pull requests.
- Do not rewrite history, force-push, discard user changes, or use destructive Git commands without explicit approval.
- Never commit secrets, local environment files, generated dependency folders, `.next/`, logs, or Unreal generated directories.

At completion, report:

- current branch;
- files changed;
- commits created, or state that none were created;
- verification commands and results;
- recommended commit message;
- recommended pull request title;
- recommended pull request description.

## Approval boundaries

User approval is required before:

- production changes or access to production systems or data;
- destructive actions, including deleting databases, volumes, user data, or uncommitted work;
- reading, copying, exposing, rotating, or changing credentials or secrets;
- billing, paid-service, account, authentication, authorization, or permission changes;
- deployment, publishing, DNS, hosted infrastructure, or production configuration changes;
- major architectural changes, cross-system redesigns, or major dependency upgrades;
- enabling or implementing live external providers when terms, licensing, endpoint contracts, or costs are not already approved;
- pushing, merging, or otherwise changing remote Git state.

Routine local editing, dependency installation from the existing lockfile, linting, type checking, builds, tests, local browser checks, non-destructive Docker startup/shutdown, status and log review, and documentation updates do not require approval when they remain within the requested scope and do not expose secrets or change production state.

When a requested task reaches an approval boundary, finish all safe local assessment work, then present the proposed files, exact commands, dependency changes, architectural implications, and risks. Stop and wait for approval before crossing that boundary.

## Completion reporting

Every completion report must include:

- a concise summary of changed behavior and files (or state explicitly that behavior did not change);
- verification commands run and whether each passed, failed, or was unavailable;
- UI verification performed, including browser/viewport coverage and console/network findings, or why it was not applicable;
- Docker checks performed or why they were not applicable;
- known limitations, skipped checks, risks, and follow-up work;
- confirmation that no secrets were exposed and no production, deployment, billing, authentication, destructive, or remote Git actions were taken, when relevant.

Never report a task complete while required checks are failing or silently skipped. If blocked, report the exact blocker and the evidence gathered.
