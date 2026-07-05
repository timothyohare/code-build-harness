# CHG-0018: Loop ci gate delegates to the ported gate-ci

## Why

M-parity step 3 (`docs/harness/legacy-parity.md`, D-25): run-live's `ci` gate
was interim-only, shelling `npm run lint && npm test` directly. The ported
gate-ci now exists, resolves this repo's binding, and emits telemetry — the
inline shelling can go.

## What Changes

- `harness/live/run-live.mjs`: the `ci` gate runs
  `node harness/gates/ci.mjs --force` instead of hardcoded npm commands.
  Resolved binding for this repo autodetects to lint + test — same commands,
  now via the gate (with its telemetry). `red`/`green` keep direct `npm test`:
  they assert suite verdicts, not CI.
- Carries the CHG-0017 bundle archive + `gate-perf` spec sync.

## Capabilities

### New Capabilities

None — behavior-preserving rewiring; gate-ci's contract is already specced.

### Modified Capabilities

None.

## Impact

- `harness/live/` only (unprotected path; no labels needed).
- Loop ci runs now appear in `metrics/events/` as `validate.gate_run` rows.
