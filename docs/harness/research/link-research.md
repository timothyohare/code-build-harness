# Prior-Art Research: Agentic Code Build Harness

Research notes for designing a harness that loops **Spec → Plan → Build → Test → Review →
Simplify → Ship** using coding agents (Claude Code building locally, GitHub Actions
checking/merging), with TDD enforcement, test-agent/build-agent separation, mutation
testing, security reviews, guardrails/hooks, per-loop metrics, and a path from
human-in-the-loop to out-of-the-loop.

Researched: 2026-07-04. Each section covers: (a) core thesis, (b) applicable patterns,
(c) tooling named, (d) notable quotes/rules, (e) open questions.

---

## 1. addyosmani/agent-skills (GitHub)

<https://github.com/addyosmani/agent-skills>

### (a) Core thesis

AI agents default to shortcuts — skipping specs, tests, and security reviews — that
undermine reliability. This repo encodes production-grade engineering workflows as 24
structured skill definitions so agents follow the same quality gates and verification
steps that separate production work from prototype work.

### (b) Applicable patterns

The repo's lifecycle loop maps almost one-to-one onto the harness's target loop:

| Phase | Command | Pattern | Key principle |
|---|---|---|---|
| DEFINE | `/spec` | Spec before code | PRD covering objectives, structure, boundaries |
| PLAN | `/plan` | Small atomic tasks | Verifiable units with acceptance criteria |
| BUILD | `/build` | Thin vertical slices | Test-driven, one slice at a time, feature flags |
| VERIFY | `/test` | Red-Green-Refactor | Tests are proof; test pyramid (80/15/5) |
| REVIEW | `/review` | Five-axis quality gate | ~100-line change sizing, severity labels |
| SIMPLIFY | `/code-simplify` | Clarity over cleverness | Chesterton's Fence; preserve exact behavior |
| SHIP | `/ship` | Faster is safer | Feature flags, staged rollouts, rollback procedures |

Enforcement patterns directly reusable in the harness:

- **Anti-rationalization tables** — each skill documents the excuses agents use to skip
  steps, with counter-arguments. A harness analogue: gates that anticipate and block
  known agent rationalizations.
- **Verification is non-negotiable** — every skill ends with evidence requirements
  (tests passing, build output, runtime data). Matches the harness's "every quality
  claim backed by a command that exits non-zero when false."
- **Autonomous mode** — `/build auto` runs the whole plan in one approved pass but keeps
  individual test-driven commits and pauses on failures: a concrete model for the
  human-in-loop → out-of-loop progression.
- **Change sizing discipline** — ~100-line threshold per change for review speed.
- **Commit-as-save-point** — atomic, trunk-based commits per verified slice.
- **Agents don't invoke agents** — multi-persona orchestration only via endorsed
  patterns in `orchestration-patterns.md`.
- **Progressive disclosure** — supplementary checklists (definition-of-done, testing
  patterns, security, performance, accessibility, observability, orchestration) load
  on demand rather than bloating context.

Skill inventory by phase: DEFINE (interview-me, idea-refine, spec-driven-development);
PLAN (planning-and-task-breakdown); BUILD (incremental-implementation,
test-driven-development, context-engineering, source-driven-development,
doubt-driven-development, frontend-ui-engineering, api-and-interface-design); VERIFY
(browser-testing-with-devtools, debugging-and-error-recovery); REVIEW
(code-review-and-quality, code-simplification, security-and-hardening,
performance-optimization); SHIP (git-workflow-and-versioning, ci-cd-and-automation,
deprecation-and-migration, documentation-and-adrs,
observability-and-instrumentation, shipping-and-launch); META (using-agent-skills).

### (c) Tooling named

Claude Code (plugin marketplace), Cursor (`.cursor/rules/`), Windsurf, Gemini CLI,
OpenCode, GitHub Copilot, Antigravity CLI, Kiro IDE; GitHub Actions, feature flags,
OpenTelemetry, structured logging (RED metrics).

### (d) Notable quotes / rules

