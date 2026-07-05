# Design — CHG-0015

## Approach

Port-as-is plus the one 🆕 from the parity matrix (event telemetry). The gate
body is unchanged legacy logic; the only additions are the import switch to
`./resolve.mjs` and an `emit()` call at the end of a real run.

## Decisions

- **Emit only when steps run.** The Stop hook fires on every turn; the loop
  guard and source-changed guard exist to make that near-free. Emitting on
  those early exits would flood the event log with noise rows. One event per
  *real* gate run keeps task/cost attribution meaningful.
- **Telemetry is best-effort.** `emit()` is wrapped in try/catch — a metrics
  write failure must never turn a green gate red (or mask a red one).
- **Tests are subprocess-level.** The gate is a CLI with process.exit and
  stdin protocol; spawning it against temp-dir fixtures (shell-command
  bindings like `touch lint.ran` / `exit 1`) tests the real contract including
  exit codes, without refactoring the port for testability.
- **`task_id` comes from the environment** (`HARNESS_TASK_ID`, already the
  emitter's fallback) so the loop controller can attribute gate runs without
  the gate growing new flags.
