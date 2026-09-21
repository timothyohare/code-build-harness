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

## Failure Policy

Malformed output, insufficient context, process failure, timeout, and package overflow
all fail closed. Low-confidence findings remain advisory and never trigger edits.

## Deferred Work

- Cheap-model judging of primary-review quality.
- Seeded-defect experiments and production model pinning.
