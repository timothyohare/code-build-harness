# Claude and ChatGPT Collaboration Analysis

## Outcome

Use Claude as the implementation specialist and ChatGPT/Codex as both the test
author and the independent reviewer, with a fresh Codex invocation for each role.
Deterministic gates remain authoritative; model output is evidence and routing
input, never the final quality verdict.

## Current State

The harness already implements the guarded build portion of the lifecycle:

- a persistent controller for test-writer → verified RED → builder → verified
  GREEN → CI → mutation;
- Claude CLI execution with fresh processes and role-specific models;
- role-scoped path protection, iteration caps, handoff notes, and telemetry;
- CI, verification, performance, fuzz, mutation, security, and architecture gates.

The documented M3 review chain is not implemented. There is no Codex executor,
review-package builder, structured review parser, judge, or review-to-build feedback
loop. The current test-writer is also Claude, so the executable workflow does not
yet obtain the intended cross-family independence.

## Recommended Responsibility Split

| Concern | Owner | Reason |
|---|---|---|
| Specification approval | Human | Business intent cannot be inferred safely |
| Failing tests and mutation strengthening | ChatGPT/Codex | Independent executable interpretation of the spec |
| Implementation and refactoring | Claude | Existing builder integration and strong code-generation role |
| Deterministic validation | Harness gates | Reproducible, non-inferential verdicts |
| Primary review | Fresh ChatGPT/Codex session | Cross-family review of Claude output |
| Review quality judge | Cheap model | Scores the review, not the code |
| Disputes and high-risk decisions | Human | Prevents models from self-approving ambiguity |

The test-writer and reviewer must be separate ephemeral invocations. They may use
the same model family, but must not share conversational context. The reviewer must
receive the spec, declared scope, diff, tests, and gate attestations—not the
builder's self-description.

## Critical Controller Defect

The current controller restarts every ordinary retry at the test-writer. A GREEN
failure after Claude implements code therefore sends implementation feedback to the
test-writer and asks for another failing test. A CI failure does the same. This
weakens test ownership, spends iterations unnecessarily, and encourages test churn
when the implementation is actually at fault.

Retry ownership should follow the failing artifact:

| Failure | Next owner |
|---|---|
| RED verification | Test writer |
| GREEN after implementation | Builder |
| CI after implementation | Builder |
| GREEN/CI while strengthening tests | Test writer |
| Mutation survivor | Test writer |
| Review implementation finding | Builder |
| Review coverage finding | Test writer |
| Ambiguous requirement | Human |

## Target Flow

```text
human-approved specification
            |
            v
Codex test writer --> verified RED
            |
            v
Claude builder ----> verified GREEN
            |
            v
CI / mutation / fuzz / security gates
            |
            v
deterministic review package
            |
            v
fresh Codex reviewer --> schema-validated findings
            |
            v
owner-routed correction or human decision
```

## Review Contract

The review package should be deterministic and size-bounded. It contains:

- approved specification and acceptance criteria;
- plan and declared file scope;
- base-to-head diff;
- changed tests;
- gate commands and results;
- mutation/security summaries;
- unresolved written disagreements.

Reviewer output should be JSON validated against a checked-in schema. Each finding
needs an ID, severity, confidence, category, evidence, location, related requirement,
and recommended owner. Low-confidence findings are retained in the artifact for
analysis but do not enter the automated correction loop.

## Delivery Risks

- Codex CLI output and usage telemetry differ from Claude CLI output. Keep each
  adapter isolated behind one executor contract.
- A model-based failure classifier would be gameable. Initial retry ownership must
  be deterministic and based on the phase that failed.
- Review packages can exceed context limits. Enforce explicit byte limits and fail
  closed with `context_sufficient: false` rather than silently truncating evidence.
- Codex test writing must not rely on prompt compliance. Sessions run read-only and
  return schema-constrained full-file proposals; the harness validates test-owned
  paths, containment, symlinks, duplicates, and size before applying them.
- The working tree already contains user-owned metrics changes. Implementation must
  not overwrite or normalize those files.
- The repository's full CI gate was red at the start of this change. Completion
  requires a fresh green gate or an explicit, evidenced blocker report.

## Success Measures

- Correct owner receives every gate failure in controller tests.
- Test-writer roles execute through Codex and builder roles through Claude.
- Review input is reproducible from repository state.
- Invalid reviewer JSON fails closed.
- Findings below the confidence threshold do not trigger edits.
- Seeded defects measure reviewer catch rate, false positives, iterations-to-green,
  and cost per accepted finding.
