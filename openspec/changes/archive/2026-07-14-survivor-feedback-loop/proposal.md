# CHG-0022: Survivor feedback into the loop (M2)

## Why

CHG-0021 gave the harness a mutation gate that names surviving mutants, but
nothing consumes that feedback: a loop run whose suite is green-but-weak has
no way to strengthen itself. This change closes the M2 feedback loop — the
mutation gate's survivors drive a dedicated test-writer strengthening step.

## What Changes

- `harness/controller/loop.mjs`: optional `mutation` gate runs after `ci`.
  A mutation red flips the loop into **survivor-strengthening mode** — the
  next iteration runs a test-writer-only `strengthen-tests` step with the
  survivor detail as gate feedback, verifies GREEN (no RED verification: a
  test that kills a survivor passes on the real implementation by design),
  then re-runs `ci` and `mutation`. The mode is sticky until mutation passes
  or the task escalates; mutation reds count toward D-11 caps like any gate.
- `harness/controller/executors/claude-cli.mjs`: step-aware test-writer
  prompt — `strengthen-tests` instructs "kill the named survivors; the tests
  must PASS on the current implementation; no threshold cuts or Stryker
  disables", replacing the write-a-failing-test instruction that would be
  wrong in this mode.
- `harness/live/run-live.mjs`: `mutation` gate wired, delegating to
  `harness/gates/mutation.mjs` (survivor summary on stderr rides into the
  feedback tail; unbound repos no-op).
- Tests: 3 loop routing tests + 1 executor prompt test (76 → 80).
- Carries the CHG-0021 bundle archive + Stop-hook telemetry rows.

## Capabilities

### New Capabilities

- `loop-controller`: mutation-gate integration and survivor-strengthening
  routing (first spec'd slice of the M1 controller).

### Modified Capabilities

None.

## Impact

- Touches `harness/controller/**` (**needs `harness-config-approved` label**)
  and `tests/**` (**needs `tests-approved` label**).
- No behavior change for loops without an injected `mutation` gate (all
  pre-existing loop tests pass unchanged).
