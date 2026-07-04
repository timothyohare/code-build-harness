# Phase 3 — Build

> Goal: implement one planned task at a time, test-first, inside hard guardrails —
> in a loop that terminates on machine-checkable green, not on the agent's self-report.

## Entry

Plan-Ready passed. Worktree created for the change (isolation from any parallel loop).

## The two-agent protocol (test agent ↔ build agent)

The central structural decision (evaluation #10, Salesforce pattern 2): **the agent
that writes code never writes the tests that judge it.**

```
per task in tasks.md:
  1. TEST AGENT (fresh context, reads spec + test plan):
       writes failing test(s) for the task's acceptance criteria   → RED verified
  2. BUILD AGENT (fresh or continuing context, reads spec + plan + failing test):
       implements minimum code to pass                             → GREEN verified
  3. BUILD AGENT: refactor step (lint clean, no behavior change)   → still GREEN
  4. gate-ci (lint + typecheck + tests + architecture rules)       → exit 0 required
  5. commit (atomic save-point, conventional message, task ID)
```

- **RED verified** means the harness actually ran the test and saw it fail — TDD
  Guard-style runner-reporter state, not file presence. A test that passes before
  implementation is a spec/test bug and bounces back to the test agent.
- Builder ↔ test-agent communication is **written**: the builder appends to
  `memory/test-requests.md` when it believes a test is wrong or missing; the test
  agent processes requests in its own context. Disagreement escalates to human (Q10).

## Guardrails (enforced, not requested)

| Rule | Local mechanism | Remote backstop |
|---|---|---|
| Builder can't edit `tests/**`, `*.test.*`, fixtures | PreToolUse hook (spike 4, `artifacts/protect-tests.mjs`) — exit 2 blocks + redirect message | CI diff-check: test paths may only change in test-agent commits; CODEOWNERS |
| No edits to `.github/workflows/**`, branch/release config, secrets, `.claude/settings*.json`, hook scripts | PreToolUse hook | **Push ruleset** — blocks the push itself |
| TDD ordering (no implementation without failing test; no over-implementation; one test batch at a time) | TDD Guard | Mutation gate downstream catches decoration tests |
| Scope: touch only files the plan names | Post-edit hook warns on out-of-plan paths | Reviewer checks diff vs sprint contract |
| No destructive commands (`rm -rf`, force-push) | Pre-Bash hook denylist | Ruleset blocks force-push |

Hooks are "silent on success, verbose on failure" — a block message tells the agent
*what to do instead* (e.g., "write the needed test change to memory/test-requests.md"),
turning a hard stop into a handoff.

Local hooks are UX; the server-side layer is the actual guarantee — an agent with
shell access can `sed -i` around a file-path hook or edit its own hook config. Both
layers ship in v1.

## Context discipline

- Fresh context per task where practical; filesystem (the bundle, memory files) is the
  durable state, not the conversation ("models get worse at reasoning as context fills").
- Skills load progressively; static context stays small (AGENTS/CLAUDE.md kept lean —
  every line traceable to a past failure, ratchet-maintained).
- Model routing: frontier model builds; cheaper models handle mechanical steps
  (commit messages, log summarization) — quality-neutral cost lever.

## Exit gate

All tasks in `tasks.md` checked off, each with its verification command green, and
`gate-ci --full` (lint + typecheck + tests + build + architecture rules) exits 0 on
the whole change. Then → Validate phase (04).

## Metrics emitted

| Event | Fields |
|---|---|
| `build.task_started` / `task_green` | task_id, subtask, model, tokens, iterations |
| `build.gate_run` | task_id, gate, pass/fail, duration, failure_class |
| `build.guardrail_block` | task_id, rule, path, agent_role |
| `build.test_request` | task_id, request summary (builder→test-agent handoffs) |

**Iterations-to-green per task** is the headline metric of this phase.

## Failure / escalation

Per decision D-11: 3 consecutive reds on the same gate, or 5 total iterations on a
task → halt, write handoff note (what was tried, current hypotheses, blocking gate),
notify human. Guardrail-block attempts on protected paths escalate immediately
(that's an agent trying to do something categorically forbidden, not a quality issue).
