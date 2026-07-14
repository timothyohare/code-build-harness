# security-scanners

## Why

M2 requires per-PR security scanning so vulnerable code, leaked secrets, and
vulnerable dependencies are caught by an executable gate before merge — the
same "proof, not claim" contract the other gates enforce. Today nothing scans
PRs for these classes at all.

## What Changes

- New GitHub Actions workflow `.github/workflows/security.yml` running on
  every pull request with three independent jobs:
  - **Semgrep** (SAST) — static analysis over the repo's JS/config surface
  - **Gitleaks** (secrets) — full-history secret detection
  - **Trivy** (dependencies/misconfig) — filesystem scan of lockfile
    dependencies and config files, gating on HIGH/CRITICAL
- Each job fails its check on findings; findings surface in the job log.
- Not wired into the branch ruleset's required checks yet — that is a human
  (Tim) ruleset edit once the checks prove stable; noted as a follow-up.

## Capabilities

### New Capabilities

- `security-scanning`: per-PR scanning contract — which scanners run, when
  they fail the check, and how findings are surfaced.

### Modified Capabilities

<!-- none — no existing capability's requirements change -->

## Impact

- New file: `.github/workflows/security.yml` (protected path — PR needs Tim's
  `harness-config-approved` label).
- No source, test, or binding changes; existing gates untouched.
- External actions pinned by major version: `semgrep/semgrep` container,
  `gitleaks/gitleaks-action@v2`, `aquasecurity/trivy-action`.