- "Spec before code" / "Tests are proof" / "Faster is safer"
- "Beyoncé Rule: if you liked it, you should've put a test on it"
- "Code as liability" — deprecation mindset
- Hyrum's Law — every observable behavior becomes someone's contract
- Chesterton's Fence — don't remove code you don't fully understand
- "Stop-the-line rule" — localize failures immediately
- "Shift Left" — catch failures early in the pipeline

### (e) Open questions

- How do agents resolve conflicting guidance when composing multiple skills/personas?
- How do agents know when to load supplementary references without explicit prompting?
- Skill versioning/drift between cloned copies and plugin references.
- What happens when verification infrastructure (test runners, MCP, CI) is unavailable
  or slow?
- `/build auto` pauses on failure, but there's no explicit escalate-vs-recover policy —
  exactly the policy the harness needs to define.

---

## 2. Fission-AI/openspec (GitHub)

<https://github.com/Fission-AI/openspec>

### (a) Core thesis

Spec-Driven Development for AI assistants via a lightweight specification layer that
aligns human and AI *before* implementation. Specs are living artifacts guiding
iterative work, not gatekeeping documents. Philosophy: "fluid not rigid / iterative not
waterfall / easy not complex / built for brownfield not just greenfield." Without specs,
"vague prompts and unpredictable results"; OpenSpec brings "predictability without
ceremony."

### (b) Applicable patterns

- **Four workflow stages**: `/opsx:explore` (discovery without commitment) →
  `/opsx:propose` (structured artifact bundle) → `/opsx:apply` (execute enumerated
  tasks) → `/opsx:archive` (timestamp and finalize).
- **Change-proposal bundle** — each change gets `proposal.md` (rationale/scope),
  `specs/` (requirements + scenarios), `design.md` (technical approach), `tasks.md`
  (implementation checklist). This is a ready-made artifact schema for the harness's
  Spec and Plan phases.
- **Specs as deltas** — each change captures only what's new, enabling shared
  requirements and cross-repo features.
- **Change isolation** — one feature = one folder = one atomic tracked unit; archive
  folder keeps a dated history (`archive/YYYY-MM-DD-<feature>/`) — a natural place to
  attach per-loop metrics.
- **Fluid artifact editing** — any document can be updated at any time; no phase gates
  lock you in (contrast with the harness's hard gates — a deliberate design tension to
  resolve).
- **Store-based planning (beta)** — specs kept in separate repos shared via git;
  platform teams own specs that product teams reference read-only.
- **Context hygiene** — recommends clearing context before implementation.

### (c) Tooling named

`openspec init` / `openspec update` / `openspec config profile`; extended commands
(`/opsx:new`, `/opsx:continue`, `/opsx:ff`, `/opsx:verify`, `/opsx:bulk-archive`,
`/opsx:onboard`); 25+ integrations (npm/pnpm/yarn/bun/nix; Copilot, Claude, other
assistants). Recommends high-reasoning models. Repo stats at fetch time: ~58.6k stars,
v1.5.0 (June 2026).

### (d) Notable quotes

- "An AI coding assistant without specs means vague prompts and unpredictable results."
- "Capture the plan in the store now; the code repos catch up later."
- "The hard part moves: a feature spans the API server, the web app, and a shared
  library."

### (e) Open questions

- Cross-repo orchestration when specs live apart from code with divergent timelines.
- How much does "clear your context before implementation" cost vs. the gains from
  better specs?
- Preventing archived specs from becoming stale documentation once implementation
  diverges.
- Slash-command behavior drift across 25+ agent integrations.

---

## 3. Salesforce Engineering: "Maintaining Code Quality at Agent Speed — 7 Patterns for Agentic Engineering"

<https://engineering.salesforce.com/maintaining-code-quality-at-agent-speed-7-patterns-for-agentic-engineering/>

### (a) Core thesis

**Verification, not generation, is the bottleneck.** Agents produce code faster than
traditional processes can absorb; the winning teams are those that establish trust in
code fastest, not those that generate the most. Engineering value moves from authorship
to confidence-building mechanisms.

### (b) The 7 patterns (all directly applicable)

