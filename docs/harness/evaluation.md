# Evaluation of the ideas.md Proposal

Every idea from `docs/ideas.md`, judged against the prior-art research
(`research/link-research.md`, `research/web-research.md`, `research/whitepaper-notes.md`)
and the hands-on spikes (`research/spikes.md`). Verdicts: **KEEP** (well-supported, adopt
as-is), **KEEP-MODIFIED** (right instinct, change the shape), **DEFER** (right idea,
wrong time), **RISKY** (evidence against, or needs a redesign).

| # | Idea (ideas.md) | Verdict | Why |
|---|---|---|---|
| 1 | Local build + GitHub Actions check/merge | **KEEP** | Matches the universal "local hooks are UX, CI is law" pattern. Local hooks are bypassable by an agent with shell access; server-side required checks + rulesets are not (web-research §3, §4). |
| 2 | Loop: Spec → Plan → Build → Test → Review → Simplify → Ship | **KEEP** | Maps one-to-one onto agent-skills' lifecycle and the Kaggle whitepaper's DEFINE→…→SHIP. The loop skeleton already exists locally as installed skills (`/spec`, `/plan`, `/build`, `/test`, `/review`, `/code-simplify`, `/ship`) plus the `sdlc` orchestrator (spike 1). |
| 3 | Agent hooks | **KEEP** | Spike 4 proved a 30-line PreToolUse hook enforces role separation deterministically. Fowler/Böckeler's feedforward-vs-feedback framing tells you *where* each hook belongs. |
| 4 | Multi-LLM: Claude builds, Copilot reviews, Gemini judges | **KEEP-MODIFIED** | Cross-family review is well-supported (complementary blind spots). But the evidence is against committees: heterogeneous teams underperform their best member by up to 37.6%, and more review rounds add noise. Shape it as: **one strong cross-family reviewer in a fresh session reviewing against the spec, plus a cheap judge scoring the *review* (not re-reviewing the code) with randomized rubric ordering.** Copilot/Gemini-on-PR are near-free decorrelated extra signals, not the primary review. |
| 5 | Small, reviewable increments | **KEEP** | Appears in every source (~100-line sizing, thin vertical slices, surgical changes). Review is the first stage to strain at agent speed; small diffs are what keep it viable. |
| 6 | Metrics on each loop | **KEEP** | Consensus loop metrics: iterations-to-green, human-touch count, cycle time per stage, escaped defects, cost per merged PR. No off-the-shelf tool emits these — the harness must log structured events itself. **Define the event schema first**; retrofitting attribution is painful (web-research §6). |
| 7 | Priority: quality > speed > cost | **KEEP** | Consistent with "verification is the bottleneck" (Salesforce). Cost lever without quality loss: model routing — frontier models for spec/build, cheaper models for test-gen/judging/CI monitoring (whitepaper p39–42). |
| 8 | Iterate on the harness itself via experiments | **KEEP** | This is the "factory model": your primary output is the system that produces code. The ratchet principle (every failure becomes a permanent rule/gate) is the concrete mechanism. Harness config is itself code — PR-reviewed, versioned, under the harness. |
| 9 | Verification before code | **KEEP** | "Verification, not generation, is the bottleneck" is the single strongest cross-source theme. Existing gate-ci/gate-verify/gate-perf layer is the right foundation (spike 1). |
| 10 | Build agent can't change tests; separate test agent | **KEEP** | Direct prior art: Salesforce pattern 2 ("tests inherit whatever the agent misunderstood"), maker/checker sub-agents, planner/generator/evaluator splits. Spike 4 proved local enforcement works. Needs the double layer: PreToolUse hook locally + CI diff-check/CODEOWNERS/push-ruleset remotely, because `Bash(sed -i …)` can bypass file-path hooks. |
| 11 | Enforce TDD | **KEEP-MODIFIED** | Enforceable via TDD Guard (blocks implementation without a failing test, over-implementation, multi-test batches) rather than prompt instructions. Caveat: strict TDD-per-edit can fight agent workflows on scaffolding/config files — scope enforcement to source-with-behavior, not every file. |
| 12 | Mutation testing | **KEEP-MODIFIED** | The right "grade the graders" gate — the only automated detector of green-but-meaningless tests. But spike 3 showed **equivalent mutants survive even in trivial code, so a 100%-kill gate is wrong**. Use diff-scoped incremental runs on PRs with a break threshold (~80% on changed code), full runs nightly, survivor-feedback into the test agent's prompt (removing that loop cost ~50% fault detection in MuTAP research), and a triage path for equivalent mutants that the build agent cannot self-approve. |
| 13 | Security review + report for Security team | **KEEP** | Non-negotiable: ~40% vulnerability rates measured in AI-assistant-generated code. Layered: Semgrep+Gitleaks+Trivy per-PR; CodeQL nightly; SARIF into GitHub code scanning as the report surface. |
| 14 | Pentest: Burp, nmap, API fuzzing | **KEEP-MODIFIED** | Right goal, wrong tools for CI. Burp Enterprise is expensive — ZAP baseline (per-PR) + ZAP active + Nuclei (nightly, staging) is the accepted free equivalent. Schemathesis if an OpenAPI schema exists. nmap only as an expected-open-ports regression check against your own staging — it is not a pentest. Business logic/authz still needs humans. |
| 15 | Behavioural guardrails, acceptance gates, handoff/escalation rules | **KEEP** | Three-tier boundary system (always-do / ask-first / never-do) is the ready-made autonomy policy. **Escalation policy is the biggest gap in all prior art** — no source specifies when a failing loop escalates vs retries vs abandons. The harness must define it (see QUESTIONS.md Q7). |
| 16 | Never edit CI/workflows/branch config/secrets | **KEEP** | Strongest available mechanism: GitHub push rulesets on `.github/workflows/**`, harness config, hook files — the push itself is blocked, even on feature branches. Protect `.claude/settings*.json` and hook scripts the same way: they steer future agent behavior. |
| 17 | Human in → on → out of the loop | **KEEP-MODIFIED** | Correct direction, but the end-state framing is off: the goal is not zero human input, it's *directed* human input ("direct it to where it is most important" — Böckeler). Graduate items from ask-first to always-do only as gate coverage matures, per change-risk class, justified by metrics (escaped defects, review-finding density). Human review of tests and specs stays longest. |
| 18 | Spec + test pyramid judged before loop starts | **KEEP** | The Definition-of-Ready gate. EARS-format requirements are the practical bar ("an agent can read it, generate code, and write a test without guessing"). Automatable: LLM checks every acceptance criterion maps to a verification command, no unresolved clarification markers; human approves the spec (Tessl's model). Keep it small — 3–5 criteria, or you recreate waterfall. |
| 19 | Swappable competing skills | **KEEP** | The A/B substrate for harness experiments. agent-skills, OpenSpec commands, and Karpathy skills all coexist as plugins today (spike 2). Needs the metrics layer (idea 6) to make swap outcomes measurable. |
| 20 | Architectural conformance in the inner loop | **KEEP** | "AI architecture drift" is a named 2026 problem; fitness functions are the countermeasure. For JS/TS, `eslint-boundaries` rides the existing gate-ci lint step for free; dependency-cruiser for full graph rules. Each rule should reference an ADR so a blocked agent can read *why*. |
| 21 | Audit trail | **KEEP** | Whitepaper: trajectory evals matter as much as output evals — "a fluent output that skipped its verification steps is a more dangerous failure than one with a visible error." The JSONL gate-event log doubles as the audit trail. |
| 22 | Git worktrees, advisors, workflows | **KEEP** | Worktrees for parallel-agent isolation is standard (Loop Engineering). GitHub Agentic Workflows (public preview) worth tracking, but keep the harness runner-agnostic for now. |
| 23 | No PDFs; convert to Markdown | **KEEP** | Already practiced (whitepaper-notes.md is the converted extract). |

## The four ideas that need real design work (not just adoption)

1. **The escalation policy (idea 15).** Nothing in the literature defines
   retry-vs-escalate-vs-abandon. Proposed default in `decisions.md` D-11; needs Tim's
   confirmation.
2. **Mutation-gate policy (idea 12).** Threshold + equivalent-mutant triage + who
   adjudicates. Spike 3 makes this concrete.
3. **Test-ownership boundary (idea 10).** Where do fixtures/helpers sit? Who fixes a
   genuinely wrong test without builder–test-writer collusion?
4. **Autonomy graduation criteria (idea 17).** Which metrics, what thresholds, per
   which risk class, moves a step from human-gated to automatic?

## What the proposal is missing (found in research, absent from ideas.md)

- **A defined event schema for loop metrics** — everything else hangs off it.
- **Merge queue** for concurrent agent PRs (two individually-green PRs can conflict semantically).
- **Model routing for cost** — the quality-neutral cost lever.
- **Seeded-fault drills** — when gates never fire, is the code good or the sensors blind? Periodically inject a known bug and confirm the gates catch it.
- **A retro step in the loop** — the ratchet needs a formal moment where each observed failure becomes a new rule/gate, and a pruning discipline so rules don't bloat (trace every rule to a failure; cap rule-file size).
- **Two-track norm** — vibe/spike track for prototypes vs harness track for production, so the harness doesn't tax exploration.
