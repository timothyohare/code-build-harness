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

## Open questions for review

1. Schemathesis invocation: docker image (matches scanner pattern, no
   Python-env coupling) vs repo venv install (faster, but per-repo setup).
   Recommend docker.
2. Nightly scheduled run in CI now, or local/on-demand only until the gate
   proves quiet? Recommend on-demand first (same maturation path as
   gate-perf).
3. Dedicated `CHG` for writing nrl-predictor's OpenAPI document, or fold it
   into this one? (It is the pilot's precondition either way.)