1. **Verification is harder than authorship** — agent code lacks the mental model built
   during manual authorship; treat verifiability as a first-class design constraint.
2. **Separate author from judge** — when one agent writes both code and tests, "tests
   inherit whatever the agent misunderstood about the problem." Use independent test
   authorship/review, mutation testing, and end-to-end evals that judge running
   systems. *This is the direct prior art for the harness's test-agent/build-agent
   separation.*
3. **Replace prompts with quality gates** — prompt instructions are advisory; CI/CD
   gates are enforcement. "A prompt can be ignored or fall out of context. A failed
   gate stops everything until the code satisfies the rule."
4. **Design around predictable failures** — document how your agent systematically
   fails, then build safeguards assuming recurrence. Agents optimize against literal
   rule text, not intent — use multiple layered gates.
5. **Grade tests via mutation testing** — deliberately break code to verify tests catch
   bugs; surfaces "decoration masquerading as coverage." *Direct prior art for the
   harness's mutation-testing gate.*
6. **Engineer the lifecycle, not just code** — review, testing, CI/CD, and deployment
   must all be resized for agent-speed throughput; "review feels the strain first."
7. **Scale confidence, not just code** — deliberately *retain* friction via gates,
   validation steps, and review checkpoints.

### (c) Tooling named

Agent Fabric (Salesforce's governed agentic-dev framework), mutation testing, CI/CD
quality gates, end-to-end testing. Patterns are deliberately tool-independent.

### (d) Notable quotes

- "Generation is no longer the constraint — verification is."
- "A prompt can be ignored... A failed gate stops everything."
- "A passing suite tells you tests ran green. Mutation tells you if they could catch
  anything."
- "When generation is cheap, the engineering value moves into everything that
  establishes confidence."

### (e) Open questions

- Operationalizing mutation testing at scale without CI bottlenecks.
- Which agent failure modes are universal vs. model-specific?
- How should review adapt structurally for agent-generated diffs?
- Can prompts + gates fully replace human architectural review?

---

## 4. Addy Osmani: "Loop Engineering"

<https://addyosmani.com/blog/loop-engineering/>

### (a) Core thesis

Replace manual agent prompting with designed, self-executing loops: agents operate on
schedules, check their own work via sub-agents, and maintain external state across
runs. The engineer's job shifts from prompting to loop design.

### (b) Applicable patterns

Five essential components of a loop system:

1. **Automations** — scheduled discovery/triage running independently; findings surface
   to a triage inbox (for the harness: scheduled gate runs, drift scans, dependency
   audits feeding an inbox rather than interrupting).
2. **Worktrees** — git-based isolation so parallel agents never collide on files.
3. **Skills** — reusable `SKILL.md` files codifying project conventions once.
4. **Plugins/connectors** — MCP integrations to issue trackers, databases, Slack;
   autonomous PR creation and ticket updates.
5. **Sub-agents** — *maker/checker separation*: a second agent with different
   instructions verifies the first agent's work.

Plus: **external state** (markdown or a Linear board tracking completed work across
runs — the harness's per-loop metrics ledger fits here) and the **`/goal` primitive**
(run until a verifiable stopping condition holds, with a separate model grading
completion — a template for out-of-the-loop operation).

### (c) Tooling named

Codex app (Automations tab, Skills, `.codex/agents/` subagents); Claude Code (`/loop`,
`/goal`, `.claude/agents/`, MCP servers, GitHub Actions integration); MCP.

### (d) Notable quotes

- "You shouldn't be prompting coding agents anymore. You should be designing loops that
  prompt your agents." — Peter Steinberger
- "I don't prompt Claude anymore. I have loops running that prompt Claude." — Boris
  Cherny
- "The loop changes the work, it does not delete you from it."

### (e) Open questions

- The **review bandwidth ceiling**: how many parallel agents can one engineer review?
- When does loop automation become dangerous unattended iteration?
- How to prevent *comprehension debt* and *cognitive surrender* as loops accelerate
  output?
- What are safe verification practices for autonomous systems?

---

## 5. Martin Fowler (Birgitta Böckeler): "Harness Engineering"

<https://martinfowler.com/articles/harness-engineering.html>

By Birgitta Böckeler, Distinguished Engineer at Thoughtworks (published April 2026,
superseding a February 2026 memo). References OpenAI's documented harness, Stripe's
"minions" agents, and Thoughtworks teams' drift-detection/janitor-agent experiments.

### (a) Core thesis

**Agent = Model + Harness**, where the harness is everything external to the model. A
control-systems framing: **feedforward guides** (anticipatory steering — docs, linters
as codified conventions, templates) plus **feedback sensors** (post-action correction —
tests, static analysis, AI review) regulate agent behavior across three dimensions:
maintainability, architecture fitness, and functional behavior.

### (b) Applicable patterns

- **Feedforward controls (guides)**: LSPs, architecture docs, bootstrapping scripts,
  custom linters and code mods (OpenRewrite), skills with coded instructions, harness
  templates bundling guides+sensors per service topology.
- **Feedback controls (sensors)**, split into two classes the harness should treat
  differently:
  - *Computational* — deterministic, milliseconds: linters (ESLint, Semgrep),
    structural/architecture tests (ArchUnit), type checkers, static analysis.
  - *Inferential* — semantic, slower, GPU-bound: AI code-review agents, LLM-as-judge.
- **Shift left distribution**: cheap/fast checks pre-commit; slower checks
  post-integration. Self-correcting loops run *before* human review so humans see only
  what machines can't resolve.
- **Pre-commit hooks running architecture constraint checks**; continuous drift
  detection (dead code, coverage quality, dependency scanning); runtime monitoring
  (SLO degradation, response-quality sampling).
- **Approved fixtures pattern** for test quality; **mutation testing to detect
  inadequate sensors** (grading the sensor suite itself, not just tests).
- **Failure-mode-to-sensor-coverage mapping** — enumerate known failure modes and check
  each has a sensor; a concrete audit method for harness completeness.
- **"Harnessability"** — some languages/frameworks afford better harnessing; a factor
  in stack choice.

### (c) Tooling named

Language servers (LSP), OpenRewrite, ArchUnit, ESLint, Semgrep, Dependabot,
dep-cruiser, mutation-testing frameworks, MCP servers, custom linters.

### (d) Notable quotes

- "A good harness should not necessarily aim to fully eliminate human input, but to
  direct it to where our input is most important."
- "The agent has none of this: no social accountability, no aesthetic disgust at a
  300-line function, no intuition that 'we don't do it that way here.'"
- "Feedback sensors, including the new inferential ones, need to be distributed across
  the lifecycle accordingly."

### (e) Open questions

- How to build adequate *behavioral* harnesses beyond test-suite validation?
- Coherence across a growing guide/sensor ecosystem without contradictions.
- When sensors never fire, is that quality or inadequate detection?
- How to evaluate harness coverage and quality systematically?
- What tooling helps reason about feedforward/feedback controls as integrated systems?

---

## 6. Addy Osmani: "Agent Harness Engineering"

<https://addyosmani.com/blog/agent-harness-engineering/>

### (a) Core thesis

Agent capability emerges from the system architecture around the model, not from model
choice: "Agent = Model + Harness. If you're not the model, you're the harness." A
well-designed harness on a decent model beats a state-of-the-art model in weak
infrastructure. Engineering the scaffolding — prompts, tools, execution environments,
feedback loops, constraints — is the highest-leverage work.

### (b) Applicable patterns

- **Behavior-driven derivation** — every harness component must map to a specific
  behavior the model can't deliver alone (a design test for each proposed gate/hook).
- **The ratchet principle** — every agent failure becomes a permanent rule; constraints
  accumulate from observed failure history. Every line of `AGENTS.md` (kept under ~60
  lines) traces to a specific past failure.
- **Hooks at lifecycle points** — pre-tool-call, post-edit, pre-commit — that are
  "silent on success, verbose on failure." Pre-commit checks block destructive
  commands (`rm -rf`, `git push --force`).
- **Planner/generator/evaluator splits** — separating evaluation into distinct agents
  prevents self-grading bias (converges with Salesforce pattern 2 and Loop
  Engineering's maker/checker).
- **Sprint contracts** — negotiate done-conditions *before* execution to catch scope
  drift (a Plan-phase gate for the harness).
- **Ralph Loops** — hooks intercept exit attempts and reinject prompts into fresh
  context windows for long-horizon work.
- **Context management** — filesystem as the durable-state primitive; compaction;
  tool-output offloading; progressive skill disclosure.
- **Human-in-the-loop progression** — permission gates before destructive actions or PR
  submission; approval flows before production branches; independent evaluator agents
  instead of self-verification.
- **"Skill issue" reframing** — attribute failures to configuration gaps, not model
  limits; iterate the harness (you can't iterate without a v0.1).

### (c) Tooling named

Claude Agent SDK, Codex SDK, OpenAI Agents SDK; Claude Code, Cursor, Codex, Aider,
Cline; MCP servers (incl. Context7); sandboxed execution with allow-listing; headless
browsers; git and test CLIs.

### (d) Notable quotes

- "A decent model with a great harness beats a great model with a bad harness."
- "Success is silent, failures are verbose."
- "Every line in a good `AGENTS.md` should be traceable back to a specific thing that
  went wrong."
- "Models get worse at reasoning as context windows fill up."
- "Every component in a harness encodes an assumption about what the model can't do on
  its own."

### (e) Open questions

- Multi-agent coordination on shared codebases in parallel.
- Self-improving harnesses: can agents mine their own traces to fix harness-level
  failure modes?
- Just-in-time tool/context assembly vs. static configuration.
- Can harnesses evolve toward compiler-like self-optimization?

---

## 7. Addy Osmani: "How to Write a Good Spec" (good-spec)

<https://addyosmani.com/blog/good-spec/>

### (a) Core thesis

Good agent specs balance clarity with brevity — bigger specs are not better; context
bloat breaks models. Treat specs as living, executable artifacts in version control and
CI, structured around agent failure modes.

### (b) Applicable patterns

- **Six core spec areas**: Commands (full executable commands with flags), Testing
  (framework, locations, coverage expectations), Project structure (explicit directory
  purposes), Code style (real code examples over prose), Git workflow (branch/commit/PR
  conventions), Boundaries (hard constraints and decision gates).
- **Three-tier boundary system** — directly reusable as the harness's autonomy policy:
  - ✅ *Always do* (proceed without approval): "Always run tests before commits"
  - ⚠️ *Ask first* (human gate): "Ask before modifying schemas"
  - 🚫 *Never do* (categorical): "Never commit secrets"
- **Organizing large specs**: hierarchical summaries/extended TOC; modular sub-specs
  fed context-selectively; specialized subagent personas holding relevant spec slices.
- **Four-phase gated workflow** (GitHub Spec Kit): Specify → Plan → Tasks → Implement.
- **Verification mechanisms**: self-checks against spec, conformance test suites
  derived from spec, LLM-as-judge secondary review, continuous testing loops feeding
  failures back into refinement.
- **Anti-patterns**: vague prompts without measurable outcomes; unstructured context
  dumps; skipping human review of critical paths; conflating vibe coding with
  production engineering; omitting the six core areas.

### (c) Tooling named

Claude Code Plan Mode, GitHub Spec Kit, agents.md, MCP, LangGraph, OpenAI Swarm,
Chroma, llms.txt, OpenAPI schemas, RAG, Context7.

### (d) Notable quotes

- "Vague prompts mean wrong results." — Baptiste Studer
- "Specs become the shared source of truth… living, executable artifacts that evolve
  with the project." — GitHub AI team
- "Planning in advance matters even more with an agent — you can iterate on the plan
  first, then hand it off to the agent."
- "I won't commit code I couldn't explain to someone else." — Simon Willison
- Running parallel agents is "surprisingly effective, if mentally exhausting." —
  Willison
- Research shows even frontier models struggle when asked to satisfy many requirements
  simultaneously (the "curse of instructions").

### (e) Open questions

- Optimal spec granularity per task complexity — where's the inflection point?
- Shared-state conflict resolution across 3+ parallel subagents.
- When does verification overhead exceed value for low-stakes features?
- Preventing spec-vs-implementation drift; no concrete versioning strategy given.
- Should specs be model-specific given differing attention/instruction-following?
- What gates prevent premature advancement between Specify → Plan → Tasks → Implement?

---

## 8. multica-ai/andrej-karpathy-skills (GitHub)

<https://github.com/multica-ai/andrej-karpathy-skills>

### (a) Core thesis

Distills Karpathy's observations of LLM coding failure modes into four actionable
principles. The problem set: models make unexamined assumptions, overcomplicate
solutions, make orthogonal edits, and lack verifiable success criteria.

### (b) Applicable patterns — the four skills

| Skill | Function | Harness relevance |
|---|---|---|
| Think Before Coding | Surface assumptions/ambiguities; ask rather than proceed | Spec/Plan gate: assumptions must be explicit |
| Simplicity First | Minimum viable scope; no speculative abstraction | Simplify phase criterion |
| Surgical Changes | Restrict edits to requested scope; preserve unrelated code/style | Diff-scope guardrail (lintable: flag out-of-scope hunks) |
| Goal-Driven Execution | Convert imperative asks into declarative, measurable success criteria + test loops | Core TDD-enforcement framing |

The Goal-Driven Execution skill is the theoretical basis for gate-driven loops: give
the agent a verifiable success condition and let it iterate, rather than instructions.

### (c) Tooling named

Claude Code plugin marketplace (`/plugin marketplace add ...`), Cursor project rules
(`.cursor/rules/karpathy-guidelines.mdc`), curl-installable `CLAUDE.md`.

### (d) Notable quotes

- "LLMs are exceptionally good at looping until they meet specific goals... Don't tell
  it what to do, give it success criteria and watch it go."
- "The models make wrong assumptions on your behalf and just run with them without
  checking."
- Simplicity test: "Would a senior engineer say this is overcomplicated? If yes,
  rewrite it."

### (e) Open questions

- How do agents distinguish "drive-by improvements" from legitimately necessary
  refactoring in adjacent code?
- What is sufficient verification for complex multi-step tasks vs. one-liners?
- Do these principles scale across teams with differing style preferences?

---

## 9. Kaggle whitepaper: "The New SDLC With Vibe Coding"

<https://www.kaggle.com/whitepaper-the-new-SDLC-with-vibe-coding>

The page itself exposes only the title; full content is the locally available PDF
(~50 pages). Per secondary coverage: authored by **Addy Osmani, Shubham Saboo, and
Sokratis Kartakis** (Google), released as part of Kaggle's 5-day AI Agents course. It
places development on a spectrum from **vibe coding** (natural-language prompting,
paste-the-error iteration — fast, good for prototypes) to **agentic engineering**
(specs, guardrails, evals, review). Key slogan: **"Structure scales, vibes don't"** —
past a crossover point, vibe coding costs 3–10x more per feature. It is the
long-form treatment of the same DEFINE→PLAN→BUILD→VERIFY→REVIEW→SHIP framing as
sources 1, 4, 6, and 7. Read the local PDF for the full loop-metrics and
tooling detail.

---

## Cross-cutting patterns

Themes appearing independently across three or more sources:

1. **Gates over prompts.** Prompt instructions are advisory; executable gates that exit
   non-zero are enforcement (Salesforce #3, Böckeler's sensors, Osmani's hooks,
   agent-skills' evidence requirements). This validates the existing
   gate-ci/gate-verify/gate-perf design and argues for extending it, not replacing it.
2. **Verification is the bottleneck, so separate author from judge.** Salesforce's
   pattern 2, Loop Engineering's maker/checker sub-agents, Osmani's
   planner/generator/evaluator split, agent-skills' doubt-driven-development. Tests
   written by the building agent "inherit whatever the agent misunderstood" — the
   test-agent/build-agent separation is well-supported prior art, not speculation.
3. **Mutation testing grades the graders.** Named explicitly by both Salesforce
   (pattern 5) and Böckeler (detecting inadequate sensors). Coverage is decoration
   until mutation testing proves tests can catch anything.
4. **Agent = Model + Harness; feedforward + feedback.** Böckeler and Osmani converge on
   the same equation. Distinguish *computational* sensors (deterministic, fast, run
   pre-commit) from *inferential* sensors (LLM-judge, slower, run post-integration)
   and distribute them shift-left across the lifecycle.
5. **The ratchet: failures become permanent rules.** Osmani's `AGENTS.md` traceability,
   Salesforce's "design around predictable failures," agent-skills'
   anti-rationalization tables, Böckeler's failure-mode-to-sensor mapping. The harness
   should have a formal loop-retro step that converts each observed failure into a new
   gate, hook, or rule.
6. **Spec first, as a structured living artifact.** OpenSpec's proposal bundle
   (proposal/specs/design/tasks), good-spec's six areas and three-tier boundaries,
   Spec Kit's four gated phases, agent-skills' `/spec`. Consensus artifact set:
   rationale + requirements/scenarios + design + task checklist, kept in-repo,
   archived per change.
7. **Small verified increments.** ~100-line change sizing, thin vertical slices,
   commit-as-save-point, surgical changes (Karpathy skills). Small diffs are what keep
   the review stage — the first to strain at agent speed — viable.
8. **Graduated autonomy, not a switch.** Three-tier boundaries (always/ask/never),
   permission gates before destructive actions, `/build auto` pausing on failure,
   `/goal` with verifiable stopping conditions and a separate grading model. The path
   from human-in-the-loop to out-of-the-loop is: move items from "ask first" to
   "always do" only as their gate coverage matures, and "direct human input to where
   it is most important" (Böckeler) rather than eliminating it.
9. **External state and isolation for loops.** Worktrees for parallel-agent isolation;
   filesystem/markdown/board as durable cross-run state; archive folders per change —
   the natural substrate for per-loop metrics.
10. **Goal-driven execution.** "Give it success criteria and watch it go" (Karpathy)
    is the unifying theory: every phase of the harness loop should terminate on a
    machine-checkable condition, not on the agent's self-report.

## Questions raised (consolidated backlog for harness design)

1. **Escalation policy**: when a gate fails repeatedly, when does the loop escalate to
   a human vs. retry vs. abandon? No source specifies this; the harness must.
2. **Review bandwidth ceiling**: how many parallel loops can one human meaningfully
   review, and what metrics detect when the ceiling is exceeded?
3. **Comprehension debt / cognitive surrender**: how does the harness keep the human
   able to explain the code ("I won't commit code I couldn't explain") as loop volume
   grows?
4. **Mutation testing cost**: how to run it without becoming the CI bottleneck —
   incremental/mutant-sampling strategies? On which loop iterations does it run?
5. **Sensor adequacy**: when gates never fire, is the code good or the sensors blind?
   Needs periodic seeded-fault drills (inject a known bug; confirm gates catch it).
6. **Behavioral verification beyond tests**: gate-verify boots and checks the app, but
   how to harness "does the feature actually behave as the spec intended" beyond
   test-suite validation?
7. **Guide/sensor coherence**: as rules, skills, hooks, and gates accumulate via the
   ratchet, what prevents contradiction and bloat? (Osmani's answer: cap at ~60 lines
   and trace every rule to a failure; needs an equivalent pruning discipline for
   gates.)
8. **Spec/implementation drift**: what mechanism keeps archived specs true after later
   changes — spec deltas re-validated per loop, or conformance tests derived from spec?
9. **Verification ROI**: when does verification overhead (mutation, LLM-judge, security
   review) exceed value for low-stakes changes? Should gate depth scale with change
   risk classification?
10. **Model-specificity**: are failure-mode rules and specs portable across models, or
    does the ratchet need per-model rule sets?
11. **Cross-repo features**: OpenSpec's store model raises how one loop spans multiple
    repos (spec repo + N code repos) with divergent timelines.
12. **Self-improving harness**: can the loop mine its own transcripts/metrics to
    propose new gates and rules automatically (Osmani's open question) — and who
    approves those?
