# Web research: agentic code build harness design options

Researched 2026-07-04. Focus: quality-first Spec → Plan → Build → Test → Review → Simplify → Ship loop,
agents building locally, GitHub Actions verifying/merging. Priorities: quality > speed > cost.

---

## 1. Multi-LLM cross-review patterns

### Findings

**The pattern works, for a specific reason.** Cross-model review (generate with model A, review
with model B) consistently outperforms same-model self-review in recent controlled studies. The
mechanism is *complementary blind spots*: different training distributions give epistemic
diversity, so reviewer errors are less correlated with builder errors. Same-session self-review is
the weakest configuration — a model reviewing its own output tends to approve it, nitpick
formatting, and rarely catch substantive errors ("same-session anchoring").

**But multi-agent ensembles are not automatically better.** A 2026 controlled experiment on
multi-agent collaboration topologies found heterogeneous LLM teams consistently failed to match
their *best individual member*, with performance losses up to 37.6%. The failure mechanism is
consensus-seeking over expertise. Related work ("More Rounds, More Noise") found multi-turn review
rounds fail to improve cross-context verification — more review rounds add noise, not signal.
Implication: **one strong independent reviewer beats a committee**, and a fresh-context review
session beats a continued conversation.

**LLM-as-judge for code review has well-characterized failure modes** (per "Bias in the Loop:
Auditing LLM-as-a-Judge for Software Engineering," Apr 2026, and the bias-mitigation literature):

- **Position bias** — verdicts shift with option/rubric ordering. Mitigation: randomize or
  permute ordering per evaluation (simple randomization matches exact balancing under matched
  budgets, per the 2026 position-bias paper); Autorubric-style explicit numeric anchors decouple
  score from position.
- **Verbosity bias** — longer answers score higher regardless of quality.
- **Sycophancy / authority bias** — the judge agrees with the generator's framing or confident
  assertions in the PR description.
- **Self-preference** — a model rates its own family's output higher; never let the builder's
  model family judge itself.
- **Calibration drift and poor test-retest reliability** — the same judge on the same diff can
  disagree with itself; run-to-run reliability should be measured, not assumed.
- **Homogenisation trap** — LLM-generated verifiers/tests exhibit tightly clustered error
  patterns (shared systematic biases), so stacking more LLM checks catches "LLM-like" failures
  while missing others. Deterministic gates (tests, mutation testing, static analysis) are the
  decorrelated backstop.

**Practical implementations.** `formin/multi-model-review` (a Spec Kit extension) is the closest
existing artifact to the proposed harness: spec authored by one model, implementation by another,
then a *compact review package* (spec + plan + tasks + diff briefs as portable markdown) is handed
to a third model in a separate session. Notable design choices worth stealing:
confidence-gated findings (hide findings below confidence 70), a "context sufficiency" escape
hatch (reviewer flags when the compact package lacks detail → rerun with full package), no hidden
external calls, markdown-only interchange. The spec itself acts as the ground truth the reviewer
checks against ("The Specification as Quality Gate," 2026) — review against the spec, not against
vibes.

**Copilot code review + Gemini Code Assist as the second/third reviewers:** Copilot code review
is GitHub-native (request Copilot as a PR reviewer; tight integration, polished suggestions) but
uses smaller context; Gemini Code Assist for GitHub is stronger on multi-file/cross-repo ripple
effects thanks to its large context window and posts review comments on PRs. Both are viable as a
*cheap decorrelated second opinion*; neither replaces the primary structured review. Security
audits find both assistants' generated code has ~40% vulnerability rates, so review layers must
include deterministic security scanning regardless.

### What practitioners recommend

- Builder and reviewer must be **different model families**, in **separate fresh sessions**, with
  the **spec as the review contract**.
- One strong reviewer + one cheap judge/tiebreaker; avoid N-model debate topologies.
- The judge should score the *review* against a rubric with randomized ordering and numeric
  anchors, not re-review the code (cheaper, and it measurably reduces position bias).
- Keep deterministic gates (tests, mutation, SAST) as the uncorrelated layer; LLM reviews are
  additive, not a substitute.

### Options table

| Option | Decorrelation | Cost | Integration effort | Notes |
|---|---|---|---|---|
| Claude builds → GPT/Codex-family reviews → cheap model judges | High | Medium | Medium (custom scripts) | Strongest quality; formin/multi-model-review is prior art |
| Claude builds → Copilot code review on PR | Medium | Low (bundled) | Trivial (GitHub-native) | Good baseline; weaker on cross-file reasoning |
| Claude builds → Gemini Code Assist on PR | Medium-high | Low | Low (GitHub app) | Best multi-file ripple detection of the bundled options |
| Same model, fresh-context review session | Low-medium | Low | Trivial | Better than same-session; worse than cross-family |
| Multi-model council/debate | Medium | High | High | Evidence says it underperforms best individual member |

### Open questions

- How to measure reviewer efficacy over time (seeded-bug injection? track escaped defects per reviewer)?
- Where to set the judge's "review quality" threshold before requiring human escalation?
- Does the judge add enough signal over "reviewer + deterministic gates" to justify a third model call per PR?
- How to keep the review package compact without triggering context-insufficiency reruns too often?

---

## 2. Mutation testing in CI for agent-written code

### Findings

**Why it matters specifically for agent code:** AI-generated tests create false confidence — high
line coverage with weak assertions. Named failure patterns: tests mirroring implementation,
happy-path-only suites, boundary blindness (LLMs miss boundary-killing assertions), training-data
anchoring (asserting what the model "knows" rather than actual behavior), assertion roulette.
Mutation score is the only automated gate that detects "green but meaningless" tests — arguably
**the single highest-risk gap in an agent pipeline without it**.

**Cost is real but manageable with incremental modes.** Full runs are expensive (PIT on a 47 KLOC
project: 256K mutants, ~109 minutes). The universal mitigation pattern: diff-scoped analysis on
PRs, full runs nightly/weekly.

- **StrykerJS (JS/TS):** `--incremental` (since v6.2) reuses prior results — a documented case
  reused 3,731 of 3,965 results, executing only 234 new mutants. `thresholds: {high, low, break}`;
  exits 1 below `break`.
- **PIT (Java):** Git integration mutates only changed lines by default; history files
  (`--historyInputLocation/OutputLocation`) for incremental runs; `<mutationThreshold>` gate in Maven.
- **mutmut (Python):** remembers prior runs automatically; `--CI` flag for pipeline use. cosmic-ray
  is the more configurable/distributed alternative but heavier to operate; mutmut is the common
  default.
- All support parallelism (Stryker `concurrency`, PIT `--threads`).

**Gating practice:** no universal score. ≥80% is generally considered strong, 60–80% acceptable;
but practitioners warn a single global limit misleads — what matters is *which* mutants survive.
Recommended tiering: hard `break` threshold on changed code, plus **mandatory survivor review on
critical paths** (auth, payments, validation). The killer pattern for agents: **feed surviving
mutants back into the test-writer's prompt** — MuTAP research showed removing this loop caused a
~50% drop in fault detection. Keep mutation feedback attached to the PR ("if analysis runs
overnight, results are largely forgotten" — PIT's author).

### Options table

| Tool | Stack | Incremental | Gate mechanism | CI cost (diff-scoped) |
|---|---|---|---|---|
| StrykerJS | JS/TS | `--incremental` | `thresholds.break` → exit 1 | Minutes on PRs |
| Stryker.NET | .NET | `--since` (diff) | thresholds | Minutes |
| PIT | Java/JVM | Git-scoped + history files | `mutationThreshold` | Minutes on changed lines |
| mutmut | Python | automatic caching | `--CI`, exit codes | Minutes |
| cosmic-ray | Python | session DB, distributable | custom | Heavier setup |

### Open questions

- Baseline management: where do incremental history files live (cache vs committed) and how are they invalidated?
- Equivalent mutants: who adjudicates — agent proposes "equivalent" label, human or judge confirms?
- Should the mutation gate run pre-merge (blocking, diff-scoped) or post-merge (full, informational) — or both?
- Per-module thresholds (critical paths higher) vs one global break value?

---

## 3. Enforcing TDD with agents / preventing test tampering

### Findings

**Claude Code hooks are the primary local enforcement mechanism.** `PreToolUse` is the only hook
that can *block* an action; it intercepts Write/Edit/MultiEdit before execution and can deny, allow,
or inject context. The crucial property vs. CLAUDE.md instructions: hooks are **guaranteed to
execute** — "the distinction between 'probably' and 'always' is everything." Known limits: hooks
can't modify tool inputs (only allow/block/inject-context); they see individual tool calls, not
conversation intent; slow validation logic taxes every tool call; `additionalContext` injection
needs Claude Code ≥ v2.1.9 (Jan 2026).

**TDD Guard (`nizos/tdd-guard`)** is the mature implementation: runs as a separate process,
intercepts file modifications, and blocks three violations — implementation without a failing
test, over-implementation beyond what the current test requires, and adding multiple tests at
once. It captures actual test-runner results via language-specific reporters (so it knows
red/green state, not just file names), integrates lint (agents otherwise skip the refactor phase
of red-green-refactor or make only superficial changes), and lets you choose a faster or stronger
model for validation. Available as a Claude Code plugin.

**Layered defense model practitioners converge on:**

1. **Local, soft:** CLAUDE.md rules + TDD skill (cheap, bypassable).
2. **Local, hard:** PreToolUse hook denying builder edits to `tests/**` (path-based deny is simple
   and fast; TDD Guard for full red-green-refactor semantics).
3. **Agent separation:** a separate test-writer agent owns `tests/**`; the builder agent's hook
   config denies test paths. Separate contexts also reduce "tests mirroring implementation."
4. **Remote, hard:** CI recomputes everything — a job fails if the PR diff touches `tests/**` when
   the task type forbids it (or requires the test-change to come from the test-writer's commits);
   CODEOWNERS assigns `tests/**` to a human/team so test changes require an approval; branch
   protection makes that review required.
5. **Repo-level:** push rulesets can outright block pushes touching protected paths (see topic 4).

Local hooks are UX guardrails; only CI/rulesets are tamper-proof (an agent with shell access can
edit its own hook config — so settings files themselves need protection, and the server-side check
is the real gate).

### Options table

| Mechanism | Enforcement point | Bypassable by agent? | Granularity |
|---|---|---|---|
| CLAUDE.md / skill instructions | Prompt | Yes (probabilistic) | Any |
| PreToolUse path-deny hook | Local tool call | Only via shell workarounds / config edit | File path |
| TDD Guard | Local tool call + test-runner state | Same as hooks | Red-green-refactor semantics |
| Separate test-writer agent | Process/role | No (different context) | Role |
| CI diff check on `tests/**` | Server | No | File path per PR |
| CODEOWNERS + required review | Server | No | Path → human approval |
| Push ruleset (restrict file path) | Server | No | Path, absolute block |

### Open questions

- How to let the builder legitimately *run* tests and read failures while denying edits (hooks match on tool+path, so this is workable, but Bash `sed`-style edits need a Bash-command matcher too).
- Fixture/helper files: test-infrastructure code the builder legitimately shares — where's the boundary?
- Who fixes a genuinely wrong test? Escalation path from builder → test-writer agent without collusion.
- Protecting `.claude/settings.json` and hook scripts themselves from the agent (hook-on-hook, plus CI check).

---

## 4. Agentic CI on GitHub Actions

### Findings

**GitHub's own direction: Agentic Workflows** (public preview June 2026, from GitHub Next).
Markdown-defined workflows executed by agents inside Actions, with a security architecture that
biases to explicit constraint: least-privilege tokens, allow-listed tools, sandboxed execution,
content sanitization on outputs (secret scanning of agent output text, URL stripping), and
human-visible artifacts for every action. Worth tracking as a platform play, but a custom harness
retains more control today.

**Established patterns for agent-authored PRs:**

- **Required status checks run regardless of author** — the deterministic gate layer (CI, tests,
  mutation, SAST) applies identically to human and agent PRs.
- **CODEOWNERS + branch rulesets mandate independent human review** for agent-generated PRs;
  rulesets (the newer system, replacing classic branch protection) are where required checks,
  required reviews, and merge queue all live.
- **Merge queue** serializes merges and re-runs required checks against the merged state —
  valuable when multiple agents land PRs concurrently (prevents semantic conflicts between two
  individually-green PRs). Configured via rulesets; flaky required checks are the operational
  pain point.
- **Push rulesets (GA since 2024) restrict file paths**: e.g. block any push touching
  `.github/workflows/**` except by a bypass list. This is the strongest protection for workflows,
  hook configs, CODEOWNERS, and harness config — the agent physically cannot push changes to
  protected paths, even on feature branches. Available on Team plan for private/internal repos and
  applies to forks.
- **Secrets:** agent-facing jobs get least-privilege `GITHUB_TOKEN` (default read-only);
  `pull_request` from forks doesn't see secrets; environments with required reviewers gate
  deploy-time secrets. Agent config files (CLAUDE.md, agent instructions) should themselves be
  ruleset-protected since they steer future agent behavior.
- **Copilot code review**: request Copilot as a PR reviewer (or auto-assign via ruleset);
  GitHub-native, low friction. **Gemini Code Assist for GitHub**: app-based PR review, stronger
  cross-file analysis. Both slot in as bundled second-opinion reviewers (see topic 1).

### Options table

| Concern | Mechanism | Strength |
|---|---|---|
| Quality gate on agent PRs | Required status checks (rulesets) | Hard |
| Concurrent agent merges | Merge queue | Hard |
| Workflow/secret/config tamper | Push ruleset restrict-file-path + bypass list | Hardest (blocks push itself) |
| Test/critical-path review | CODEOWNERS + required review | Hard, needs human |
| Bundled AI review | Copilot code review / Gemini Code Assist | Soft signal |
| Platform-native agent CI | GitHub Agentic Workflows (preview) | Emerging |

### Open questions

- Merge queue + expensive checks (mutation, DAST): which checks run per-PR vs only in the queue vs post-merge?
- Human review requirement: keep for all agent PRs, or graduate low-risk changes to auto-merge once metrics (topic 6) justify it?
- Bot identity: PRs authored via a GitHub App vs the user's PAT — affects CODEOWNERS, required-review semantics, and audit.
- Adopt GitHub Agentic Workflows or keep the harness runner-agnostic?

---

## 5. Automated security review + pentest in pipeline

### Findings

**Consensus architecture: defense in depth, layered by speed.**

- **SAST:** Semgrep (seconds-fast, rule-based, easy custom rules, great PR-diff fit) and CodeQL
  (deeper semantic/dataflow analysis, free for public repos, GitHub-native, slower) are
  complementary — the common pattern is Semgrep on every PR, CodeQL on push/nightly. SonarQube
  adds maintainability/quality metrics but is heavier to operate and weaker as a pure security
  scanner. AI-augmented SAST (ZeroPath etc.) claims better business-logic detection; treat as
  optional.
- **Secrets:** Gitleaks (regex+entropy, fast, no network — fits pre-commit and PR) vs TruffleHog
  (verification-first: live API calls confirm whether a credential is *active* — higher signal,
  needs network). Practical: Gitleaks in the fast gate, TruffleHog scheduled. GitHub secret
  scanning + push protection as the platform backstop.
- **Dependencies:** Trivy (single binary; scans filesystems, repos, images, K8s configs; fast and
  stateless — the CI default), plus ecosystem-native audits (npm audit / pip-audit) and Dependabot.
  OWASP Dependency-Check is the older, slower alternative.
- **DAST/API fuzzing:** ZAP baseline (passive) scan on PRs is cheap (2–5 min); full ZAP active
  scans nightly against staging. Nuclei complements ZAP with 11k+ templates for known
  CVEs/misconfigs (1–5 min). For APIs with an OpenAPI schema: **Schemathesis**
  (property-based, easy CI, great fit for schema-first services) and **RESTler** (stateful
  sequence fuzzing, finds deeper bugs, heavier setup). Burp Suite Enterprise is the commercial
  option (300+ vuln types) — expensive; ZAP+Nuclei is the accepted free equivalent. StackHawk is
  the notable AI-driven commercial entrant (spec-aware, business-logic-aware scans).
- **nmap in CI:** realistic only as a narrow regression check against your own staging environment
  (assert expected-open-ports set; fail on drift). It is not a pentest; treat it as an
  infrastructure fitness function. Never point it at shared infrastructure from CI runners.

**What still needs humans:** business-logic flaws, authorization design (IDOR chains), multi-step
exploit chains, threat modeling, and triage of anything AI-generated code does *by design* but
shouldn't. Automated tools focus on known-pattern issues; false positives/negatives mean
overlapping tools + human triage. Given ~40% vulnerability rates in AI-assistant-generated code,
the SAST layer is non-negotiable for an agent harness, and periodic human pentest remains the
recommendation for anything internet-facing.

### Options table

| Layer | On PR (fast) | Nightly/staging (deep) | Human |
|---|---|---|---|
| SAST | Semgrep (diff) | CodeQL full | Triage, custom rules |
| Secrets | Gitleaks + push protection | TruffleHog (verified) | Rotate/respond |
| Deps/containers | Trivy, pip-audit/npm audit | Trivy full image scan | Upgrade decisions |
| DAST | ZAP baseline | ZAP active + Nuclei | — |
| API fuzzing | Schemathesis (schema exists) | RESTler stateful | — |
| Network | — | nmap expected-ports diff | Real pentest |
| Logic/authz | — | — | Threat model, pentest |

### Open questions

- Findings management: dedupe/prioritize across scanners (central platform vs SARIF-to-GitHub-code-scanning)?
- Should the security-review LLM agent (whitehat-style) run per-PR or per-release, and does it gate or advise?
- How aggressively to gate on dependency CVEs (severity threshold, VEX/reachability analysis to cut noise)?
- Staging environment fidelity for DAST — mocked AWS (as in the existing harness gate-verify) vs real-ish staging?

---

## 6. Metrics for agentic dev loops

### Findings

**DORA is necessary but no longer sufficient.** 2025–2026 consensus: deployment frequency and
lead time become misleading when AI writes 30–70% of committed code — throughput rises while
quality silently degrades. The fix is an **attribution layer**: separate AI-assisted from
human-authored work, then watch change-failure rate and rework by origin. If deploy frequency
rises and CFR rises too, you can't tell whether AI helps without attribution.

**Agent-loop-specific metrics practitioners are converging on:**

- **Iterations-to-green** — attempts until all gates pass; the purest measure of build-agent + spec
  quality. Instrument in the loop controller (count gate runs per task). No off-the-shelf tool;
  teams log it themselves.
- **Human-touch count / intervention rate** — escalations, manual edits, review rejections per
  task. The 2026 framing: human-in-the-loop checkpoints as structured, logged events, not ad-hoc.
- **Cycle time per stage** — spec → plan → first green → review-approved → merged; find the
  bottleneck stage.
- **Escaped defects** — bugs found post-merge attributed back to the originating task/agent/gate
  that should have caught them. This is the ground-truth quality metric everything else proxies.
- **Cost per merged PR / cost per task** — log model IDs + token counts at session level, roll up
  to effective cost per merged PR. Industry direction: **cost-per-task replaces cost-per-token**
  (include LLM calls, tool executions, and human-escalation time). Cautionary tale: Uber burned
  its annual AI-tooling budget in four months (early 2026), engineers at $500–$2,000/month before
  caps — per-task budgets and caps are now standard.
- **Review-quality signals** — reviewer finding density, judge scores, % findings accepted.

**Instrumentation reality:** DORA platforms (Faros, DX, Oobeya, etc.) are adding AI-attribution
features, but loop-internal metrics (iterations-to-green, gate pass/fail by gate) must be emitted
by the harness itself — structured JSONL per gate run is the common pattern, aggregated into a
dashboard. This aligns naturally with the existing gate-ci/gate-verify design: every gate run is
an event with task ID, agent, model, tokens, result.

### Options table

| Metric | Source | Gate-able? |
|---|---|---|
| Iterations-to-green | Harness loop controller | Yes (cap attempts → escalate) |
| Human-touch count | Escalation events, review actions | Trend only |
| Cycle time per stage | Task timestamps, PR events | Trend only |
| Escaped defects | Issue tracker → task backlink | Retro trigger |
| Change failure rate (AI-attributed) | Deploys + incidents + attribution | Trend |
| Cost per merged PR | Session token logs → PR rollup | Yes (budget cap) |
| Mutation score / review findings | Gate outputs | Yes |

### Open questions

- Standard event schema for gate runs (none exists; define one early — retrofitting attribution is painful).
- How to attribute escaped defects to a phase (spec gap vs build bug vs review miss) without heavy manual triage?
- What iteration cap triggers escalation to a human (3? 5?) and does the cap vary by task size?
- Token accounting across multiple agents/models per task — session-level logging discipline.

---

## 7. Architectural conformance checks in the inner loop

### Findings

**Newly urgent for agents:** "AI architecture drift" is a named 2026 problem — agents erode
layering and module boundaries incrementally because each individual change looks locally
reasonable. Fitness functions are the countermeasure: architecture rules as executable tests that
run with the unit-test suite, so drift fails fast in the inner loop rather than surfacing in
review.

**Tooling by stack:**

- **JS/TS:** `dependency-cruiser` (rule file validating the dependency graph: forbidden imports,
  circular deps, orphans; CLI exit codes → trivially a harness gate) and `eslint-boundaries` /
  `eslint-plugin-import` (element types + allowed-connection rules inside the lint run — meaning
  it rides the *existing* gate-ci lint step for free). **ArchUnitTS** is the newer, more
  test-like option (declarative rules, metrics, runs in the test suite).
- **Java:** ArchUnit (1.3 current) is the mature standard; Spring Modulith 1.4 GA bakes module
  verification in. Q1 2026 tooling maturity + CNCF data (42% of microservice adopters
  consolidating into modular monoliths) make module-boundary enforcement mainstream.
- **Python:** import-linter (contracts on import graph) is the closest equivalent.
- **.NET:** NetArchTest.

**Practice:** rules live in the repo, run via the normal test/lint command (`mvn test`,
`gradle check`, lint step), and are versioned like code. Keep rules few and meaningful (layer
direction, module isolation, no framework leakage into domain); every rule should encode a real
decision — ideally referenced to an ADR so the agent can read *why* when a rule blocks it. The
"Architecture Fitness Function" pattern is now catalogued specifically as an *agentic coding
pattern*: give the agent fast, deterministic architectural feedback in the same loop as tests.

### Options table

| Tool | Stack | Runs in | Strength |
|---|---|---|---|
| dependency-cruiser | JS/TS | CLI / CI gate | Full dep-graph rules, cycles, orphans |
| eslint-boundaries | JS/TS | Existing lint gate | Zero extra pipeline step |
| ArchUnitTS | TS | Test suite | Declarative + metrics |
| ArchUnit / Spring Modulith | Java | Test suite | Most mature ecosystem |
| import-linter | Python | CI gate | Import contracts |
| NetArchTest | .NET | Test suite | ArchUnit-style |

### Open questions

- Can the builder agent propose rule changes, or are architecture rules protected like tests (CODEOWNERS/ruleset)?
- Rule granularity: coarse layer rules only, or per-module contracts (maintenance cost vs drift protection)?
- How to bootstrap rules for an existing codebase without a wall of violations (baseline/ratchet mode)?

---

## 8. Spec-readiness gates and spec-driven development tooling

### Findings

**Landscape (mid-2026):**

- **GitHub Spec Kit** (~90k stars) — four sequential phases: `/specify` → `/plan` → `/tasks` →
  implement. Per-feature spec files; strong governance and cross-feature/systems analysis;
  GitHub-native; risk of spec drift over time. Best for greenfield with complex feature interactions.
- **OpenSpec** (Fission-AI, ~52k stars, most actively maintained OSS framework) — three-phase
  cycle: Propose (delta specs marked ADDED/MODIFIED/REMOVED) → Apply → Archive (merge into a
  single living source-of-truth spec). Lighter, faster iteration, explicitly designed for AI
  coding agents and brownfield work. "OpenSpec feels like a continuity layer; Spec Kit, a
  governance layer."
- **Amazon Kiro** — agentic IDE with SDD built in (requirements in EARS format → design → tasks);
  formalize intent before code. Strong opinionated flow, but IDE lock-in.
- **Tessl** — language-agnostic "agent enablement" platform; framework installs as tiles in
  `.tessl/` and teaches any MCP-compatible agent (Claude Code, Cursor, …) a spec-driven workflow:
  clarify → structured spec → **wait for developer approval** → implement. Also pursuing
  spec-as-source (code as regenerable output). The approval-gate step is directly relevant prior art.
- Also-rans/adjacent: BMAD, GSD (compared in 2026 roundups).

**Definition of Ready for agent work.** Classic agile DoR transfers well but needs sharpening for
agents. Convergent guidance:

- A good agent-ready spec defines six elements: **outcomes, scope boundaries, constraints, prior
  decisions, task breakdown, verification criteria.**
- **EARS-format requirements** (Easy Approach to Requirements Syntax; used by Kiro) are the
  practical readiness bar: each requirement collapses to a single testable claim with unambiguous
  trigger/scope/response — "an agent can read an EARS requirement, generate the code, and write a
  test that verifies it, without guessing."
- Keep the DoR small: 3–5 criteria; it's a "just-enough" gate — passing DoR means *understood*,
  not *approved*. The classic warning (Mountain Goat) still applies: an over-heavy DoR recreates
  waterfall stage-gates. For agents, though, the calculus shifts: agents can't absorb ambiguity in
  hallway conversations the way humans can, so a slightly stricter DoR pays for itself in fewer
  iterations-to-green.
- The readiness gate itself can be automated: an LLM check that every acceptance criterion is
  testable (maps to at least one concrete verification command), scope is bounded, and no
  unresolved `[NEEDS CLARIFICATION]` markers remain (Spec Kit's convention) — with a human
  approving the spec before build starts (Tessl's model).

### Options table

| Tool | Model | Best for | Watch-outs |
|---|---|---|---|
| GitHub Spec Kit | Per-feature specs, 4 phases | Greenfield, governance, GitHub-native | Heavier ceremony; spec drift |
| OpenSpec | Delta specs → living doc, 3 phases | Brownfield, fast agent iteration | Discipline-dependent validation |
| Kiro | EARS reqs → design → tasks in IDE | Teams wanting one opinionated flow | IDE lock-in |
| Tessl | Agent-agnostic tiles, approval gate | Multi-agent, spec-as-source direction | Younger; platform bet |
| Custom DoR gate in harness | Checklist + LLM testability check | Fits existing gate architecture | Build/maintain yourself |

### Open questions

- Adopt a framework's artifact format (OpenSpec deltas vs Spec Kit files) or define a minimal in-house spec schema the gates consume?
- Should spec approval be a hard human gate on every task, or only above a size/risk threshold?
- How to detect spec drift (implementation diverged from spec) automatically post-merge?
- EARS for everything, or only for behavior with test-shaped consequences?

---

## Synthesis: strongest options for a quality-first harness

**Review chain (topic 1, 4):** Claude (builder) → cross-family reviewer in a fresh session with a
compact spec+diff package (steal formin/multi-model-review's confidence-gated findings and
context-sufficiency escape hatch) → a cheap judge scoring the review against a randomized-order
rubric. Add Copilot code review or Gemini Code Assist on the PR as a near-free decorrelated third
signal. Avoid councils/multi-round debate — the evidence is against them. Review *against the
spec*, always in fresh context.

**Deterministic backbone:** LLM checks share failure modes with LLM builders (homogenisation
trap), so the uncorrelated gates carry the quality guarantee: diff-scoped **mutation testing**
(StrykerJS incremental / PIT git-scoped / mutmut) with a break threshold + survivor-feedback loop
into the test agent; **architecture fitness functions** riding the existing lint/test gates
(eslint-boundaries or dependency-cruiser first, since JS/TS); **Semgrep + Gitleaks + Trivy** on
every PR, **CodeQL + ZAP baseline + Schemathesis** nightly/staging, humans for logic/authz and
periodic pentest.

**Tamper-resistance is layered:** PreToolUse hooks / TDD Guard locally for fast feedback, but the
real guarantees are server-side — push rulesets on `.github/workflows/**`, harness config, and
hook files; CODEOWNERS + required review on `tests/**`; required checks + merge queue for
concurrent agent PRs. Treat local hooks as UX, CI as law — which matches the existing
harness philosophy (gates that exit non-zero).

**Front door and dashboard:** a small custom DoR gate (EARS-style testable criteria, no
unresolved clarifications, human approval per Tessl's model) using OpenSpec-style delta artifacts
for brownfield speed; and a harness-emitted event log (gate runs with task/model/tokens/result)
feeding iterations-to-green, human-touch count, escaped defects, and cost-per-merged-PR — with an
iteration cap that escalates to a human. Define the event schema first; everything else hangs
off it.

---

## Sources

- https://github.com/formin/multi-model-review
- https://arxiv.org/pdf/2606.01490 (LLM Consortium — multi-agent topologies controlled experiment)
- https://arxiv.org/pdf/2603.16244 (More Rounds, More Noise)
- https://arxiv.org/html/2603.12123 (Cross-Context Review)
- https://arxiv.org/pdf/2603.25773 (The Specification as Quality Gate)
- https://arxiv.org/html/2604.16790v1 (Bias in the Loop: Auditing LLM-as-a-Judge for SE)
- https://arxiv.org/pdf/2602.02219 (Position bias in rubric-based LLM-as-judge)
- https://arxiv.org/html/2603.00077v2 (Autorubric)
- https://redis.io/blog/why-multi-agent-llm-systems-fail/
- https://www.augmentcode.com/guides/mutation-testing-ai-generated-code
- https://stryker-mutator.io/docs/
- https://github.com/nizos/tdd-guard and https://nizar.se/tdd-guard-for-claude-code/
- https://dev.to/mikelane/building-guardrails-for-ai-coding-assistants-a-pretooluse-hook-system-for-claude-code-ilj
- https://www.totalum.app/blog/claude-code-hooks-totalum
- https://github.blog/ai-and-ml/automate-repository-tasks-with-github-agentic-workflows/
- https://blog.bytebytego.com/p/the-security-architecture-of-github
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets
- https://github.com/orgs/community/discussions/120676 (protecting workflow files)
- https://tenki.cloud/blog/github-merge-queue-setup
- https://appsecsanta.com/dast-tools/free-dast-tools
- https://zeropath.com/blog/best-sast-tools
- https://rafter.so/blog/secrets/secret-scanning-tools-comparison
- https://www.faros.ai/blog/key-takeaways-from-the-dora-report-2025
- https://oobeya.io/blog/dora-metrics-not-enough-2026
- https://blog.exceeds.ai/ai-coding-token-costs-2026/
- https://techdebt.fast/ai-architecture-drift/
- https://aipatternbook.com/architecture-fitness-function
- https://dev.to/x4nent/the-modular-monolith-2026-complete-guide-spring-modulith-archunit-fitness-functions-and-lessons-878
- https://github.com/github/spec-kit and https://github.com/Fission-AI/OpenSpec/
- https://intent-driven.dev/knowledge/spec-kit-vs-openspec/
- https://www.marktechpost.com/2026/05/08/9-best-ai-tools-for-spec-driven-development-in-2026-kiro-bmad-gsd-and-more-compare/
- https://www.augmentcode.com/tools/best-spec-driven-development-tools
- https://www.mountaingoatsoftware.com/blog/the-dangers-of-a-definition-of-ready
