# retire-nrl-acceptance-py

## Why

CHG-0025 follow-up: nrl-predictor's gate-verify ran the pytest-bdd suite and
then the legacy `scripts/gate/acceptance.py` during a parity period. The BDD
suite has covered all 13 acceptance.py checks since 2026-07-15 (audited
step-by-step: same or stricter assertions), and has grown to 16 scenarios
including the write path.

## What Changes

- nrl-predictor: delete `scripts/gate/acceptance.py`; `acceptance` binding =
  `pytest scripts/gate/bdd -q --no-cov` (human commit); CLAUDE.md gate
  paragraph refreshed (canonical gate path, BDD features, write path).
- **Bug found on the way:** since 2026-08-30 nrl's pyproject `addopts` applies
  `--cov-fail-under=93` to every pytest run, so the BDD acceptance run failed
  on coverage with all scenarios passing — gate-verify had been red. `--no-cov`
  scopes the floor back to the unit run in gate-ci.

## Capabilities

<!-- none — api-acceptance spec already names native BDD as the acceptance of record -->

## Impact

nrl-predictor PR #49. No harness code changes.
