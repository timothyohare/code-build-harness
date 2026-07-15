# security-scanners — design

## Context

The repo's quality gates (gates, guard) run per-PR; nothing scans for
vulnerable code patterns, committed secrets, or vulnerable dependencies.
M2's plan (docs/harness/architecture.md) calls for Semgrep/Gitleaks/Trivy
per-PR. The repo is a solo-maintainer public GitHub repo on the free plan —
no org features, no paid scanner tiers.

## Goals / Non-Goals

**Goals:**
- Every PR gets SAST, secret, and dependency scanning with a red check on
  findings — executable proof, zero manual steps.
- Free-tier, no accounts or tokens beyond `GITHUB_TOKEN`.
- Findings readable directly in the job log.

**Non-Goals:**
- Ruleset "required check" wiring (human follow-up once stable).
- A local `harness/gates/security.mjs` mirror — CI-only for now; a local
  gate can be a later CHG if the feedback loop wants it.
- SARIF upload / code-scanning dashboards (needs GitHub Advanced Security
  choices; log output is enough at this scale).
- Scheduled full-repo scans; PR-triggered only.

## Decisions

- **One workflow, three parallel jobs** (`semgrep`, `gitleaks`, `trivy`) in
  `.github/workflows/security.yml`, trigger `pull_request`. Parallel jobs
  give independent pass/fail signals per scanner class instead of one muddy
  verdict.
- **Semgrep**: run in the official `semgrep/semgrep` container with
  `semgrep scan --config auto --error`. `--error` exits non-zero on findings;
  `--config auto` pulls the registry ruleset without an app token.
- **Gitleaks**: `gitleaks/gitleaks-action@v2` with `fetch-depth: 0` so full
  history is scanned. Free for user-owned repos (no `GITLEAKS_LICENSE`).
- **Trivy**: `aquasecurity/trivy-action` `scan-type: fs`, scanners
  `vuln,secret,misconfig`, `severity: HIGH,CRITICAL`, `exit-code: 1`,
  `ignore-unfixed: true`. Redundant secret coverage with Gitleaks is fine —
  different engines, cheap.
- **Plain `pull_request` trigger**, not `pull_request_target`: scanners must
  check out the PR head to be useful; the guard workflow already covers the
  tamper-proofing concern separately.
- **No pinned rule versions**: `--config auto` and default Trivy DBs drift
  intentionally — new rules catching old code is the desired behavior; a red
  from rule drift is reviewed, then fixed or suppressed inline with a
  reviewed comment (same posture as the mutation gate's `// Stryker disable`).

## Risks / Trade-offs

- **Rule drift can red an untouched PR** — accepted; suppressions are inline
  and reviewed, never blanket config cuts.
- **`--config auto` sends metrics to Semgrep's registry** — acceptable for a
  public repo.
- **gitleaks-action v2 licensing** changed for org repos before; this is a
  user-owned repo where it stays free. If that changes, swap to running the
  gitleaks binary directly (documented escape hatch).
- **Checks are informative until Tim edits the ruleset** — a red scanner
  won't block merge yet; follow-up task records this.
