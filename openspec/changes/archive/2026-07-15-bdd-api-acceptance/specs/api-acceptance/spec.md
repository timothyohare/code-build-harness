# api-acceptance

## ADDED Requirements

### Requirement: Behavioural acceptance scenarios

The acceptance suite for a repo with an HTTP API SHALL express its checks as
named behavioural scenarios (given/when/then over HTTP requests and
responses), and the bound `acceptance` command SHALL exit non-zero when any
scenario fails.

#### Scenario: Failing API behaviour reds the gate

- **WHEN** the booted app violates a scenario's expected response (status,
  body shape, or value)
- **THEN** the acceptance command exits non-zero and gate-verify reports the
  failing scenario by name

### Requirement: Scenario-to-endpoint coverage is reviewable

The acceptance suite SHALL live in version-controlled feature files so the
covered endpoints and behaviours are readable in the diff without running
anything.

#### Scenario: New endpoint lands with a scenario

- **WHEN** a PR adds an API endpoint and its acceptance scenario
- **THEN** the scenario file names the endpoint and expected behaviour in
  reviewable plain text
