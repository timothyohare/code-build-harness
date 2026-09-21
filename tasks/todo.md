# Claude and ChatGPT Collaboration Tasks

## Task 1: Route retries to the owning role

**Acceptance criteria:**

- [x] A builder GREEN failure retries the builder without rewriting tests.
- [x] A builder CI failure retries the builder without rewriting tests.
- [x] Test-strengthening failures remain with the test writer.
- [x] Retry ownership survives persisted-state resume.

**Verification:** controller tests and `node harness/gates/ci.mjs --force`.

## Task 2: Route roles to independent executors

**Acceptance criteria:**

- [x] Role routing maps test-writer and reviewer to Codex.
- [x] Role routing maps builder to Claude.
- [x] Missing role mappings fail clearly.

**Verification:** focused router tests.

## Task 3: Add the Codex CLI executor

**Acceptance criteria:**

- [x] Test writing runs ephemerally with read-only access and validated proposal application.
- [x] Review runs ephemerally with read-only access and structured output.
- [x] Exit failures, timeouts, and malformed output fail closed.

**Verification:** focused executor tests.

## Task 4: Integrate cross-family live execution

**Acceptance criteria:**

- [x] Live controller composes Claude and Codex executors through the router.
- [x] Existing executor telemetry contract remains supported.

**Verification:** routing integration tests and fast CI gate.

## Task 5: Build deterministic review packages

**Acceptance criteria:**

- [x] Package contains spec, plan, diff, tests, and gate evidence in stable order.
- [x] Package enforces a configured byte budget without silent truncation.

**Verification:** focused package-builder tests.

## Task 6: Validate and route review findings

**Acceptance criteria:**

- [x] Invalid review output fails closed.
- [x] Low-confidence findings are non-blocking.
- [x] Coverage findings route to test-writer; implementation findings route to builder.
- [x] Insufficient context is explicit and blocking.

**Verification:** focused review tests, full CI gate, and mutation gate.

## Task 7: Enforce Codex test paths locally

**Acceptance criteria:**

- [x] Codex test-writing sessions have read-only sandbox access.
- [x] Model output is schema constrained and parsed as untrusted input.
- [x] Only test-owned repository-relative paths are applied.
- [x] Traversal, protected paths, symlink escapes, duplicates, empty proposals, and oversized output fail closed.

**Verification:** security-focused proposal tests, full CI gate, and mutation gate.

## Rollout Tasks

- [ ] PR 1: Ship the two-family foundation.
- [ ] PR 2: Integrate automatic review and correction orchestration.
- [ ] PR 3: Add the supervised pilot and seeded-defect evaluation.
- [ ] PR 4: Remediate high-severity development dependency advisories independently.
