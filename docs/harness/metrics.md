# Metrics & Event Schema

The harness is an experiment platform ("try new hypotheses, measure outcomes,
discover better ways to build") — which only works if every loop emits comparable
events. **The schema comes first** (D-12); dashboards and experiments hang off it.

## Event schema (JSONL, one event per line) — DRAFT for Q12 approval

```jsonc
{
  "ts": "2026-07-04T14:32:11Z",
  "run_id": "uuid",            // one loop execution
  "task_id": "CHG-0042",       // the change bundle ID
  "phase": "build",            // spec|plan|build|validate|review|simplify|ship|retro
  "event": "gate_run",         // per-phase event names in the phase docs
  "agent_role": "builder",     // builder|test-writer|reviewer|judge|controller|human
  "model": "claude-opus-4-8",  // null for human/deterministic events
  "tokens_in": 48211,
  "tokens_out": 3120,
  "cost_usd": 0.41,            // computed at write time from model pricing
  "duration_ms": 84000,
  "result": "fail",            // pass|fail|blocked|escalated|n/a
  "detail": {}                 // event-specific payload (gate name, findings, paths…)
}
```

Storage: `metrics/events/YYYY-MM.jsonl` in the harness repo (append-only, committed);
CI events uploaded as artifacts and merged nightly. Analysis: duckdb/jq — no platform
dependency until volume demands one.

## North-star metrics (ideas.md's four, plus two the research adds)

| Metric | Definition | Derived from | Direction |
|---|---|---|---|
| **Iterations-to-green** | gate_run events with result=fail before first all-green, per task | build/validate events | ↓ |
| **Cycle time** | wall time per stage and end-to-end (spec.approved → ship.merged) | phase timestamps | ↓ |
| **Human-touch count** | escalations + manual edits + review interventions per task | escalated results + review.human + guardrail escalations | ↓ over time, **by design not by neglect** |
| **Escaped defects** | post-merge bugs backlinked to task, with phase attribution | ship.escaped_defect | ↓, the ground truth |
| Cost per merged PR | Σ cost_usd per task_id that merged | all events | observe; cap per Q4 |
| Review efficacy | % reviewer findings accepted; seeded-bug catch rate | review.finding_outcome, validate.drill | ↑ |

## Metric ↔ gate wiring (what's enforced vs observed)

- **Gate-able now**: iteration caps (D-11), per-task budget (Q4), mutation break
  threshold, security severity threshold.
- **Trend-only**: cycle time, human-touch, cost trends, simplify LOC-delta.
- **Retro triggers**: escaped defect (attribution → harness investment), drill MISSED
  (new sensor owed), rule that never fires (pruning candidate).

## Attribution rules (decided up front because retrofitting is painful)

1. Every commit message carries `task_id`; every PR carries `run_id`(s).
2. AI-authored vs human-authored is recorded per commit (bot identity, Q15) — DORA
   metrics without attribution mislead once agents write most code.
3. Escaped defects get a one-of attribution: `spec-gap | plan-gap | build-bug |
   test-gap | review-miss | harness-gap`. First triage by a cheap model, confirmed at
   the weekly retro.
4. Model/prompt/skill versions are part of every event's context (`detail.versions`)
   so A/B experiments (swapping skills, D-20 experiments) are analyzable.

## Experiment protocol (how "try new hypotheses" works concretely)

1. Hypothesis written as a retro item ("swapping X for Y reduces iterations-to-green").
2. Variant recorded in `detail.versions`; run N tasks per arm (small N is fine —
   direction, not significance, at this scale).
3. Compare on the north-star table; quality metrics veto speed/cost wins
   (priority: quality > speed > cost).
4. Winner becomes the default; the experiment is archived with its data.

## The human-in → on → out dial, measured

Graduation is per change class and per phase, driven by this table (Q19 thresholds):

| Phase | Starts | Graduates when |
|---|---|---|
| Spec approval | human every time | ≥20 tasks, revision_count stable, no spec-gap defects |
| Plan approval | auto for low-risk | already partly graduated at v1 |
| Build | autonomous within caps | — (caps are the control) |
| Review | human every line | ≥30 merges, 0 escaped defects, stable finding density → 20% sampling |
| Simplify | autonomous | day 1 (D-18) |
| Ship/merge | human merge button | last to graduate; needs everything above stable |

Any escaped defect resets its class to full human involvement. "Out of the loop"
never means unmeasured — it means the human reads dashboards and retros instead of
diffs.
