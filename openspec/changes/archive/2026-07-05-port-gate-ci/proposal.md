# CHG-0015: Port gate-ci into harness/gates/ with event telemetry

## Why

M-parity step 2 (`docs/harness/legacy-parity.md`, D-25): gate-ci is the fast
quality gate and the Stop-hook workhorse. The parity matrix adds one 🆕 on top of
the as-is port: every gate run emits a JSONL event, which legacy never had.

## What Changes

- Add `harness/gates/ci.mjs`: port of `~/.claude/bin/gate-ci.mjs` (58 lines) —
  lint/typecheck/test (+build with `--full`), aggregate failures, `--force`,
  source-changed guard, Stop-hook stdin protocol (`stop_hook_active`, exit 2 +
  stderr feedback). Resolver import points at `./resolve.mjs`.
- 🆕 Emits a `validate.gate_run` JSONL event (result, duration, steps, failures)
  when steps actually run; the near-free early exits (loop guard, no source
  changed) stay silent. Telemetry failure never breaks the gate.
- Add `tests/ci-gate.test.mjs`: subprocess tests over temp-dir fixtures.
- Carries the CHG-0014 bundle archive + `openspec/specs/harness-resolver` sync.

## Capabilities

### New Capabilities

- `gate-ci`: fast quality gate over resolver-bound commands with Stop-hook
  protocol and run telemetry.

### Modified Capabilities

None.

## Impact

- New files under `harness/gates/` and `tests/` (PR needs `tests-approved`).
- Loop-controller delegation (removing run-live's inline npm shelling) is
  M-parity step 3, a separate change — no existing module changes here.
