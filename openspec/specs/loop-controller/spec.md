# loop-controller Specification

## Purpose
TBD - created by archiving change survivor-feedback-loop. Update Purpose after archive.
## Requirements
### Requirement: Optional mutation gate

The loop controller SHALL run an injected `mutation` gate after the `ci` gate
passes, and SHALL complete the task green only when it passes. Loops with no
`mutation` gate injected MUST behave exactly as before.

#### Scenario: Green task requires mutation pass when injected

- **GIVEN** a loop with a `mutation` gate that passes
- **WHEN** red, green, and ci pass
- **THEN** the task completes green after the mutation gate runs

### Requirement: Survivor-strengthening routing

After a mutation red, the loop controller SHALL route the next iteration to a
test-writer `strengthen-tests` step carrying the mutation gate's detail as
feedback, SHALL verify the suite GREEN afterward, and MUST NOT run RED
verification (a survivor-killing test passes on the real implementation by
design). ci and mutation SHALL re-run before the task can go green.

#### Scenario: Mutation red triggers strengthen, not a new failing test

- **GIVEN** a mutation gate that fails once naming a survivor, then passes
- **WHEN** the loop runs
- **THEN** iteration 2 executes `strengthen-tests` with the survivor detail
  as feedback, the red gate runs exactly once, and the task ends green

### Requirement: Strengthen mode is sticky

The loop controller SHALL remain in survivor-strengthening mode across green
or ci reds until the mutation gate passes or the task escalates; it MUST NOT
return to the write-failing-test step once ci has passed for the task.

#### Scenario: Broken strengthening test retries strengthening

- **GIVEN** strengthen mode where the strengthened suite goes red
- **WHEN** the next iteration starts
- **THEN** it runs `strengthen-tests` again (with the green failure as
  feedback), not `write-failing-test`

### Requirement: Escalation parity

Mutation gate reds SHALL count toward the same D-11 escalation caps as every
other gate: three consecutive reds or the total-iteration cap escalate with a
handoff note.

#### Scenario: Persistent survivors escalate

- **GIVEN** a mutation gate that always fails
- **WHEN** it reds three consecutive times
- **THEN** the task escalates citing gate 'mutation'
