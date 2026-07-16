# architecture-fitness

## ADDED Requirements

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
