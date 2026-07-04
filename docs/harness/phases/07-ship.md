# Phase 7 — Ship

> Goal: merge and release through server-side machinery that no agent can bypass,
> close the audit trail, and feed the loop's lessons back into the harness (the
> ratchet). "Faster is safer" — small increments through a hard pipeline beat big
> releases through a soft one.

## Entry

Simplify exit gate green; human review decision recorded per current autonomy tier.

## The merge path (all server-side, all tamper-proof)

```
PR → required status checks (rulesets)      ← identical for human & agent PRs
   → required review (CODEOWNERS)           ← tests/**, workflows, harness config
   → MERGE QUEUE                            ← serializes concurrent agent PRs,
                                              re-runs checks against merged state
   → merge → archive the change bundle      ← OpenSpec archive/YYYY-MM-DD-<change>/
                                              with the loop's metrics attached
```

- **Merge queue from day 1** (Q14): two individually-green agent PRs can conflict
  semantically; the queue re-validates against the merged state. Retrofitting merge
  semantics later is worse than paying now.
- **Push rulesets** are the outermost wall: `.github/workflows/**`, branch/release
  config, CODEOWNERS, hook scripts, `.claude/settings*.json` — pushes touching these
  are blocked outright regardless of branch, with a human-only bypass list. This is
  ideas.md line 20 ("never edit CI or workflow, branch and release config or
  secrets") made physical.
- **Bot identity** (Q15): agent PRs authored by a machine identity so
  "required review" retains meaning — the human approval is genuinely independent.

## Release mechanics

- Feature flags for anything user-visible; staged rollout; documented rollback per
  change (`design.md` carries the rollback note).
- Release notes generated from the archived bundles (cheap model — routing).
- Security summary per release (Q16): SARIF findings digest for the "Security team."

## Closing the audit trail

The archived bundle is the unit of audit: spec + plan + diffs + every gate event +
review artifacts + human decisions, timestamped. Trajectory completeness is checked
at Ship — a change whose log shows a skipped gate does not merge, even if green.

## The retro step (the ratchet) — what makes the harness self-improving

After merge, per Q20 cadence (auto-note per escalation + weekly human skim):

1. **Every failure becomes a candidate rule**: guardrail blocks, escalations, review
   findings the gates missed, escaped defects → each proposes a new gate, hook, or
   AGENTS.md line. Every line traces to a specific failure.
2. **Pruning discipline**: rules-file stays small (~60 lines); a rule that hasn't
   fired in N weeks is a removal candidate. Gates get the same treatment — coherence
   review so guides/sensors don't contradict.
3. **Escaped defects** are attributed backward: which phase should have caught it
   (spec gap / build bug / test gap / review miss)? That attribution drives where the
   next harness investment goes.
4. **Experiments**: skill/model/prompt swaps are proposed here, run as A/B on
   subsequent tasks, judged on the metrics (that's ideas.md's "try new hypotheses" —
   made concrete by the event log).

## Metrics emitted

| Event | Fields |
|---|---|
| `ship.merged` | task_id, queue_time, checks_rerun_result |
| `ship.released` | task_id, flag, rollout_stage |
| `ship.escaped_defect` | defect_id, task_id backlink, phase_attribution |
| `retro.rule_added` / `retro.rule_pruned` | rule_id, source_failure_id |

**Escaped defects** is the ground-truth quality metric every other metric proxies.

## Failure / escalation

- Merge-queue check failure → PR bounced back to Build with the merged-state failure.
- Rollback executed → automatic retro entry + the change class resets to 100% human
  review (graduation reset, Q19).
