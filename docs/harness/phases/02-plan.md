# Phase 2 — Plan

> Goal: turn an approved spec into small, ordered, independently verifiable tasks, and
> lock the done-conditions **before** any code exists so scope drift is detectable.

## Entry

Spec passed the Spec-Ready Bar and has human approval (phase 01 exit gate).

## Process

1. **Design note** (`design.md` in the change bundle): technical approach, affected
   modules, data changes, rollout implications. Reference relevant ADRs; if the plan
   would violate an architecture rule, the plan must say so and propose the ADR change
   *first* (rules are ask-first tier, not builder-editable).
2. **Task breakdown** (`tasks.md`): thin vertical slices, each with:
   - Acceptance criteria traced back to specific spec requirements (EARS IDs)
   - A concrete verification command per task ("done means this exits 0")
   - Expected diff size — target **≤ ~100 changed lines** per task; larger tasks get
     split. Small diffs keep the review stage viable at agent speed.
   - Dependency order (what blocks what)
3. **Sprint contract** (Osmani): the done-conditions for the whole change are
   enumerated and frozen here. Build-phase output is judged against this list;
   anything not on it is out of scope (surgical-changes guardrail).
4. **Test plan skeleton**: which levels of the pyramid this change touches
   (target shape 80/15/5 unit/integration/e2e), which test files the **test agent**
   will create/modify. This is the handoff artifact to the test agent — the builder
   never writes to those paths.
5. **Risk class assignment** (Q11): v1 rule is path-based — `docs/chore` vs
   `everything else`. Determines gate depth downstream.

## Exit gate: Plan-Ready check

Automated:
- [ ] Every task has a verification command
- [ ] Every spec requirement is covered by ≥1 task (coverage matrix)
- [ ] No task exceeds the size target without an explicit split-waiver note
- [ ] Test plan names owners: test-agent files vs builder files, no overlap
- [ ] Dependency order is acyclic

Human: **ask-first tier only** — the plan is auto-approved if the automated check
passes and the change is low-risk; Tim reviews plans for `everything else` class in
v1. (Spec got the hard human gate; duplicating it here adds latency, not safety —
scope drift is caught by the sprint contract at review time.)

## Enforcement

- Loop controller blocks Build until Plan-Ready passes.
- The coverage matrix (requirement → task → verification command) is written into the
  bundle; the Review phase re-checks it (did every requirement's command actually run
  and pass?).

## Metrics emitted

| Event | Fields |
|---|---|
| `plan.created` | task_id, model, tokens, n_tasks, est_total_lines |
| `plan.ready_check` | task_id, pass/fail, failed_criteria[] |
| `plan.approved` | task_id, approver (human/auto) |

Watch: planned-vs-actual task count and diff size (planning calibration); tasks that
later needed re-planning (plan-quality proxy).

## Failure / escalation

- Plan-Ready fails 3× → escalate with the coverage matrix gaps highlighted.
- Mid-build discovery that the plan is wrong → builder writes a re-plan request to
  the bundle (it cannot silently expand scope); loop returns to this phase.

## Options considered

| Option | Verdict |
|---|---|
| tasks.md checklist in the OpenSpec bundle | **Chosen** — one artifact store, agents already read it |
| Issue-tracker tasks (Linear/GitHub Issues) | Defer — adds an integration; revisit when parallel loops need a board |
| No separate plan phase (spec → build directly) | Rejected — sprint contract + coverage matrix are the anti-scope-drift and anti-"80% problem" mechanisms |
