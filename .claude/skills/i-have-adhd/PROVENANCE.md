# Provenance — `i-have-adhd`

Vendored from an upstream project. Recorded here so the local copy can be
audited and re-synced.

| | |
|---|---|
| Upstream | https://github.com/ayghri/i-have-adhd |
| Commit | `07684c4ab625dd7d1ea6e99e065f60bc0ac6a1ba` (2026-07-28) |
| Source path | `skills/i-have-adhd/SKILL.md` |
| Licence | MIT — © 2026 Ayoub Ghriss (`LICENSE`, copied verbatim) |

## Local modifications

The body of `SKILL.md` — all ten rules, the exception list, and the pre-send
check — is **unmodified**. Two frontmatter lines were changed so the skill
applies to every response instead of waiting for `/i-have-adhd`, because
`AGENTS.md` makes it mandatory project-wide:

| Field | Upstream | Local |
|---|---|---|
| `disable-model-invocation` | `true` | `false` |
| `description` | "Invoke with `/i-have-adhd`; stays on until 'stop adhd mode'." | "Mandatory for every response in this project (AGENTS.md); no invocation needed." |

Nothing else from the upstream repository is vendored. Its `hooks/`,
`scripts/`, `evals/`, and plugin manifests are deliberately **not** installed —
this project takes the formatting guidance only, not executable automation.

## Re-syncing

Diff the local `SKILL.md` body against upstream and re-apply the two frontmatter
changes above. If upstream adds rules that conflict with `AGENTS.md`, project
guidance wins — see the precedence note in `AGENTS.md`.
