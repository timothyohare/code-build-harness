# Tasks — CHG-0026 (DRAFT — awaiting Tim's review of proposal open questions;
# sequenced after CHG-0025, which shares the pilot repo and produces its
# OpenAPI contract)

- [ ] 1.1 nrl-predictor: `openapi.yaml` for the gate API (/health,
      /predictions/{round}) — reviewed as the contract of record
- [ ] 1.2 `harness/gates/fuzz.mjs` (boot/ready reuse, schemathesis run,
      no-op contract, telemetry) + resolver keys; subprocess tests incl.
      seeded-500 red drill over a temp fixture app
- [ ] 1.3 nrl-predictor binding (`fuzzSchema`, example budget); local run
      exit 0; seeded-bug drill on the real app (temporarily break an
      endpoint, gate must red)
- [ ] 1.4 Docs: gate roster + CLAUDE.md gate table entry
- [ ] 1.5 PR(s); merge; archive bundle. Follow-up recorded: nightly
      scheduled run once quiet
