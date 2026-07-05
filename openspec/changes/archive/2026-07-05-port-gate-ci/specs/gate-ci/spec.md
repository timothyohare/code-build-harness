# gate-ci

## ADDED Requirements

### Requirement: Resolver-bound quality steps

The gate SHALL run the resolved `lint`, `typecheck`, and `test` commands (adding
`build` with `--full`) from the project root, skipping absent keys (no-op
contract), running ALL steps even after a failure, and aggregating failures.

#### Scenario: Absent keys are skipped, present ones run

- **GIVEN** a repo whose binding defines only `lint`
- **WHEN** the gate runs with `--force`
- **THEN** only the lint command executes and the gate exits 0 on its success

#### Scenario: Failures aggregate across steps

- **GIVEN** a binding where `lint` fails and `test` passes
- **WHEN** the gate runs with `--force`
- **THEN** both steps execute, the gate exits 2, and stderr names the failed
  step(s)

### Requirement: Stop-hook protocol

The gate SHALL read Stop-hook JSON from stdin; when `stop_hook_active` is true
it MUST exit 0 without running steps (loop guard). A red gate MUST exit 2 with
the failure summary on stderr (surfaced back to the agent).

#### Scenario: Loop guard suppresses re-entry

- **GIVEN** stdin JSON `{"stop_hook_active": true}`
- **WHEN** the gate is invoked
- **THEN** it exits 0 and no bound command executes

### Requirement: Source-changed guard

Without `--force`, the gate SHALL exit 0 without running steps when
`git status --porcelain` shows no changed source files (by extension). A
non-git directory MUST NOT suppress the run.

#### Scenario: Clean tree skips the gate

- **GIVEN** a git repo with no changed source files
- **WHEN** the gate runs without `--force`
- **THEN** it exits 0 and no bound command executes

### Requirement: Run telemetry

When steps actually run, the gate SHALL emit a `validate.gate_run` JSONL event
carrying result (pass/fail), duration, and the steps run/failed. Early exits
(loop guard, source guard) SHALL NOT emit. A telemetry write failure MUST NOT
change the gate verdict.

#### Scenario: Red run emits a fail event

- **GIVEN** a binding with a failing step and `HARNESS_EVENTS_DIR` set
- **WHEN** the gate runs with `--force`
- **THEN** the events file gains a `validate.gate_run` event with
  `result: "fail"` naming the failed step
