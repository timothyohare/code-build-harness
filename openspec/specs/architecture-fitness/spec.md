# architecture-fitness Specification

## Purpose

Executable layering contract: `.dependency-cruiser.cjs` encodes the
harness's module boundaries as six named, rationale-commented rules
(no-circular, gates-only-resolve-and-telemetry, hooks-only-telemetry,
controller-imports-nothing-above, nothing-imports-live,
no-prod-import-of-tests), and `npm run lint` runs `depcruise` after Biome —
so gate-ci and CI enforce the architecture with zero new wiring. Established
by CHG-0028; red drill proved a seeded gates→controller import fails lint
naming the rule.

## Requirements

### Requirement: Layering rules ride the lint step

The repository SHALL encode its module layering as named dependency rules
with rationale comments, and the bound `lint` command SHALL exit non-zero
when any rule is violated, naming the rule and the offending edge.

#### Scenario: Forbidden import reds the lint gate

- **WHEN** a module gains an import its layer forbids (e.g. a gate importing
  the loop controller)
- **THEN** `npm run lint` exits non-zero and names the violated rule and the
  from→to edge

### Requirement: Subprocess boundary between controller and gates

The loop controller SHALL NOT import gate modules; gates run as subprocesses
so the verdict authority remains the process exit code.

#### Scenario: Controller importing a gate is a violation

- **WHEN** any module under the controller imports a module under the gates
  directory
- **THEN** the lint step fails with the boundary rule named
