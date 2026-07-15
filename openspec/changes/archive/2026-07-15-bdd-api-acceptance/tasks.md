# Tasks — CHG-0025

- [x] 1.1 nrl-predictor: `pytest-bdd` dev dep; `scripts/gate/bdd/` feature +
      steps porting every acceptance.py assert (health, seeded-round join
      behaviours, most-recent-generation, outlier flags, empty round 404)
      (11 scenarios, all green against the booted app)
- [x] 1.2 Extension scenarios verified against the booted app (unknown
      route, content-type) — behaviour confirmed live before committed
      (unknown route → 404; Content-Type application/json)
- [x] 1.3 Binding: `acceptance` runs BDD suite THEN acceptance.py (parity —
      both must pass). Local proof: `gate-verify` exit 0 cold; red drill —
      seeded homeScore=99 expectation redded gate-verify (exit 1, scenario
      named), reverted
- [x] 1.4 Harness docs: behavioural acceptance pattern + per-stack framework
      policy (pytest-bdd / cucumber-js / Karate-for-Java) in
      docs/harness/phases/04-validate.md
- [x] 1.5 PRs (nrl-predictor pilot; this repo bundle+docs); merge; archive.
      Follow-up recorded: retire acceptance.py after a quiet parity period;
      cucumber-js pattern lands with the first JS repo adoption.
      (nrl-predictor#11 merged 1dd5dee; harness#29 merged 8cc7cb5; archived
      2026-07-15.)
