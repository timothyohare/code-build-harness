# bdd-api-acceptance

## Why

gate-verify's `acceptance` binding today runs hand-rolled scripts
(nrl-predictor's `scripts/gate/acceptance.py` — imperative urllib checks).
Behavioural (Gherkin) API tests make the acceptance contract readable as
living documentation and reviewable scenario-by-scenario in diffs.

## What Changes

- **No harness code changes** — BDD suites slot into the existing
  `acceptance` binding key that gate-verify already runs after boot. The
  change is the pattern + first pilot.
- **Framework policy (Tim, 2026-07-15): native BDD per stack** — pytest-bdd
  for Python repos, cucumber-js for JS/TS repos; **Karate only for Java
  projects** (none exist yet; enters with the Spring Boot track).
- Pilot: nrl-predictor gets `scripts/gate/bdd/` (pytest-bdd feature +
  steps) porting everything `acceptance.py` asserts, plus extension
  scenarios; binding runs both during parity, then acceptance.py retires.
- Docs: acceptance-binding behavioural pattern recorded in docs/harness/.

## Capabilities

### New Capabilities

- `api-acceptance`: behavioural acceptance contract — acceptance suites are
  expressed as readable scenarios against a booted app, run by gate-verify.

### Modified Capabilities

<!-- none — gate-verify's contract (run the bound acceptance command,
red on non-zero) is unchanged -->

## Impact

- nrl-predictor: `pytest-bdd` dev dependency, feature/steps files, binding
  change. Unit CI unaffected — pytest `testpaths` excludes
  `scripts/gate/`, so BDD scenarios only run via the acceptance binding
  against a booted app.
- This repo: bundle + docs only.
