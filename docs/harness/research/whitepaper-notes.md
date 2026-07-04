# Notes: "The New SDLC With Vibe Coding" (Google, May 2026 — Day 1 paper)

Source: `docs/Day_1_v3.pdf` (Osmani, Saboo, Kartakis). 51 pages. These notes extract what matters for the harness design.

## Core frames

1. **The spectrum, not a binary.** Vibe coding ↔ structured AI-assisted ↔ agentic engineering. The differentiator is *how outputs get verified*, not whether AI is used. "Without both [tests and evals], the practice is always vibe coding, regardless of how sophisticated the prompts are." (p14–15)
2. **Agent = Model + Harness.** The model is ~10% of observed behavior; the harness (~90%) is instructions/rule files, tools, sandboxes, orchestration logic, guardrails/hooks, observability. "Most agent failures, examined honestly, are configuration failures." (p26–31)
   - Evidence cited: a team moved a coding agent from outside Top 30 to Top 5 on Terminal Bench 2.0 by changing only the harness; LangChain gained 13.7 points by tweaking prompt/tools/middleware around a fixed model.
3. **The factory model.** The developer's primary output is not code — it is the system that produces code: specs + agents + tests/gates + feedback loops + guardrails. "Success comes from giving agents success criteria rather than step-by-step instructions, then letting them iterate." (p24–25)
4. **Conductor vs orchestrator.** Two working modes; developers move fluidly between them. Conductor = synchronous, in-IDE, keystroke-level. Orchestrator = async delegation, goal-level control, reviewing outcomes not keystrokes. The harness we're building is an *orchestrator-mode* machine, with conductor mode as the escape hatch. (p31–34)
5. **The 80% problem.** Agents produce ~80% fast; the remaining 20% (edge cases, integration, subtle correctness) needs deep context. AI errors evolved from syntax errors to *conceptual* failures that "look right" and pass basic tests — this is exactly what the verification stack must target. (p34)
6. **Output evals AND trajectory evals.** Verify what was built *and how it got there* — "a fluent output that skipped its verification steps is a more dangerous failure than one with a visible error." (p22) → Harness implication: keep an audit trail of the agent's steps and gate on it.
7. **Economics: CapEx vs OpEx.** Vibe coding = low CapEx, compounding OpEx (token burn, maintenance tax, security remediation). Agentic engineering = high upfront CapEx (schemas, deterministic tests, context), low marginal cost. Context engineering is a financial lever; **intelligent model routing** (frontier models for spec/architecture/build; cheaper models for test gen, review, CI monitoring) drives down cost at constant quality. (p39–42)
8. **Context engineering.** Six context types (instructions, knowledge, memory, examples, tools, guardrails); static vs dynamic context boundary is a first-class, versioned architectural decision. Agent Skills = progressive disclosure to keep static context small. (p15–18)

## "Where to start" checklist (p43–46) — mapped to our harness

| Paper recommendation | Harness mapping |
|---|---|
| AGENTS.md/CLAUDE.md: start ~10 lines, add a rule per observed failure | Ratchet principle; rules-as-changelog |
| Write tests and evals *before* generating code | TDD + spec-ready bar (idea already in ideas.md) |
| Review every line that ships | Human review stage; graduates to sampling as trust builds |
| Eval, not demo, is the bar; explicit rubrics | Spec-ready / test-ready judged gates |
| Treat AGENTS.md, prompts, eval suites, skills as code (PR-reviewed, versioned, owned) | Harness repo is itself under the harness |
| Distinguish prototyping from production in team norms | Two-track: vibe track for spikes, harness track for production |
| Invest in harness components as shared team asset | This project |
| Trajectory + final-response evals in CI, traces of every run, scoped permissions per agent | Observability/audit trail requirement |
| MCP + A2A open standards | Keep vendor-mixing possible (Claude builds, Copilot reviews, Gemini judges) |

## Durable principles (conclusion, p47–48)

1. **Structure scales, vibes don't.**
2. **AI amplifies your engineering culture** (multiplies weaknesses too).
3. **The human role shifts from implementation to judgment** — "Generation is solved. Verification, judgment, and direction are the new craft."

## Useful citations for further reading (endnotes)

- METR uplift study (experienced devs 19% *slower* on some AI tasks — verification cost) — metr.org/blog/2026-02-24-uplift-update/
- Osmani: factory-model, future-agentic-coding, the-80-percent-problem, ai-coding-workflow
- Lawfare: security risks of AI-generated code; DevOps.com: slopsquatting threat
- Google: Introduction to Agents (Nov 2025), ADK, A2A protocol, Jules
- CircleCI: AI-Native SDLC
