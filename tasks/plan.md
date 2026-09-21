# Implementation Plan: Claude Builder and ChatGPT Test/Review Roles

## Overview

Extend the existing build harness so failures return to the role that owns the
failing artifact, ChatGPT/Codex writes tests, Claude writes implementation code, and
a fresh ChatGPT/Codex invocation performs structured review from a deterministic
evidence package.

## Architecture Decisions

- Preserve the controller's injected executor contract and add a role router rather
  than coupling the controller to either CLI.
- Route retries from deterministic controller state; do not ask an LLM to classify
  its own failure.
- Keep primary review separate from the build loop so deterministic validation stays
  the prerequisite for inferential review.
- Validate review output against explicit code-level invariants before accepting it.
- Leave the judge as a subsequent slice; primary review must be measurable first.

## Task List

### Phase 1: Correct Build Ownership

- [x] Task 1: Preserve the active owner when GREEN or CI fails
- [x] Task 2: Add role-based executor routing

### Checkpoint: Build Loop

- [x] Focused controller and executor tests pass
- [x] Fast CI gate passes

### Phase 2: Add Codex Roles

- [x] Task 3: Add an ephemeral Codex CLI executor for test writing
- [x] Task 4: Route the live test-writer to Codex and builder to Claude

### Checkpoint: Cross-Family Build

- [x] Executor argument, prompt, parsing, and routing tests pass
- [x] Fast CI gate passes

### Phase 3: Structured Review

- [x] Task 5: Build a deterministic, bounded review package
- [x] Task 6: Add schema-validated Codex review execution
- [x] Task 7: Add confidence filtering and deterministic finding ownership

### Checkpoint: Independent Review

- [x] Review unit tests pass, including invalid-output and insufficient-context cases
- [x] Full CI gate passes
- [x] Mutation gate passes

### Phase 4: Codex Test-Path Enforcement

- [x] Task 8: Make Codex test-writing sessions read-only
- [x] Task 9: Validate schema-constrained test-file proposals
- [x] Task 10: Reject traversal, protected paths, symlink escapes, duplicates, and oversized output

### Checkpoint: Local Test Boundary

- [x] Security-focused proposal application tests pass
- [x] Full CI and mutation gates pass

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Codex CLI contract changes | Medium | Isolate CLI details and unit-test arguments/parsing |
| Retry routing corrupts resumable state | High | Persist owner/mode and test resume paths |
| Review input becomes too large | Medium | Deterministic byte budget and explicit insufficient-context result |
| Reviewer prose bypasses validation | High | Accept JSON only and fail closed |
| Existing dirty metrics are overwritten | High | Exclude metrics from edits and inspect diffs before completion |

## Open Questions

- Which production Codex model should be pinned after the first measured pilot?
- Should the later review judge use a cheap Claude model or a cheap OpenAI model?
- What review-package byte budget best fits the selected production model?

## Rollout Plan

### PR 1: Two-Family Foundation

- [ ] Commit the completed Claude builder/Codex test-writer and reviewer foundation.
- [ ] Exclude pre-existing `metrics/events/**` working-tree changes.
- [ ] Push `feature/claude-codex-foundation` and open a PR to `main`.
- [ ] Apply `harness-config-approved` and `tests-approved` when available.

**Acceptance criteria:** full CI, mutation, and diff checks pass; the PR contains the
OpenSpec bundle and no unrelated metrics history.

### PR 2: Automatic Review Orchestration

- [ ] Add a review state machine after deterministic validation.
- [ ] Route implementation findings to Claude and coverage findings to Codex.
- [ ] Re-run owner-specific and final gates after corrections.
- [ ] Persist review state, findings, attempts, and escalation artifacts.
- [ ] Push a stacked branch and open a PR targeting PR 1's branch.

**Acceptance criteria:** tests cover clean review, owner-routed correction,
insufficient context, malformed output, critical findings, and retry-cap escalation.

### PR 3: Supervised Pilot and Seeded-Defect Evaluation

- [ ] Replace the hardcoded live task with an input-driven supervised pilot command.
- [ ] Add deterministic fixture executors for CI and optional real-CLI execution for a human-supervised run.
- [ ] Add seeded correctness, security, and coverage defects with catch-rate metrics.
- [ ] Push a stacked branch and open a PR targeting PR 2's branch.

**Acceptance criteria:** the deterministic end-to-end pilot proves
spec → tests → build → validate → review → correction → final green, and seeded
defect outcomes are emitted to the event log.

### PR 4: Dependency Remediation

- [ ] Create an independent worktree from `main`.
- [ ] Preview minimal dependency upgrades for the high-severity audit findings.
- [ ] Review the lockfile diff and reject unrelated major upgrades.
- [ ] Run full CI, mutation, and `npm audit --audit-level=high`.
- [ ] Push and open an independent PR to `main`.

**Acceptance criteria:** no reachable high/critical audit findings remain and no
quality threshold is weakened.

### Final Checkpoint

- [ ] Every PR is small enough to review independently and has a rollback boundary.
- [ ] All created PRs are attached or linked in the handoff.
- [ ] The cheap judge remains deferred until primary-review pilot metrics exist.
