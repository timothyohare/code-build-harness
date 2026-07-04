# Phase 6 — Simplify

> Goal: reduce the change to its minimum honest form **without changing behavior**.
> Agents overcomplicate by default (speculative abstraction, defensive bloat,
> orthogonal "improvements"); this phase is the systematic counterweight.

## Entry

Review findings resolved; deterministic gates still green.

## Why a dedicated phase (not folded into Review)

- Review asks "is it correct and safe?"; Simplify asks "is any of it unnecessary?" —
  different question, different failure mode if skipped (comprehension debt, LOC
  growth, maintenance OpEx).
- Agents skip the refactor step of red-green-refactor or make only superficial
  changes when not explicitly driven (TDD Guard's lint integration exists precisely
  because of this).

## Process

1. **Simplification pass** (can be the builder in fresh context, or the reviewer
   model — fresh eyes matter more than which model): apply the agent-skills
   `code-simplification` discipline —
   - Remove speculative abstraction (YAGNI; "would a senior engineer say this is
     overcomplicated? If yes, rewrite it" — Karpathy)
   - Inline needless indirection; collapse single-use helpers
   - Delete dead code introduced by iteration churn
   - **Chesterton's Fence**: never remove pre-existing code you can't explain —
     simplification is scoped to the change's own diff, not a license to refactor
     the neighborhood (surgical-changes rule still applies)
2. **Behavior-preservation proof**: full test suite green before and after, mutation
   score on changed lines not degraded, `gate-verify` green. A simplification that
   needs a test change is *not* a simplification — bounce it.
3. **Size check**: net diff after simplify vs before — the pass should usually
   shrink or hold the diff, not grow it.

## Exit gate

- All Validate-phase gates re-run green (this is what makes simplify safe to automate
  early — it's the most machine-checkable phase in the loop).
- Diff delta report attached to the PR (what was removed/simplified, LOC before/after).

## Autonomy note

This phase graduates to full autonomy **first**: behavior preservation is entirely
machine-checkable (tests + mutation + verify), so the risk of unattended operation is
the lowest in the loop. It's the natural pilot for out-of-the-loop operation.

## Metrics emitted

| Event | Fields |
|---|---|
| `simplify.pass` | task_id, model, loc_before, loc_after, items_removed[] |
| `simplify.gate_rerun` | task_id, pass/fail |

Watch: LOC-delta trend per change class (is the builder learning, via ratchet rules,
to not overbuild in the first place? falling simplify-deltas = yes).

## Failure / escalation

- Gate goes red during simplification → revert the simplify commit(s) — the
  save-point discipline from Build makes this cheap — and record what broke; that's
  signal the "simplification" changed behavior.
- Repeated behavior-breaking simplify attempts (3×) → skip phase, merge the reviewed
  version, retro item.
