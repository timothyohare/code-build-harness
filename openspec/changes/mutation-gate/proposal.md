# CHG-0021: StrykerJS mutation gate (M2 start)

## Why

M2 ("grade the graders", `architecture.md`): a green test suite proves nothing
about test *strength* — mutation testing does. Exit criterion for the first
drill: a seeded weak test is caught by the mutation gate. This change starts M2
with the gate + this repo's own Stryker binding; Semgrep/Gitleaks/Trivy and
eslint-boundaries are later M2 changes.

## What Changes

- Add `harness/gates/mutation.mjs`: runs the resolver-bound `mutation` command
  (no-op when absent), lets StrykerJS `thresholds.break` decide the verdict,
  parses the JSON report (`mutationReport`, default
  `reports/mutation/mutation.json`) to print a **survivor summary**
  (file:line, mutator, replacement) — the seed of the survivor-feedback loop —
  and emits `validate.gate_run` telemetry with score/survivors.
- Configure this repo: `@stryker-mutator/core` devDep, `stryker.config.json`
  (command runner over `node --test tests/cost.test.mjs`, incremental mode,
  `thresholds.break: 100`), `mutation` key in `.claude/harness.json`,
  committed incremental file (per the ratified mutation-history decision),
  gitignored temp dir + per-run report.
- Add `tests/mutation-gate.test.mjs` (5 subprocess tests).
- Carries the CHG-0020 bundle archive + Stop-hook telemetry rows.

## Capabilities

### New Capabilities

- `gate-mutation`: mutation-score gate over a resolver-bound command with
  survivor feedback and run telemetry.

### Modified Capabilities

None.

## Impact

- Touches `.claude/harness.json` (**needs `harness-config-approved` label**)
  and `tests/**` (**needs `tests-approved` label**).
- Drill evidence (run before landing): weakened two cost tests → score 90,
  gate red naming `src/cost.mjs:14 ArithmeticOperator`; restored suite →
  score 100, gate green. Notably the drill also caught a threshold
  mis-calibration: at `break: 85` the weak test *passed* (10-mutant surface ⇒
  10 points per mutant), which is why break is 100 — see design.md.
