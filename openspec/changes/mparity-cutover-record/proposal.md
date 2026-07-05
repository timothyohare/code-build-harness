# CHG-0019: M-parity execution record + parity matrix status flip

## Why

M-parity steps 1–5 executed on 2026-07-05 (CHG-0014…0018). The parity matrix
still shows every row as 🔜 planned, and the step-5 dual-run cutover results
exist only in a scratchpad. D-25 requires the cutover evidence on the record
before any legacy retirement (step 6).

## What Changes

- `docs/harness/legacy-parity.md`: status-flip note on the feature inventory
  (all 🔜 → ✅, CHG references) and a new "M-parity execution record" section:
  resolver byte-equivalence, gate-ci dual-run verdicts, gate-verify dual-run
  verdicts per bound repo, Stop-hook repoint record, and what remains for
  step 6 (shims + removal — deliberately left for human review).
- Telemetry rows from the dual-runs land in `metrics/events/`.

## Capabilities

### New Capabilities

None — documentation and telemetry only.

### Modified Capabilities

None.

## Impact

- Docs + metrics only. Step 6 (replacing `~/.claude/{bin,lib}` with shims,
  then removal) remains open and human-gated.
