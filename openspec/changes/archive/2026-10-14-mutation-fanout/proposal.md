# mutation-fanout

## Why

gate-mutation ("grade the graders") was bound in 7 repos. Fan it out to the
remaining live repos with real unit-tested logic.

## What Changes

- **FifaWorldCupMonteCarloSim** (PR #9): Stryker over domain/model/engine
  (minus generated annex-c.ts). Baseline 79.38% → break 79.
- **strengthtraining** (PR #2): Stryker over the program engine + mock-free lib
  helpers. Baseline 87.00% → break 87. pnpm needs the runner plugin named
  explicitly; ESLint must ignore `.stryker-tmp/**` or a leftover sandbox fails lint.
- Thresholds are measured baselines used as ratchets — raise, never lower.
- **Skipped:** nrl-predictor2 (archived — code now lives in nrl-predictor,
  whose gate already covers the same modules at 100%; a local-only branch with
  Tim's binding commit b92b88d remains for him to delete), harness-demo (not a
  git repo), windeyer (static Hugo site, no unit logic worth mutating).

## Capabilities

<!-- none — gate-mutation spec unchanged; consumer bindings only -->

## Impact

Two consumer PRs. Fuzz fan-out to these repos is NOT included: none has an
OpenAPI document, which must be authored first.
