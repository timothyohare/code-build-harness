# Tasks — CHG-0015

- [x] 1.1 `harness/gates/ci.mjs` — port gate-ci, resolver import updated, emit
      `validate.gate_run` on real runs (try/catch)
- [x] 1.2 `tests/ci-gate.test.mjs` — absent-key no-op, failure aggregation +
      exit 2, stop_hook_active loop guard, source-changed skip + `--force`,
      `--full` adds build, pass/fail events, early exits emit nothing
- [x] 1.3 `npm test` + `npm run lint` green; branch/commit/PR with
      `tests-approved`; merge; archive bundle
