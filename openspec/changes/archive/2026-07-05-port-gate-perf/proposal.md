# CHG-0017: Port gate-perf into harness/gates/ with event telemetry

## Why

M-parity step 2 completed (`docs/harness/legacy-parity.md`, D-25): gate-perf is
the deterministic route-latency gate. Lower priority in the matrix (only
kickpool binds perf keys today) but it finishes the gate-port trio, unblocking
step 3 (loop delegation) and step 4 (Stop-hook repoint).

## What Changes

- Add `harness/gates/perf.mjs`: port of `~/.claude/bin/gate-perf.mjs` (166
  lines) — no-op without `perfBoot`/`perfRoutes`, perf-key defaulting chain,
  warmup 3 + N samples, p50/p95, median-gated budget `base×1.5 + 10ms`,
  `--update` baseline rewrite with note/timestamp, boot-death detection during
  readiness. Baseline-refresh hints in output now point at the new path.
- 🆕 `validate.gate_run` telemetry on every real exit (silent on the
  unconfigured no-op); best-effort.
- Add `tests/perf-gate.test.mjs`: 7 subprocess tests against a real HTTP server
  with a deliberately slow route.
- Carries the CHG-0016 bundle archive + `gate-verify` spec sync.

## Capabilities

### New Capabilities

- `gate-perf`: deterministic median-gated route-latency check with committed
  baseline and run telemetry.

### Modified Capabilities

None.

## Impact

- New files under `harness/gates/` and `tests/` (PR needs `tests-approved`).
- Completes M-parity step 2; remaining: steps 3–6 (delegation, repoint,
  dual-run cutover per bound repo, shims).
