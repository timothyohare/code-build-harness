# Tasks — CHG-0017

- [x] 1.1 `harness/gates/perf.mjs` — port gate-perf, resolver import updated,
      `record()` telemetry on configured exits, refresh-hint path updated
- [x] 1.2 `tests/perf-gate.test.mjs` — silent no-op, missing-ready fail,
      baseline write, within-budget pass, regression fail with detail,
      `--update` rewrite, boot-death short-circuit
- [x] 1.3 `npm test` + `npm run lint` green; PR with `tests-approved`; merge;
      archive bundle
