# Design — CHG-0013

Documentation-only change; the "design" is the document structure, which already
exists in the working tree (written 2026-07-05, this session).

## Decisions

- **Three separate docs, not one.** Enterprise transfer, documentation gaps, and
  working practices have different audiences and lifecycles (the transfer plan is
  consumed once; working practices are living guidance). Splitting keeps each
  linkable from the enterprise side without dragging the others along.
- **Located in `docs/`, not `docs/harness/`.** `docs/harness/` is the harness's own
  design corpus (the thing being transferred); these three are *about* moving and
  operating it, so they sit one level up. Each cross-references
  `docs/harness/legacy-parity.md` and `decisions.md` rather than duplicating them.
- **Sequencing constraints recorded where they bite.** The "no `harness.json`
  changes in bound repos before cutover" rule lives in `enterprise-adoption.md`
  §Sequencing (and project memory) so it is on the record before M-parity starts.

## Alternatives considered

- Fold into `docs/harness/extensions.md` — rejected: extensions.md is about harness
  capabilities, not adoption strategy.
- Wait until after M-parity — rejected: the docs gate M-parity sequencing decisions
  and would go stale in a working tree.
