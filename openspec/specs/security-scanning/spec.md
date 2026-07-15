# security-scanning Specification

## Purpose

Per-PR security scanning contract: which scanners run, when they fail the
check, and how findings are surfaced and suppressed. Enforced by
`.github/workflows/security.yml` (CHG-0023).

## Requirements

### Requirement: Per-PR scanner coverage

The repository SHALL run Semgrep (SAST), Gitleaks (secret detection over full
git history), and Trivy (dependency, secret, and misconfiguration filesystem
scan) as independent CI jobs on every pull request.

#### Scenario: Pull request triggers all three scanners

- **WHEN** a pull request is opened or updated
- **THEN** the `semgrep`, `gitleaks`, and `trivy` jobs each run and report an
  independent check result

### Requirement: Findings fail the check

Each scanner job SHALL exit non-zero when it finds an issue at or above its
configured severity (Trivy: HIGH/CRITICAL; Semgrep and Gitleaks: any
finding), and the findings MUST be readable in the job log.

#### Scenario: Seeded secret reds gitleaks

- **WHEN** a commit containing a detectable secret is pushed to a PR branch
- **THEN** the `gitleaks` check fails and the log names the offending commit
  and rule

### Requirement: Suppressions are inline and reviewed

False positives and accepted findings SHALL be suppressed with inline,
reviewable annotations (e.g. `// nosemgrep`-style rule comments,
`.gitleaksignore` entries, `.trivyignore` entries) — never by lowering a
severity threshold or disabling a scanner.

#### Scenario: Accepted finding is visible in the diff

- **WHEN** a finding is accepted as a false positive
- **THEN** the suppression appears as a reviewable line in the PR diff and
  the scanner returns green without any threshold change
