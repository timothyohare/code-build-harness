# architecture-boundaries

## Why

M2's remaining item: architecture fitness rules riding the lint step
(04-validate.md layer 2). The harness's layering (gates standalone, hooks
constrained, controller subprocess-only) was enforced by convention alone —
one convenient import would silently collapse it.

## What Changes

- `.dependency-cruiser.cjs`: six named, rationale-commented rules freezing
  the layering — gates/hooks may import telemetry only; controller imports
  nothing above it (gates stay subprocesses so verdict authority is the exit
  code); nothing imports live/; no prod→tests imports; no cycles.
  **dependency-cruiser, not eslint-boundaries**: this repo lints with Biome
  (no ESLint), and 04-validate.md names either tool for this layer.
- `npm run lint` = `biome check . && depcruise harness tests` — boundaries
  ride the existing lint step, so gate-ci and CI enforce them with zero new
  wiring.
- Rider: `qs` moderate vulnerability (GHSA-q8mj-m7cp-5q26, via
  @stryker-mutator/core → typed-rest-client) fixed with a `^6.15.2` override
  — `npm audit` now clean; closes the open Dependabot alert.

## Capabilities

### New Capabilities

- `architecture-fitness`: layering rules are executable and ride the lint
  step; violations fail the gate naming the broken rule.

### Modified Capabilities

<!-- none — gate-ci's contract (run the bound lint command) is unchanged -->

## Impact

- package.json (lint script, devDep, override), package-lock, new config
  file. No protected paths, no test changes.
- Proof: lint green on the current graph (24 modules); red drill — a seeded
  `gates → controller/loop.mjs` import failed lint naming
  `gates-only-resolve-and-telemetry`, then reverted.
