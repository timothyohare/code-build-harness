# typecheck-double-run

## Why

This repo's binding set `typecheck: "npm test"`. gate-ci runs lint → typecheck
→ test, and the resolver already autodetects `test` as `npm test`, so every
gate-ci run (including the Stop hook) executed the full suite twice. The
"typecheck" step proved nothing a type checker would: the repo is plain
`.mjs` with no type system, so the label was misleading as well as slow.

## What Changes

- `.claude/harness.json`: drop the `typecheck` key. The resolver leaves
  typecheck unset (it only autodetects one from a `typecheck` npm script,
  mypy config, etc.), so gate-ci skips the step. Tests still run exactly once
  via the autodetected `test` binding. Nothing that was checked before stops
  being checked.

## Capabilities

<!-- none new/modified — gate-ci's existing "skip unresolved steps" behavior
covers this; binding-only change. -->

## Impact

- gate-ci on this repo: steps `lint, test` (was `lint, typecheck, test`),
  roughly one suite-run faster per Stop hook.
- Human-only path (`.claude/**`): PR needs `harness-config-approved`.
