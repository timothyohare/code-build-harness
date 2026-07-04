# Phase 5 — Review

> Goal: an independent judgment that the change satisfies the spec — from a reviewer
> whose blind spots don't overlap the builder's. Review is the first stage to strain
> at agent speed; everything here is designed to keep it viable.

## Entry

Validate stack green. PR opened by the loop (bot identity, Q15) with the compact
review package attached.

## The review chain (decision D-3)

Evidence-based shape — **one strong cross-family reviewer + one cheap judge**, never a
committee (heterogeneous teams underperform their best member by up to 37.6%; extra
rounds add noise, not signal):

```
1. PRIMARY REVIEW — cross-family model (Gemini per Q5), FRESH session:
     input:  compact review package = spec + plan + tasks + diff briefs (markdown)
     contract: review AGAINST THE SPEC, five axes
               (correctness, readability, architecture, security, performance)
     output: findings with confidence scores; findings < 70 confidence hidden
     escape hatch: "context insufficient" flag → rerun with full package
2. JUDGE — cheap model (Haiku-class):
     scores the REVIEW (not the code) against a rubric with randomized ordering
     and numeric anchors; low score → rerun review or escalate
3. FREE EXTRA SIGNALS — Copilot code review on the PR (GitHub-native), advisory only
4. HUMAN — Tim reviews per current autonomy tier (v1: every line of non-chore changes)
```

Design rules baked in, from the LLM-as-judge failure-mode literature:

- **Different model families** for builder and reviewer; never let the builder's
  family judge itself (self-preference bias).
- **Fresh session** — same-session self-review approves its own work
  (same-session anchoring).
- **Judge scores the review, not the code** — cheaper, and measurably reduces
  position bias when combined with randomized rubric ordering.
- **Verbosity/sycophancy guards**: the reviewer gets the spec and the diff, not the
  builder's self-description of the change.
- LLM reviews are **additive** — the deterministic Validate stack is the layer that
  actually carries the guarantee (homogenisation trap).

## What the review checks beyond the diff

- **Sprint-contract conformance**: diff scope vs plan (out-of-scope hunks flagged —
  surgical-changes rule).
- **Coverage matrix closure**: every spec requirement's verification command ran and
  passed (from the Plan phase artifact).
- **Trajectory**: the gate-event log for this change is complete — no skipped steps.

## Human review and graduation

v1: human reviews everything except `docs/chore` class. Graduation (Q19): per change
class, ≥30 merged changes with zero escaped defects and stable finding density →
sampling at 20%; any escaped defect resets to 100%. The end state is not zero human
review — it's human attention directed where machines can't judge (business logic,
authorization design, "should we build this at all").

Comprehension-debt guard: the human review artifact includes a one-paragraph
explanation of the change *written by the reviewer model, verified by Tim* — if you
can't endorse the explanation, you don't merge ("I won't commit code I couldn't
explain" — Willison).

## Metrics emitted

| Event | Fields |
|---|---|
| `review.primary` | task_id, model, findings_count by severity, confidence dist, context_sufficient |
| `review.judge` | task_id, rubric_score, verdict |
| `review.human` | task_id, decision, findings_added, minutes_spent |
| `review.finding_outcome` | finding_id, accepted/rejected/false_positive |

Watch: **% findings accepted** (reviewer efficacy), human minutes per PR (the review
bandwidth ceiling — if this climbs while PRs/day climbs, the ceiling is near),
reviewer efficacy over time via seeded-bug injection.

## Failure / escalation

- Blocking findings → back to Build with findings as input (counts toward caps).
- Judge scores the review below threshold twice → escalate to human with both
  reviews attached.
- Builder disputes a finding → written rebuttal in the bundle; human arbitrates.
