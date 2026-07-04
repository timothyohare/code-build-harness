# Phase 1 — Spec

> Goal: a specification good enough that an agent can implement and verify it
> **without guessing**. This phase carries more leverage than any other: iterations-to-green
> is mostly a function of spec quality, and agents can't absorb ambiguity in hallway
> conversations the way humans can.

## Entry

A raw idea, bug report, or feature request. No entry gate — anything can start a spec.

## Process

1. **Interview/refine** (optional, for vague ideas): `interview-me` / `idea-refine`
   style questioning until intent is clear. Surface assumptions explicitly
   (Karpathy: "models make wrong assumptions on your behalf and run with them").
2. **Draft the change proposal** as an OpenSpec-style bundle (decision D-2):
   - `proposal.md` — rationale and scope (what and why, not how)
   - `specs/` — requirements as **EARS-format** statements with scenarios
   - `design.md` — technical approach (filled during Plan phase)
   - `tasks.md` — implementation checklist (filled during Plan phase)
3. **Cover the six core spec areas** (good-spec): commands, testing expectations,
   project structure touched, code style pointers, git workflow, and **boundaries** —
   the three-tier autonomy table for this change (always-do / ask-first / never-do).
4. **Mark unknowns** with `[NEEDS CLARIFICATION]` — the readiness gate blocks on them.

### EARS requirement format

Each requirement collapses to one testable claim:

```
WHEN <trigger> [IF <precondition>] THE SYSTEM SHALL <response>
```

Bad: "Handle login errors gracefully."
Good: "WHEN a login attempt fails 3 times within 5 minutes, THE SYSTEM SHALL lock the
account for 15 minutes and return HTTP 423."

## Exit gate: the Spec-Ready Bar (Definition of Ready)

Two layers, mirroring the whole harness philosophy (machine check + human judgment):

**Automated check** (LLM-assisted, cheap model):
- [ ] Every acceptance criterion maps to at least one concrete verification command
      or test scenario (testability check)
- [ ] Scope boundaries stated (what is explicitly out of scope)
- [ ] Zero unresolved `[NEEDS CLARIFICATION]` markers
- [ ] Boundaries table present (three-tier)
- [ ] Requirements in EARS form where behavior has test-shaped consequences

**Human approval** (Q8): Tim approves every spec in v1. This is the deliberate
human-in-the-loop anchor; it is also the first candidate for graduation once metrics
justify it. Passing DoR means *understood*, not *approved* — the human step is the
approval.

Keep the bar small (3–5 automated criteria). An over-heavy DoR recreates waterfall
stage-gates (Mountain Goat warning) — the aim is "just enough."

## Enforcement

- The loop controller refuses to start Plan/Build on a spec that hasn't passed the bar
  (gate exits non-zero → phase can't advance).
- Spec files are the review contract downstream: the reviewer reviews **against the
  spec**, not against vibes ("The Specification as Quality Gate").

## Metrics emitted

| Event | Fields |
|---|---|
| `spec.drafted` | task_id, model, tokens, wall_time |
| `spec.ready_check` | task_id, pass/fail, failed_criteria[] |
| `spec.approved` | task_id, human, revision_count |

Watch: revision_count before approval (spec-quality proxy), and downstream
iterations-to-green per spec author/model — the feedback loop that improves this phase.

## Failure / escalation

- Automated check fails → agent revises, max 3 attempts, then escalate with the
  failing criteria listed.
- Spec drift discovered later (implementation diverged) → retro item; the archived
  spec is corrected before the change is archived (OpenSpec archive step).

## Options considered

| Option | Verdict |
|---|---|
| OpenSpec bundle | **Chosen** — brownfield-friendly deltas, 30-agent support, spike-verified |
| GitHub Spec Kit | Heavier ceremony; governance model we don't need at n=1 |
| Kiro | IDE lock-in |
| In-house schema | Avoid until OpenSpec demonstrably doesn't fit the gates |
