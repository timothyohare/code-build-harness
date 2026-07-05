# gate-verify Specification

## Purpose
TBD - created by archiving change port-gate-verify. Update Purpose after archive.
## Requirements
### Requirement: Mock lifecycle

The gate SHALL bring up the bound AWS mock before boot (named adapter
`dynamodb-local`/`localstack` mapping to compose + a readiness port, or explicit
`mockUp`/`mockDown` overrides) and SHALL tear it down on exit — including
failure exits — unless `--keep` is passed. A mock-up failure MUST fail the gate
before `setup` or boot runs.

#### Scenario: Teardown runs on acceptance failure

- **GIVEN** a binding with `mockUp`/`mockDown` overrides and a failing
  `acceptance` command
- **WHEN** the gate runs
- **THEN** it exits 1 and the `mockDown` command has executed

### Requirement: Boot and readiness

The gate SHALL fail fast when `boot`/`ready` are not configured. It SHALL boot
the app as a detached process group with output captured to a log file, wait
for the `ready` URL to return HTTP 2xx (body containing `readyMatch` when set),
tail the boot log on readiness failure, and kill the whole process tree on
exit.

#### Scenario: Unconfigured project fails fast

- **GIVEN** a binding with no `boot` or `ready` key
- **WHEN** the gate runs
- **THEN** it exits 1 with "boot/ready not configured" and no later step runs

### Requirement: Acceptance and observability steps

After readiness, the gate SHALL run the bound `acceptance` then `observability`
commands (skipping absent keys) with the binding's `env` merged over the
process environment; any failure fails the gate.

#### Scenario: env merge reaches the steps

- **GIVEN** a binding with `env: {GATE_TEST_VAR: "yes"}` and an acceptance
  command asserting that variable
- **WHEN** the gate runs
- **THEN** the acceptance command sees the variable and the gate exits 0

### Requirement: Run telemetry

The gate SHALL emit one `validate.gate_run` event per run — `pass` with the
steps run, or `fail` with the failure reason. Emission is best-effort and MUST
NOT change the verdict.

#### Scenario: Pass event carries steps

- **GIVEN** a green run with acceptance and observability bound
- **WHEN** the gate completes
- **THEN** the event has `result: "pass"` and
  `detail.steps: ["acceptance", "observability"]`

