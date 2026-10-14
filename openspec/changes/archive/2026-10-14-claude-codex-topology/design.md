# Design: Two-Family Execution

## Components

- `createRoleRouter` preserves the controller's executor contract while selecting a
  model-family adapter by role.
- `createCodexExecutor` runs all Codex sessions read-only. Test authoring returns a
  schema-constrained full-file proposal that the harness validates and applies;
  review uses its own JSON schema and remains non-mutating.
- The loop persists `retryOwner`; GREEN/CI failures retry the builder, while RED and
  mutation-strengthening failures stay with the test writer.
- The review package builder emits evidence in a stable order and rejects oversized
  input rather than truncating it.
- The review runner validates the final JSON again in process, then routes coverage
  findings to the test writer and other high-confidence findings to the builder.
- The delivery loop starts independent review only after deterministic build
  validation is green. Its review state machine corrects test-owned findings first,
  then implementation findings, runs owner-specific gates, and requests a fresh
  review from rebuilt evidence.

## Failure Policy

Malformed output, insufficient context, process failure, timeout, and package overflow
all fail closed. Low-confidence findings remain advisory and never trigger edits.
Critical findings are never corrected automatically; they immediately produce a
persisted state file and human handoff. Other blocking findings receive at most two
review rounds by default.

## Deferred Work

- Cheap-model judging of primary-review quality.
- Production model pinning after supervised seeded-defect results are collected.

## Pilot Evaluation

The fixture pilot deterministically exercises the complete build, validation,
review, correction, re-review, and telemetry path. The supervised live command uses
the same validated task input with real Claude and Codex executors. Seed metadata is
kept out of the review package; evaluation compares observed findings with expected
owner/category plus a finding ID or evidence marker.
