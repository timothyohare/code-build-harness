# gate-fuzz

## ADDED Requirements

### Requirement: Configuration no-op contract

The gate SHALL exit 0 without running anything or emitting telemetry when
the binding has no `fuzzSchema` key.

#### Scenario: Unconfigured repo skips silently

- **GIVEN** a binding with no `fuzzSchema` key
- **WHEN** the gate runs
- **THEN** it exits 0, logs "skipping", and emits no event

### Requirement: Schema-driven fuzz verdict

The gate SHALL boot the app against its configured mocks, run the fuzz tool
against the bound OpenAPI schema, and exit non-zero when any generated
request produces a server error (5xx), a response violating the declared
schema, or a crash.

#### Scenario: Injected 500 reds the gate

- **GIVEN** a booted app whose endpoint returns 500 for a generated input
- **WHEN** the gate runs
- **THEN** it exits non-zero and the failing request is reproducible from
  the output

### Requirement: Bounded, out-of-band execution

The gate SHALL cap generated examples via configuration so runtime is
bounded, and it MUST NOT be wired into the Stop hook or per-PR required
checks.

#### Scenario: Run completes within the example budget

- **GIVEN** a binding with a configured example budget
- **WHEN** the gate runs
- **THEN** the fuzz tool generates at most that many examples per operation
