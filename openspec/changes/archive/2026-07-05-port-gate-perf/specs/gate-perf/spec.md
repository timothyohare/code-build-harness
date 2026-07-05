# gate-perf

## ADDED Requirements

### Requirement: Configuration no-op contract

Without `perfBoot` and a non-empty `perfRoutes` array the gate SHALL exit 0
without booting or emitting telemetry. With perf keys but no
`perfReady`/`ready` URL it SHALL fail (exit 1) with a fail event.

#### Scenario: Unconfigured repo skips silently

- **GIVEN** a binding with no perf keys
- **WHEN** the gate runs
- **THEN** it exits 0, logs "skipping", and emits no event

### Requirement: Deterministic measurement

The gate SHALL boot `perfBoot` as a detached process group with `env` +
`perfEnv` merged, wait for readiness (detecting boot death to short-circuit
the wait), then measure each route with 3 warmup requests plus N samples
(`--samples`, default 40), reporting p50 and p95. Any non-2xx response fails
the gate.

#### Scenario: Boot death short-circuits readiness

- **GIVEN** a `perfBoot` command that exits immediately
- **WHEN** the gate runs
- **THEN** it fails well before the 120s readiness timeout

### Requirement: Median-gated baseline comparison

The gate SHALL gate each route's p50 against `baseline_p50 × 1.5 + 10ms`
(p95 shown, not gated). A missing baseline file SHALL be written (and pass);
`--update` SHALL rewrite it regardless of regression. The baseline file
(`perfBaseline`, default `perf-baseline.json`) carries note, timestamp,
sample count, and per-route p50/p95.

#### Scenario: Regression beyond budget fails

- **GIVEN** a committed baseline with p50 far below the route's current
  latency
- **WHEN** the gate runs
- **THEN** it exits 1 naming the route, and the fail event carries the
  regression detail

#### Scenario: --update accepts the new reality

- **GIVEN** the same regressing route
- **WHEN** the gate runs with `--update`
- **THEN** it exits 0 and the baseline file reflects the new p50

### Requirement: Run telemetry

Every configured run SHALL emit one `validate.gate_run` event — pass (with
baseline written/updated or routes checked) or fail (with reason /
regressions). Emission is best-effort and MUST NOT change the verdict.

#### Scenario: Baseline write emits pass

- **GIVEN** a first run with no baseline file
- **WHEN** the gate completes
- **THEN** the event has `result: "pass"` and `detail.baseline: "written"`
