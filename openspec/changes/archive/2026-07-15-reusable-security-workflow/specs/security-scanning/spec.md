# security-scanning

## ADDED Requirements

### Requirement: Single-source scanner distribution

The scanner job definitions SHALL live in exactly one reusable workflow
(`workflow_call`) in the harness repository, and consumer repositories SHALL
run them through a thin caller workflow, so that scanner and configuration
updates propagate to every consumer without per-repository edits.

#### Scenario: Consumer repository runs scanners via caller

- **WHEN** a pull request is opened in a consumer repository whose caller
  workflow references the harness reusable security workflow
- **THEN** the `semgrep`, `gitleaks`, and `trivy` jobs run and report checks
  on that pull request

#### Scenario: Scanner update propagates without consumer edits

- **WHEN** the reusable workflow's scanner configuration changes on the
  harness repository's default branch
- **THEN** subsequent consumer pull requests run the updated configuration
  with no change to the consumer repository
