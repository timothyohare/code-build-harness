# CHG-0013: Enterprise adoption, documentation plan, and working practices docs

## Why

The harness exploration has produced transferable findings (decisions register,
enforcement patterns, agent-direction practices) that Tim needs to carry into his
enterprise environment. Without a written plan, the transfer defaults to "show the
internal model the docs and ask for something similar" — which silently inherits
assumptions that are false in the enterprise. The strategy was worked out on
2026-07-05 and needs to land in the repo before M-parity work begins, because it
records two sequencing constraints that gate that work.

## What Changes

- Add `docs/enterprise-adoption.md`: transfer sequence (constraints doc →
  re-litigate decisions register → gap-analysis build), server-side enforcement
  pitch, pilot/metric/rollback additions, and repo sequencing rules (M-parity
  first; no `harness.json` changes in bound repos before cutover).
- Add `docs/documentation-plan.md`: Diátaxis gap analysis, prioritized doc gap
  list, write-after-parity sequencing rule, executable-docs rule.
- Add `docs/working-practices.md`: agent-direction patterns, refinements, and
  anti-patterns distilled from building the harness.

Documentation only — no code, hooks, gates, or config change.

## Capabilities

### New Capabilities

None — no executable behavior is introduced. This change adds planning/strategy
documentation only, so no spec files are created.

### Modified Capabilities

None.

## Impact

- `docs/` gains three files. No source, test, or workflow paths touched, so the
  `guard` check needs no labels and the Stop-hook source-changed guard is not
  triggered.
- `docs/harness/legacy-parity.md` remains the canonical M-parity plan; the new
  docs reference it rather than duplicating it.
