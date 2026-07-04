# Spike Results (2026-07-04)

Hands-on checks of candidate tooling, run in the session scratchpad. Each spike answers a concrete feasibility question for the harness.

## Spike 1 — Environment inventory (what already exists)

**Question:** How much harness already exists locally that we can build on?

**Findings:**
- `~/.claude/bin/` already contains a working gate layer: `gate-ci.mjs` (lint+typecheck+test, wired as a **Stop hook** so an agent turn cannot end red), `gate-verify.mjs` (boot-and-verify with mocked AWS), `gate-perf.mjs` (latency baseline), `harness-resolve.mjs`. Per-repo binding via `<repo>/.claude/harness.json`.
- The `agent-skills@addy-agent-skills` plugin is installed — it provides the exact target loop as skills: `/spec`, `/plan`, `/build`, `/test` (TDD), `/review`, `/code-simplify`, `/ship`, plus `sdlc` orchestrator skill that chains plan → test-first → CI → review → boot-and-verify, halting at the first failed gate.
- Only one hook currently wired: `Stop → gate-ci.mjs`. No PreToolUse guardrails yet.
- Tools present: Node 24, Python 3.12, gh CLI 2.45 (authenticated), Docker 27. **Missing:** semgrep, nmap, no mutation-testing tools installed yet.
- The project directory itself is **not yet a git repo**.

**Implication:** The v1 harness is an *extension* of what exists (add guardrail hooks, test-ownership separation, mutation gate, GitHub Actions outer loop, metrics), not a greenfield build.

## Spike 2 — OpenSpec CLI

**Question:** Does OpenSpec install and what does it actually scaffold?

**Findings:**
- Correct package is `@fission-ai/openspec` (v1.5.0) — plain `openspec` on npm is a squatted 0.0.0 package. `npx -y @fission-ai/openspec@latest init --tools claude <path>` works non-interactively.
- Scaffolds: `openspec/config.yaml` + Claude-native artifacts — 5 slash commands (`/opsx:propose`, `apply`, `explore`, `sync`, `archive`) and 5 matching skills. Change lifecycle: propose → apply → archive, with per-change bundles (proposal/specs/design/tasks) that archive into main specs.
- Supports ~30 agent tools (claude, gemini, github-copilot, cursor, …) from one spec store — good fit for a multi-LLM harness since all agents can share one spec source of truth.
- Also has `schema` (experimental workflow schemas) and `doctor` (relationship health) commands worth exploring later.

**Implication:** OpenSpec is a credible spec backbone; it layers onto Claude Code without conflicts. Open question: overlap with agent-skills' `/spec` skill — pick one canonical spec format.

## Spike 3 — Mutation testing (mutmut on Python)

**Question:** Do the mechanics of mutation testing work in an agent loop, and what are the gotchas?

**Setup:** Tiny `clamp()` function + 3 pytest tests giving 100% line coverage. `mutmut run` via venv.

**Findings:**
- Fast: 62 mutations/sec on the toy example; generated 2 mutants for a 6-line function; both **survived** despite 100% line coverage.
- The survivors were `v < lo → v <= lo` and `v > hi → v >= hi` — **equivalent mutants** (at the boundary both branches return the same value). No test can ever kill them.
- mutmut 3.x config key renamed (`paths_to_mutate` → `source_paths`); pin versions in the harness.

**Implications:**
1. Mutation testing genuinely measures test strength beyond coverage — it's the right "grade the tests" gate.
2. **A 100% mutation-kill gate is wrong** — equivalent mutants exist even in trivial code. The gate needs a threshold + a triage path (agent or human marks mutants as equivalent, and that triage itself needs review since a build agent could game it).
3. Cost scales with codebase and test runtime — needs incremental mode (mutate changed files only) in the inner loop; full runs nightly. Stryker (`@stryker-mutator/core` 9.6.1) has `--incremental` for JS/TS.

## Spike 4 — Role-based guardrail hook (PreToolUse)

**Question:** Can we enforce "build agent can't change the tests" (ideas.md line 14) and "never edit CI/workflows/secrets" (line 20) mechanically?

**Setup:** 30-line Node PreToolUse hook: reads tool-call JSON on stdin, blocks Edit/Write/MultiEdit to protected paths (`tests/`, `*.test.*`, `*_test.py`, `.github/workflows/`, `.claude/settings*.json`) unless the current role (from a `.harness-role` file the orchestrator controls) is `test-writer`. Exit 2 blocks the call and feeds the reason back to the agent.

**Results (all pass):**
| Scenario | Expected | Got |
|---|---|---|
| builder edits `src/app.ts` | allow | rc=0 ✅ |
| builder edits `tests/app.test.ts` | block | rc=2 + explanatory message ✅ |
| builder edits `.github/workflows/ci.yml` | block | rc=2 ✅ |
| test-writer edits `tests/app.test.ts` | allow | rc=0 ✅ |

Artifact: `scratchpad/hook-spike/protect-tests.mjs` (copy into `harness/hooks/` when we scaffold the repo).

**Implications:**
- Deterministic role separation is trivially enforceable at the tool-call layer — no reliance on prompt obedience.
- The block message can *redirect* the agent ("record the needed test change in memory/test-requests.md") — turning a hard stop into a handoff protocol.
- Defense in depth still needed: hooks stop the agent's tool calls, but `Bash(sed -i ...)` could bypass file-path checks → also enforce at the outer loop (GitHub push rulesets / CODEOWNERS / CI check that test files only change in test-writer-authored commits).

## Spike 5 — GitHub outer loop readiness

**Question:** Is the GitHub side ready for an Actions-based outer loop?

**Findings:** `gh` 2.45 authenticated as timothyohare. Docker available for act-style local runs or containerized gates. Not yet exercised: repo creation, branch protection/rulesets, required checks, merge queue — deferred until the harness repo exists (needs a decision on repo location/visibility, see QUESTIONS.md).

## Overall spike verdict

Every mechanically-risky idea in ideas.md is feasible with current tooling. The two places needing design care rather than tooling: (1) mutation-score gate policy (equivalent mutants), (2) bypass-resistance of role separation (hook + outer-loop double enforcement).
