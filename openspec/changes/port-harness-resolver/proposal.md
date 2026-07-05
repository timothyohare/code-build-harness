# CHG-0014: Port the legacy harness resolver into harness/gates/

## Why

M-parity step 1 (`docs/harness/legacy-parity.md`, D-25): this harness replaces the
legacy user-level gate layer at `~/.claude/{bin,lib}`. Everything else in the
migration depends on the resolver — the module that turns a repo's
`.claude/harness.json` binding (or autodetection) into concrete commands. The
legacy module has no tests; the port adds them.

## What Changes

- Add `harness/gates/resolve.mjs`: port of `~/.claude/lib/harness.mjs` (128
  lines), behavior unchanged — `findProjectRoot`, `loadConfig`, `resolveKey`,
  autodetection for Node/Next.js, Python (+ Next frontend subdir), SAM/Lambda.
- Add `harness/gates/resolve-cli.mjs`: port of `~/.claude/bin/harness-resolve.mjs`
  (25 lines), import path updated to the new module.
- Add `tests/resolve.test.mjs`: unit tests over synthesized temp-dir fixtures
  (legacy had none — 🆕 per the parity matrix).
- Also carries the archive move of the completed CHG-0013 bundle (bookkeeping;
  main is PR-only so it rides here).

## Capabilities

### New Capabilities

- `harness-resolver`: resolve a project's effective harness config from explicit
  `.claude/harness.json` binding overlaid on runtime autodetection, with the
  absent-key ⇒ no-op contract.

### Modified Capabilities

None.

## Impact

- New files under `harness/gates/` (unprotected path) and `tests/` (needs the
  `tests-approved` label on the PR per the trust model).
- No behavior change to any existing module; the loop controller keeps its
  interim inline npm shelling until CHG-0015.
- The `harness.json` schema is unchanged (D-25 compatibility rule).
