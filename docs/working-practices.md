# Working practices: directing agents effectively

Status: draft (Tim + Claude, 2026-07-05)
Related: `enterprise-adoption.md`, `harness/decisions.md`, `harness/QUESTIONS.md`

Practices that reduce back-and-forth, raise output quality, and cut wasted agent
work — distilled from building this harness. They apply to any capable coding agent
(Claude Code here; the enterprise internal model equally).

## The patterns that already work — keep them

- **Ratified decisions.** The decisions register (D-1…D-25, "don't relitigate")
  is the cheapest way to stop an agent re-exploring settled ground. Every hour spent
  ratifying a decision saves many agent-hours of re-derivation.
- **Batch Q&A in files.** `QUESTIONS.md` — the agent writes numbered questions, the
  human answers in batch, answers get ratified into decisions. Far more efficient
  than interactive back-and-forth, and it leaves an audit trail.
- **Executable acceptance criteria.** "Done = command X exits zero" enforced by
  hooks. The agent aims at a target it can verify itself instead of guessing when
  to stop.
- **Small increments.** ≤~100 changed lines per task, one OpenSpec bundle per
  change. Review stays tractable; a bad change is cheap to revert.

## Refinements — the highest-leverage changes

1. **Reference decision IDs in asks.** "Per D-25, port the resolver unchanged"
   beats "port the resolver" — it pins the constraints without restating them and
   tells the agent which ground is settled.
2. **State the deliverable type up front.** *"Assessment only"* vs. *"propose and
   build CHG-NNNN."* Ambiguity here is the main source of wasted implementation:
   an agent that thinks it was asked to build will build.
3. **Give acceptance criteria as commands in the ask itself.** "Done = `npm test`
   green + event X visible in the JSONL." The hooks enforce this at the end; putting
   it in the ask means the agent aims at it from the start rather than discovering
   it at the Stop hook.
4. **One goal per turn for build work.** Multi-question turns are fine for strategy
   and review; for implementation, one CHG per ask maps cleanly onto the repo's own
   one-change-one-bundle workflow.
5. **Point at specific docs instead of letting the agent rediscover.** "The plan is
   `legacy-parity.md` steps 1–6" saves an exploration pass. Rediscovery is not just
   slow — it occasionally rediscovers *wrong*.
6. **State constraints and non-goals, not just goals.** "Do X, but the `harness.json`
   schema must not change, and don't touch bound repos" prevents the most expensive
   failure mode: correct work on the wrong scope.

## Anti-patterns to avoid

- **"Build something similar to this."** Underspecified imitation; see
  `enterprise-adoption.md`. Give constraints and let the agent re-derive, or give an
  exact spec — never "similar."
- **Accepting "I verified it" without the gate output.** The house rule exists
  because agents (and humans) report optimistically. No green gate, no done.
- **Grinding past escalation caps.** 3 consecutive reds on a gate or 5 iterations on
  a task means the task is mis-scoped or the agent is missing context — more
  iterations won't fix either. Stop, hand off, re-scope (D-11).
- **Letting docs lead implementation.** Documenting features that don't exist yet
  produces confident fiction; docs follow the build order
  (`documentation-plan.md`).
