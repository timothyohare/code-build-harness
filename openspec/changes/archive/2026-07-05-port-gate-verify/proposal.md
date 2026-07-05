# CHG-0016: Port gate-verify into harness/gates/ with event telemetry

## Why

M-parity step 2 continued (`docs/harness/legacy-parity.md`, D-25): gate-verify is
the boot-and-verify gate — the one that catches "looked fine, didn't actually
work." Ported as-is with the parity-matrix 🆕 telemetry row.

## What Changes

- Add `harness/gates/verify.mjs`: port of `~/.claude/bin/gate-verify.mjs` (109
  lines) — mock adapters (`dynamodb-local`/`localstack`) with `mockUp`/`mockDown`
  overrides, `setup` + `env` merge, detached-process-group boot with log capture
  and `tail -40` on failure, HTTP readiness (`ready`/`readyMatch`), acceptance +
  observability steps, teardown on exit/SIGINT, `--keep`.
- 🆕 Emits `validate.gate_run` (pass with steps run, or fail with reason);
  best-effort, never flips the verdict.
- Add `tests/verify-gate.test.mjs`: subprocess tests booting a real tiny HTTP
  server (no docker in tests; adapter table exercised via override commands).
- Carries the CHG-0015 bundle archive + `gate-ci` spec sync.

## Capabilities

### New Capabilities

- `gate-verify`: boot-and-verify gate over resolver-bound commands with mock
  lifecycle, readiness wait, and run telemetry.

### Modified Capabilities

None.

## Impact

- New files under `harness/gates/` and `tests/` (PR needs `tests-approved`).
- No existing module changes; Stop-hook repoint and cutover remain later steps.
