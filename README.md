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
| `harness/controller/executors/` | Claude, Codex, and role-routing adapters |
| `harness/review/` | Bounded review packages, schema validation, finding routing |
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

## Two-family execution

The live build loop routes `test-writer` to an ephemeral Codex CLI process and
`builder` to a fresh Claude CLI process. GREEN and CI failures return directly to
the builder; mutation-strengthening failures remain with the test writer.

Run an independent Codex review by piping a JSON evidence object containing `spec`,
`plan`, `diff`, `tests`, `gates`, and optional `disagreements` fields:

```sh
node harness/review/run-review.mjs < review-evidence.json
```

The command exits 2 for insufficient context, malformed output, or any blocking
high-confidence finding. Codex test-writing sessions are read-only: they return
schema-constrained full-file proposals, and the harness applies them only after
validating test ownership, repository containment, symlinks, duplicates, and size.
CI protected-path checks remain the authoritative remote backstop.

`createDeliveryLoop` composes deterministic build validation with
`createReviewLoop`: review starts only after the build is green. The review loop
routes coverage corrections to Codex before routing implementation corrections to
Claude, runs owner-specific gates, rebuilds the evidence, and asks a fresh reviewer
again. It persists state under `memory/review-state/` and writes a human handoff on
insufficient context, malformed output, critical findings, failed correction gates,
or the review-round cap.
