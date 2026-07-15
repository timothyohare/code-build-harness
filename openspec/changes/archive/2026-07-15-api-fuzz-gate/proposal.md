# api-fuzz-gate

## Why

Nothing exercises the API surfaces with adversarial/generated input —
acceptance suites check expected behaviour, scanners check code and deps,
but malformed-input robustness (5xx on garbage, schema-violating responses)
is unproven. Schema-driven fuzzing makes that an executable claim.

## What Changes

- New gate `harness/gates/fuzz.mjs` following the gate-perf pattern:
  boots the app against mocks (reusing the resolver's boot/ready machinery),
  runs **Schemathesis** against the repo's OpenAPI schema, exits non-zero on
  failures (5xx, response-schema violations, server crashes).
- New binding keys: `fuzzSchema` (path/URL to OpenAPI document), optional
  `fuzz` (full command override), `fuzzChecks`, `fuzzExamples` (bounded
  example budget for determinism-ish runtime).
- **On-demand + nightly, NOT per-PR**: fuzzing is slow and probabilistic —
  like gate-perf it stays out of the Stop hook and required checks; a
  scheduled nightly workflow can run it once stable.
- Pilot: nrl-predictor — requires writing a small OpenAPI document for the
  gate API first (`/health`, `/predictions/{round}` — none exists today),
  which then also serves the api-acceptance work as the contract of record.
- No-op contract: without `fuzzSchema` the gate exits 0 silently (same as
  gate-perf/gate-mutation unconfigured behaviour).

## Capabilities

### New Capabilities

- `gate-fuzz`: schema-driven API fuzz contract — configuration no-op,
  verdict authority, failure surfacing.

### Modified Capabilities

<!-- none -->

## Impact

- This repo: new gate + tests (subprocess over temp fixtures, same style as
  gate-perf tests); resolver keys.
- nrl-predictor: new `openapi.yaml` for the gate API + binding keys.
- Runtime: schemathesis via `uv tool run` / pipx / docker (decide in design).

## Ratified decisions (Tim, 2026-07-15: "go with your recommendations")

1. Schemathesis via **docker image** — matches the scanner pattern, no
   Python-env coupling.
2. **On-demand first**; nightly scheduled run only after the gate proves
   quiet (same maturation path as gate-perf).
3. nrl-predictor's OpenAPI document is **task 1.1 of this change** — the
   pilot's precondition, and it doubles as the contract of record for the
   CHG-0025 acceptance scenarios.
