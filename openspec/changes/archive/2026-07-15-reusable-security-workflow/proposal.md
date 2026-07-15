# reusable-security-workflow

## Why

CHG-0023 shipped per-PR security scanning for this repo only. Every other
project (nrl-predictor, kickpool, aitutor, …) gets nothing unless the three
jobs are copy-pasted, which drifts. The scanners should be defined once and
consumed everywhere, matching the harness pattern of central gates +
per-repo bindings.

## What Changes

- `.github/workflows/security.yml` job definitions move to a reusable
  workflow `.github/workflows/security-reusable.yml` (`on: workflow_call`,
  `include-dev-deps` input for the Trivy dev-dependency toggle).
- This repo's `security.yml` becomes a thin caller of the reusable workflow
  (same-repo `uses: ./…` — dogfoods the exact path consumers use).
- Check contexts change from `semgrep`/`gitleaks`/`trivy` to
  `security / semgrep` etc. — the `main-protection` ruleset's required
  checks are updated to match as part of landing this change.
- **Pilot: nrl-predictor** gets a caller workflow pinned `@main`, plus the
  triage its first scan demands (SHA-pin ci.yml actions, two inline
  `nosemgrep` annotations, `.gitleaksignore` for 20 CloudFormation asset-hash
  false positives).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `security-scanning`: adds the single-source distribution requirement —
  scanners defined once, consumed by thin callers.

## Impact

- This repo: `.github/workflows/**` (protected — PR needs Tim's
  `harness-config-approved` label); ruleset required-check contexts renamed.
- nrl-predictor: new caller workflow, ci.yml pin fixes, suppression files;
  its PR is the cross-repo live drill.
- Other repos: unchanged until rolled out (follow-up per repo).
