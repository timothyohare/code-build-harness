# Tasks — CHG-0016

- [x] 1.1 `harness/gates/verify.mjs` — port gate-verify, resolver import
      updated, `record()` telemetry on all exits
- [x] 1.2 `tests/verify-gate.test.mjs` — happy path with markers + real HTTP
      boot, env merge, fail-fast on missing boot/ready, setup failure,
      acceptance failure + teardown, mock-up failure ordering
- [x] 1.3 `npm test` + `npm run lint` green; PR with `tests-approved`; merge;
      archive bundle
