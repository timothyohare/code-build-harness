# reusable-security-workflow — design

## Context

Three scanner jobs exist in this repo's `security.yml` (CHG-0023). All
target repos are public, user-owned, free plan — org-level "required
workflows" are unavailable, so distribution must be caller-file-per-repo.
This repo is public, so any repo can `uses:` its workflows.

## Goals / Non-Goals

**Goals:**
- One definition of the scanner jobs; consumers carry only a thin caller.
- Scanner/config updates propagate to all consumers without per-repo edits.
- Pilot proves the cross-repo path on a real brownfield repo (nrl-predictor).

**Non-Goals:**
- Rolling out to every repo in this change (pilot only; fan-out is
  mechanical repetition afterwards).
- Local `harness/gates/security.mjs` mirror (still deferred from CHG-0023).
- Version-pinned callers (`@v1` tags) — start `@main`, revisit if a scanner
  update ever breaks consumers.

## Decisions

- **`workflow_call` reusable workflow** in this repo,
  `security-reusable.yml`, containing the three jobs verbatim from
  CHG-0023. Input `include-dev-deps` (boolean, default `false`) drives
  `TRIVY_INCLUDE_DEV_DEPS`; this repo's caller passes `true` (all deps are
  devDeps that run in CI), consumers with real runtime deps take the
  default.
- **This repo's `security.yml` becomes a caller** (`uses:
  ./.github/workflows/security-reusable.yml`) rather than keeping a
  standalone copy — same code path as consumers, no drift.
- **Callers pin `@main`** — scanner updates propagate immediately.
  Trade-off accepted: a bad update reds every consumer PR at once; revert in
  one repo fixes all.
- **`github.token` inside the reusable workflow** for gitleaks — always
  injected, so callers need no `secrets: inherit`.
- **Required-check contexts change**: nested jobs report as
  `security / semgrep` etc. The `main-protection` ruleset is updated to the
  new contexts (verified against the PR's actual check names) before the PR
  merges — otherwise the old required contexts never report and the PR
  deadlocks.
- **Pilot triage posture** (same as CHG-0023): fixes over suppressions where
  cheap (SHA-pin the mutable action tags semgrep flags); inline reviewed
  suppressions otherwise (`# nosemgrep` on the intentional dynamic
  import/urllib uses; `.gitleaksignore` fingerprints for the 20
  CloudFormation asset-hash false positives in
  `tasks/baseline/v{1,2}.template.json` @ 5fa28ada). Never threshold cuts.

## Risks / Trade-offs

- **`@main` blast radius** — a broken reusable workflow reds all consumers;
  accepted for a solo maintainer, escape hatch is pinning a SHA in callers.
- **Check-context rename** — any future automation matching bare
  `semgrep`/`gitleaks`/`trivy` contexts must use the nested names.
- **Trivy local runs on brownfield repos** can time out walking untracked
  build dirs (`.venv/`, `cdk.out/`) — local-proof recipe uses
  `--skip-dirs`; CI checkouts contain only tracked files and are unaffected.
