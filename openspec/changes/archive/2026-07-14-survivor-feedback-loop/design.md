# Design — CHG-0022

## Decisions

- **No RED verification in strengthen mode.** The verified-RED contract exists
  to prove a new test tests something. A survivor-killing test proves itself
  differently: it must PASS on the real implementation and FAIL on the mutant
  — and the mutation gate re-run is exactly that check. Demanding RED here
  would force the test-writer to write a wrong test.
- **Sticky mode via `state.mode`, not `blockingGate`.** An earlier draft keyed
  the routing off `blockingGate === 'mutation'`, but a green red on the
  strengthened test flips `blockingGate` to `green` and would bounce the loop
  back into write-failing-test + RED after CI was already green. `state.mode =
  'strengthen'` persists (in the resumable state file) until mutation passes
  or the task escalates; `blockingGate` stays pure bookkeeping.
- **Escalation is unchanged.** Mutation reds increment the same per-gate
  consecutive counter (3 → escalate) and the same total-iteration cap (D-11).
  A suite that can't be strengthened in 3 tries is a human problem — likely an
  equivalent mutant needing a reviewed `// Stryker disable` (CHG-0021 rule).
- **Feedback transport is the existing gate-feedback channel.** run-live's
  `sh()` keeps the last 500 output chars; gate-mutation prints survivors last
  on stderr, so `file:line mutator → replacement` lines land in the
  strengthen prompt without a new side channel. If survivor lists outgrow the
  tail, a structured handoff (report path in detail) is the follow-up — not
  needed at current surface sizes.

## Loop shape after this change

```
write-failing-test → RED → implement → GREEN → ci → mutation ─ pass → green ✓
        ▲                                              │ red
        └───────────── (never, once ci green) ─────────┤
                                                       ▼
              strengthen-tests → GREEN → ci → mutation (sticky until pass/escalate)
```
