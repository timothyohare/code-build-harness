# enterprise-docs-refresh

## Why

Tim is sharing the harness with his enterprise setup. The shareable docs were
design-era snapshots: README said "answering QUESTIONS.md unblocks M0" (M2 is
live), CLAUDE.md claimed 18 tests and two commands (86 tests, six gates, five
required checks), and enterprise-adoption.md listed prerequisites that
completed ten days ago. A stale payload undermines the core pitch — that the
register and records are trustworthy.

## What Changes

- `docs/harness/README.md`: new **Current state** section — what is built and
  live (gates, security scanning distribution, trust model, specs of record,
  telemetry, reference repos); design-era framing retained as the record.
- `CLAUDE.md`: commands/proof section refreshed (Biome lint, 86-test suite,
  mutation command, gate roster, reusable security workflow); required checks
  list now names all five.
- `docs/enterprise-adoption.md`: status current; stale prerequisites rewritten
  as completed sequencing evidence; payload checklist extended (openspec
  specs, reusable-workflow pattern, pilot drill records).
- `docs/harness/legacy-parity.md`: step 6 marked COMPLETE — **6b executed
  2026-07-16** (shims + backup deleted, prose swept, zero live references
  verified before deletion, resolver re-verified after).

## Capabilities

### New Capabilities

<!-- none — documentation only -->

### Modified Capabilities

<!-- none — no capability contract changes -->

## Impact

Docs + CLAUDE.md only; no code, tests, or protected paths. The 6b deletion
itself happened in `~/.claude` (machine config, outside the repo) — this
change records it.
