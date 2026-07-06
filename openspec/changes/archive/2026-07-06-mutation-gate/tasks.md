# Tasks — CHG-0021

- [x] 1.1 `harness/gates/mutation.mjs` (no-op contract, command verdict,
      survivor summary, telemetry)
- [x] 1.2 Stryker on this repo: devDep, config (incremental, break 100),
      `mutation` binding key, gitignore, committed incremental file
- [x] 1.3 `tests/mutation-gate.test.mjs` — 5 subprocess tests
- [x] 1.4 Drill: seeded weak test → gate red with survivor named; restore →
      green (recorded in design.md)
- [x] 1.5 `npm test` + `npm run lint` green; PR with `tests-approved` +
      `harness-config-approved`; merge; archive bundle
