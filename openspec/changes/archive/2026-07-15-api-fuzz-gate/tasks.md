# Tasks — CHG-0026 (ratified 2026-07-15: docker schemathesis, on-demand
# first, OpenAPI doc in scope; sequenced after CHG-0025)

- [x] 1.1 nrl-predictor: `openapi.yaml` for the gate API (/health,
      /predictions/{round}) — reviewed as the contract of record
      (scripts/gate/openapi.yaml; scoped to seeded endpoints; 400 response
      documented as the desired non-integer-round contract)
- [x] 1.2 `harness/gates/fuzz.mjs` (boot/ready reuse, schemathesis run,
      no-op contract, telemetry) + resolver keys; subprocess tests incl.
      red-verdict and dead-boot drills over temp fixture apps
      (tests/fuzz-gate.test.mjs, 6 tests; suite 86)
- [x] 1.3 nrl-predictor binding (`fuzzSchema`); local run exit 0. Red drill
      exceeded: the FIRST run found two REAL faults — production crash on
      non-integer round (int() on raw path param → fixed with 400 + unit
      test) and 501-on-unknown-method gate-server artifact (fixed with 405
      catch-all). Post-fix: 74/74 generated cases pass, seed 42
- [x] 1.4 Docs: validation-stack table row (04-validate.md) + gate roster
      entry and fuzz binding keys in ~/.claude/CLAUDE.md
- [x] 1.5 PR(s); merge; archive bundle. Follow-up recorded: nightly
      scheduled run once quiet. (nrl#12 merged 0bc08ab; harness#31 merged
      e95e89b with tests-approved; archived 2026-07-15.)
