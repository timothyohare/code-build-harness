# CHG-0030: Claude Builder and Codex Test/Review Topology

## Why

The executable loop used Claude for both test writing and implementation, while the
documented cross-family review phase was not implemented. Gate failures also returned
to the test writer regardless of which artifact failed, causing unnecessary test
churn after implementation failures.

## What Changes

- Route test writing and independent review to ephemeral Codex CLI sessions.
- Keep implementation with the existing Claude CLI builder.
- Persist deterministic retry ownership in the build controller.
- Add bounded review packages, structured review validation, confidence filtering,
  and finding-to-owner routing.
- Record the two-family topology as decision D-26.

## Scope

This change implements the primary reviewer but deliberately defers the cheap review
judge until primary-review efficacy can be measured. Codex test writing is locally
enforced through read-only model sessions and validated proposal application, with CI
remaining the authoritative remote backstop.
