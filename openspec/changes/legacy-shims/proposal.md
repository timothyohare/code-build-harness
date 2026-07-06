# CHG-0020: Legacy harness shimmed (M-parity step 6a)

## Why

Tim reviewed the M-parity execution record and approved step 6 (2026-07-06).
The legacy `~/.claude/{bin,lib}` layer is now forwarding shims; this change
puts that on the record in the parity doc.

## What Changes

- `docs/harness/legacy-parity.md`: step-6 row updated from open/human-gated to
  shims-in-place, with verification evidence, backup location, and the
  remaining removal step (after one quiet release).
- Outside the repo (recorded, not diffed here): five one-line shims in
  `~/.claude/{bin,lib}`, originals backed up to
  `~/.claude/bin/.legacy-originals-2026-07-06/`, and `~/.claude/CLAUDE.md`
  gate paths repointed to `harness/gates/`.
- Carries the CHG-0019 bundle archive.

## Capabilities

### New Capabilities

None — documentation of an environment change.

### Modified Capabilities

None.

## Impact

- Anything still invoking the old paths (skills, agents, memory notes, docs)
  keeps working through the shims until removal.
