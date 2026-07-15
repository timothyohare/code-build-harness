# bdd-api-acceptance — design

## Context

nrl-predictor's acceptance layer is `scripts/gate/acceptance.py`: ~15
imperative checks over `/health` and `/predictions/{round}` against the
seeded round, run by gate-verify after boot. It works but reads as code,
not contract. Tim wants work-style behavioural API tests across projects.

## Goals / Non-Goals

**Goals:**
- Acceptance checks readable as scenarios; failures name the behaviour.
- Zero harness code changes — prove the `acceptance` binding is already
  the right seam.
- Full parity with acceptance.py before it retires (no coverage loss).

**Non-Goals:**
- Karate anywhere yet (ratified: Java projects only — none exist).
- BDD for unit tests — this is the booted-app acceptance layer only.
- A new binding key — `acceptance` already means "prove the app behaves".

## Decisions

- **pytest-bdd over behave** for Python repos: rides the existing pytest
  install, runner, and fixtures; no second test runner to configure.
  cucumber-js is the JS/TS equivalent when a JS repo adopts the pattern.
- **Location `scripts/gate/bdd/`**: outside pytest `testpaths`
  (`tests`, `v2/tests`), so plain `pytest`/CI never collects scenarios that
  need a live server; the binding invokes them explicitly
  (`python -m pytest scripts/gate/bdd`).
- **Parity-then-cutover** (same as M-parity): binding runs BDD suite AND
  acceptance.py while they overlap; acceptance.py deleted once the suite
  covers everything it asserts plus extensions. Both red the gate
  independently during parity.
- **Scenarios assert only verified behaviour**: extension scenarios
  (unknown route, content-type) are confirmed against the booted app
  before being committed, not assumed from reading the router.

## Risks / Trade-offs

- **Step-definition indirection** — Gherkin adds a mapping layer over
  urllib calls; accepted for reviewability, and steps are shared/reused
  across scenarios.
- **Two acceptance layers during parity** — slightly slower gate-verify;
  temporary by design.
