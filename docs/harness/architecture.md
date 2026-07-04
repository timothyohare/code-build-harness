# Reference Architecture & Build Order

## The system at a glance

```
┌─ LOCAL (inner loop — fast, feedforward + feedback) ────────────────────────┐
│                                                                            │
│  Loop Controller (per change, in a git worktree)                           │
│   │  reads/writes: OpenSpec change bundle + memory files (durable state)   │
│   │  emits: JSONL events (metrics.md schema)                               │
│   │                                                                        │
│   ├── SPEC ──► spec-ready gate ──► human approval                          │
│   ├── PLAN ──► plan-ready gate                                             │
│   ├── BUILD ─► test-agent (owns tests/**) ⇄ build-agent (blocked from it)  │
│   │            PreToolUse hooks · TDD Guard · gate-ci (Stop hook)          │
│   ├── VALIDATE ► gate-ci --full · gate-verify · arch rules · Semgrep/      │
│   │              Gitleaks/Trivy · mutation (diff-scoped)                   │
│   ├── REVIEW ─► cross-family reviewer (fresh ctx) ► judge ► human          │
│   ├── SIMPLIFY ► behavior-preserving pass, gates re-run                    │
│   └── escalation: caps (D-11) ► handoff note ► notify human                │
│                                                                            │
└───────────────┬────────────────────────────────────────────────────────────┘
                │ push (agent bot identity)
┌─ GITHUB (outer loop — slow, tamper-proof, "CI is law") ────────────────────┐
│  Push rulesets: workflows/·harness config/·hooks/·CODEOWNERS = untouchable │
│  PR: required checks (rerun everything) · test-path diff-check ·           │
│      Copilot review (advisory) · CODEOWNERS review · SARIF → code scanning │
│  MERGE QUEUE ► merge ► bundle archived with metrics                        │
│  Nightly: mutation full · CodeQL · ZAP/Nuclei/Schemathesis · TruffleHog ·  │
│           nmap ports-diff — vs ephemeral staging                           │
└───────────────┬────────────────────────────────────────────────────────────┘
                │
        RETRO / RATCHET: failures → rules/gates (with pruning) → experiments
```

Two framing principles govern every component (Böckeler/Osmani, whitepaper):
**Agent = Model + Harness** — behavior is mostly configuration; and every component
is either a **feedforward guide** (specs, skills, rules, ADR-linked arch rules) or a
**feedback sensor** (gates), placed as far left as its cost allows — computational
sensors (ms, deterministic) pre-commit, inferential sensors (LLM, slow) post-build.

## What already exists (spike 1) vs what gets built

| Layer | Exists | Build |
|---|---|---|
| Gates | gate-ci (Stop hook), gate-verify, gate-perf, harness.json binding | mutation gate, security gates, arch-rules in lint |
| Skills | Full agent-skills loop (/spec…/ship), sdlc orchestrator | swap /spec → OpenSpec; loop controller that drives phases |
| Hooks | Stop → gate-ci only | PreToolUse role guard (spike 4 artifact ready), TDD Guard, Bash denylist |
| Spec | — | OpenSpec init (spike 2 verified) |
| GitHub | gh authenticated; no repo yet | repo, rulesets, CODEOWNERS, merge queue, Actions workflows |
| Metrics | — | JSONL emitter in controller + gates |
| Agents | single-agent Claude Code | test-agent role, reviewer/judge integration |

## Build order (each milestone usable on its own; harness built via its own loop ASAP)

**M0 — Foundations (blocked on Q1–Q4).** Repo + rulesets + CODEOWNERS + merge queue;
OpenSpec init; JSONL event emitter; copy `artifacts/protect-tests.mjs` into
`harness/hooks/` and wire PreToolUse. *Exit: a trivial change flows spec→merge with
events logged and protected paths physically untouchable.*

**M1 — The guarded inner loop.** Loop controller (phase state machine + caps D-11 +
handoff notes); test-agent/build-agent protocol with RED-verified TDD (TDD Guard);
CI diff-check on test paths. *Exit: a real feature built by the two-agent protocol;
iterations-to-green measured.*

**M2 — Grade the graders.** StrykerJS incremental gate + survivor-feedback loop;
Semgrep/Gitleaks/Trivy per-PR; eslint-boundaries with ADR-linked rules. *Exit: a
seeded weak test is caught by mutation gate (first drill).*

**M3 — Independent judgment.** Reviewer package builder (spec+plan+diff briefs);
cross-family reviewer + judge integration (Q5 models); Copilot on PR; simplify phase
automated. *Exit: review chain runs end-to-end; finding-outcome metrics flowing.*

**M4 — Deep verification.** Nightly workflow: mutation full, CodeQL, ZAP baseline →
active, Nuclei, Schemathesis, TruffleHog, ports-diff vs ephemeral staging; SARIF →
code scanning; per-release security summary. *Exit: nightly runs green ≥1 week;
findings triage path exercised.*

**M5 — The dial.** Metrics dashboard (duckdb queries are enough); graduation rules
(Q19) wired; retro cadence + experiment protocol live; first A/B (e.g., reviewer
model swap). *Exit: first graduation decision made from data, not vibes.*

## Component inventory (target repo layout)

```
code-build-harness/
├── openspec/            # spec store + change bundles + archive
├── harness/
│   ├── controller/      # loop state machine, caps, escalation, event emitter
│   ├── hooks/           # protect-tests.mjs, bash-denylist, tdd-guard config
│   ├── gates/           # mutation, security, arch wrappers (extend ~/.claude/bin)
│   └── review/          # package builder, reviewer/judge prompts + rubrics
├── .github/workflows/   # PR checks, nightly deep pass  [push-ruleset protected]
├── metrics/events/      # JSONL
├── docs/                # this documentation + ADRs
└── CODEOWNERS           # tests/** → human; harness/** → human
```

## Trust model (who can touch what)

| Path | Builder | Test agent | Controller | Human |
|---|---|---|---|---|
| `src/**` | ✅ | ❌ | — | ✅ |
| `tests/**`, fixtures | ❌ hook+CI | ✅ | — | ✅ |
| shared config (tsconfig, vitest.config) | ask-first | ask-first | — | ✅ |
| `.github/workflows/**`, hooks, harness config, CODEOWNERS | ❌ push-ruleset | ❌ | ❌ | ✅ (bypass list) |
| `openspec/**` bundles | ✅ own change | ✅ own change | ✅ | ✅ |
| `metrics/events/**` | append-only via controller | same | ✅ | ✅ |
