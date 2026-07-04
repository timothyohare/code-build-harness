# code-build-harness

An agentic code build harness: a loop of **Spec → Plan → Build → Validate → Review →
Simplify → Ship** where every quality claim is backed by a gate that exits non-zero
when the claim is false. Claude builds; a cross-family model reviews against the spec;
a cheap model judges the review; deterministic gates (tests, mutation testing, static
analysis, architecture rules) carry the guarantee. Priorities: quality > speed > cost.

**Full documentation: [docs/harness/README.md](docs/harness/README.md)** — evaluation,
ratified decisions register, architecture, metrics schema, and per-phase operating
manuals. Design produced from [docs/ideas.md](docs/ideas.md) via research → spikes →
convergence (2026-07-04/05).

## Layout

| Path | Purpose |
|---|---|
| `docs/harness/` | Design docs, decisions (D-1…D-20), phase guides, research |
| `harness/hooks/` | PreToolUse guardrails: role-based path protection, Bash guard |
| `harness/controller/` | Loop controller components (JSONL event emitter, …) |
| `metrics/events/` | Append-only JSONL event log (schema: docs/harness/metrics.md) |
| `openspec/` | Spec store + change bundles (OpenSpec) |
| `tests/` | Test-writer-owned; builders are blocked by hook + CI check |

## Trust model (enforced, not requested)

- **Local**: PreToolUse hooks block agent edits to protected paths by role
  (`.harness-role`, written by the loop controller). Human sessions are unaffected.
- **Server**: main is PR-only; the `guard` required check (runs the *base* branch's
  workflow via `pull_request_target`, so PRs cannot tamper with it) fails any PR
  touching `.github/**`, `harness/{hooks,controller}/**`, `.claude/**`, or
  `CODEOWNERS` without the `harness-config-approved` label, and any test-path change
  without `tests-approved`; CODEOWNERS requires human review. (Push rulesets and
  merge queue need an org-owned repo — see decisions.md amendment 2026-07-05.)

Note: `.claude/harness.json` maps gate-ci's `typecheck` slot to the unit tests until
TypeScript lands here (there is nothing to typecheck yet; the Stop-hook gate then
covers syntax + tests). Revisit when the controller gains TS.

## Status

M0 (foundations) in progress — see `docs/harness/architecture.md` for the M0–M5 build
order and exit criteria.
