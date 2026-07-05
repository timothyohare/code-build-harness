# Design — CHG-0017

## Approach

Port-as-is plus telemetry, same shape as CHG-0015/0016. The median-gating
rationale comment is kept verbatim — it is documented, correct for a dev
machine, and part of what the parity matrix says to preserve.

## Decisions

- **No event on the unconfigured no-op.** Unlike verify (where running against
  an unconfigured repo is a real failure), perf is explicitly optional per
  repo; a skip event per Stop-hook-adjacent run would be noise. Configured
  runs always emit.
- **Baseline-refresh hint text updated** from `node ~/.claude/bin/gate-perf.mjs
  --update` to the new path — the one deliberate output drift, since the old
  path is being retired (step 6). Dual-run cutover compares verdicts, not
  stderr text.
- **Tests use a two-route server** (instant `/` and ~40ms `/slow`) with
  `--samples 5`: fast, and the slow route makes the regression and `--update`
  branches deterministic against a tiny committed baseline (budget ≈ 10ms).
- **Unique port per test** (own range, distinct from verify's) since node:test
  runs test files in parallel processes.
