# Design — CHG-0021

## Decisions

- **Stryker's `thresholds.break` is the verdict; the gate is a wrapper.** The
  gate adds what Stryker doesn't give the loop: resolver binding (per-repo
  no-op contract), survivor feedback on stderr in the exact shape a
  test-writer agent needs, and JSONL telemetry. No score re-computation for
  gating — one authority.
- **`break: 100` on this repo, with `// Stryker disable` as the escape.** The
  drill proved 85 wrong here: on a 10-mutant surface each mutant is 10 points,
  so one whole weakened test still passed. The current suite kills all 10
  mutants with no equivalent-mutant problem. When a genuine equivalent mutant
  appears (the spike warning), mark it with a reviewed
  `// Stryker disable next-line` comment — visible in diff review — instead of
  lowering the threshold for everything. Larger repos with real equivalence
  noise can bind their own thresholds in their own Stryker config.
- **Command test runner** (`node --test tests/cost.test.mjs`): no Stryker
  runner plugin exists for node:test; the command runner is slower per mutant
  but correct, and incremental mode (history file committed, per the ratified
  mutation-history decision) keeps re-runs ~1s.
- **Per-run report gitignored, incremental file committed** — the report is a
  build artifact regenerated every run; the incremental file is the history
  that makes CI/PR runs cheap.

## Drill record (2026-07-06)

1. Weakened `costUsd` null-return + sum-exactness assertions → score 90,
   survivor `src/cost.mjs:14 ArithmeticOperator → "tokensOut / rate.out"`.
   At `break: 85`: gate **passed** (mis-calibration caught, threshold raised).
   At `break: 100`: gate **red**, survivor named. ✅ M2 first-drill exit
   criterion met.
2. Restored suite → 10/10 killed, score 100, gate green.
