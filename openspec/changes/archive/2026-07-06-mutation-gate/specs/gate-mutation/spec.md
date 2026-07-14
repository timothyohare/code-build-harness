# gate-mutation

## ADDED Requirements

### Requirement: Configuration no-op contract

Without a `mutation` key the gate SHALL exit 0 without running anything or
emitting telemetry.

#### Scenario: Unconfigured repo skips silently

- **GIVEN** a binding with no `mutation` key
- **WHEN** the gate runs
- **THEN** it exits 0, logs "skipping", and emits no event

### Requirement: Verdict follows the bound command

The gate SHALL run the bound `mutation` command from the project root and MUST
exit 1 when the command fails (the mutation tool's own break threshold is the
scoring authority), 0 when it passes. A missing or unparsable report MUST NOT
change the verdict.

#### Scenario: Command failure fails the gate

- **GIVEN** a binding whose `mutation` command exits non-zero
- **WHEN** the gate runs
- **THEN** it exits 1

### Requirement: Survivor feedback

The gate SHALL print each survivor's file, line, mutator, and replacement
(capped at 20) whenever the JSON report (path `mutationReport`, default
`reports/mutation/mutation.json`) contains Survived or NoCoverage mutants, and
MUST instruct strengthening tests rather than lowering the threshold.

#### Scenario: Red run names the survivor

- **GIVEN** a failing command and a report with one Survived mutant at
  `src/a.mjs:7` (EqualityOperator → `!==`)
- **WHEN** the gate runs
- **THEN** stderr contains `src/a.mjs:7 EqualityOperator → "!=="`

### Requirement: Run telemetry

Every configured run SHALL emit one `validate.gate_run` event with
detected/undetected counts, the computed score, and the survivor list (capped
at 20) when a report is readable. Emission is best-effort and MUST NOT change
the verdict.

#### Scenario: Pass event carries the score

- **GIVEN** a passing command and a report with two Killed mutants
- **WHEN** the gate completes
- **THEN** the event has `result: "pass"`, `detail.score: 100`,
  `detail.detected: 2`
