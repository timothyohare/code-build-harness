# Tasks: CHG-0030

- [x] Document the model-topology analysis and implementation plan.
- [x] Route GREEN and CI retries to the builder and persist ownership.
- [x] Add role routing and an ephemeral Codex CLI executor.
- [x] Route live test writing to Codex and implementation to Claude.
- [x] Add deterministic review packages and a JSON review schema.
- [x] Add fail-closed review parsing, confidence filtering, and owner routing.
- [x] Add the executable review CLI.
- [x] Run Codex test writing read-only and apply only validated test-owned proposals.
- [x] Reject traversal, symlink escapes, protected paths, duplicates, and oversized output.
- [x] Harden project-root resolution against synthetic `/tmp/.git` markers.
- [x] Add post-validation review orchestration with owner-routed corrections.
- [x] Persist review attempts and fail-closed human handoffs.
- [x] Replace the hardcoded live task with validated JSON input.
- [x] Add a deterministic end-to-end fixture pilot and seeded-defect metrics.
- [x] Add input-driven supervised execution using real Claude and Codex CLIs.
- [x] Pass `node harness/gates/ci.mjs --force --full` (122/122 tests).
- [x] Pass `node harness/gates/mutation.mjs` (100% mutation score).
