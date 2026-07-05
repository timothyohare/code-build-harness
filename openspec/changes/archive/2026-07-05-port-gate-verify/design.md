# Design — CHG-0016

## Approach

Port-as-is plus telemetry, same shape as CHG-0015: the only deltas from legacy
are the resolver import, Biome formatting, and a `record()` helper called from
`fail()` and the green exit.

## Decisions

- **`record()` inside `fail()`** so every failure path (mock, setup, boot
  config, readiness, acceptance, o11y) emits exactly one fail event with its
  reason — no per-call-site emission to forget.
- **Tests boot a real HTTP server, not docker.** The adapter table
  (compose/waitPort) is data; what needs proving is the lifecycle contract —
  mock up → setup → boot → readiness → steps → teardown-on-any-exit. Override
  commands (`mockUp`/`mockDown` as marker touches) exercise that contract
  hermetically. Docker-dependent adapter behavior gets covered by the dual-run
  cutover checks against kickpool/nrl-predictor (M-parity step 5).
- **Readiness-timeout path untested**: the 90s wait is legacy behavior kept
  as-is; a test would cost 90s per run. The failure branch itself is covered
  via the cheaper config/setup/acceptance failures.
