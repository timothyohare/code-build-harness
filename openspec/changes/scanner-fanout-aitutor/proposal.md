# scanner-fanout-aitutor

## Why

Recorded CHG-0024 follow-up: fan the per-PR security scanners out to the
remaining bound repos. aitutor (timothyohare/aitutor, private) has no
security scanning at all; the reusable workflow exists precisely so adding a
consumer is a thin caller file plus first-scan triage.

## What Changes

- aitutor gains `.github/workflows/security.yml` — thin caller of
  `timothyohare/code-build-harness/.github/workflows/security-reusable.yml@main`
  (same file as nrl-predictor's, CHG-0024 pilot).
- First-scan triage: run all three scanners locally (docker recipe from
  CHG-0023) against the full local tree/history; fix real findings,
  suppress false positives inline (`# nosemgrep` reviewed comments,
  `.gitleaksignore`, `.trivyignore.yaml`), never threshold cuts.
- PR branches from `origin/main` (local main is 4 commits ahead — Tim's
  unpushed work stays local; the PR carries only fan-out files).

## Capabilities

<!-- none new/modified — security-scanning's "Single-source scanner
distribution" requirement already covers consumer repos; this applies it to
a new consumer. -->

- Rider (harness repo): `security-reusable.yml` drops its top-level
  `permissions:` block — a called workflow's permissions CAP the caller's
  grant, so it silently downgraded every consumer to `contents: read` and
  403'd gitleaks-action's PR-commits API call on private repos. Jobs now
  inherit the caller's grant; callers declare least privilege (private
  repos add `pull-requests: read`).

## Impact

- aitutor: one workflow file + suppression files as triage requires. No
  harness code changes; this repo gets the bundle + telemetry only.
- **Constraint discovered**: aitutor is private on a free plan — rulesets /
  branch protection (and therefore *required* checks) are unavailable
  (HTTP 403 "Upgrade to GitHub Pro or make this repository public").
  Scanners run and report on every PR but cannot block merge until the repo
  is public or the plan upgrades. Recorded here; kickpool (public) will get
  full required-check wiring in its own fan-out.
