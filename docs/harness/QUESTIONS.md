# Questions for Tim

Consolidated from all research and design work (2026-07-04). Each question has a
**proposed default** — if you just write "agree" next to a question, the default becomes
the decision (recorded in `decisions.md`). Ordered so the blocking ones come first.

## A. Blocking — needed before scaffolding the harness repo

**Q1. Where does the harness live?**
A new dedicated GitHub repo (public or private?), or start inside an existing project?
The GitHub outer loop (rulesets, required checks, merge queue) can't be spiked until
this exists. Note: push rulesets on private repos need the Team plan.
*Proposed default: new private repo `code-build-harness` under your account; revisit
visibility once it works.*
New GitHub repo.

**Q2. What is the first target project the harness builds?**
The harness needs a real codebase to prove itself on. Options: (a) a new toy-but-real
service built through the harness from scratch (cleanest metrics), (b) an existing
project like quicksite (brownfield reality check), (c) the harness builds itself
(dogfooding, but confounds the metrics).
*Proposed default: (a) first to calibrate, then (b).*
/home/timohare/dev/newdev/aitutor

**Q3. Primary stack for v1?**
The gate tooling is stack-specific (StrykerJS vs mutmut, eslint-boundaries vs
import-linter). Research assumed JS/TS-first with Python secondary — correct?
*Proposed default: TypeScript/Node for v1.*
yes

**Q4. Budget guardrails?**
Multi-model loops burn tokens (cautionary tale: Uber's engineers hit $500–$2k/month
before caps). What monthly cap, and what per-task budget triggers loop abort?
Which paid subscriptions/API keys exist today: Claude (obviously), GitHub Copilot?
Gemini API? OpenAI/Codex?
*Proposed default: $X/month cap you set; per-task abort at ~$5 equivalent; needs your
inventory of existing subscriptions.*
I have Claude. Maybe ~$40/month. I'll get Gemini, GitHub Copilot and OpenAI Codex.

## B. Design decisions — shape the build order

**Q5. Reviewer and judge models — which exactly?**
Research says: builder and reviewer must be different model families, fresh session,
spec as contract; judge scores the review, not the code. Given your idea (Claude
builds, Copilot reviews, Gemini judges): Copilot code review is GitHub-native but
weaker cross-file; Gemini Code Assist is stronger multi-file. Swap them (Gemini
reviews, cheap model judges)? Or run Copilot as the free extra signal and use a
Gemini API call as the structured reviewer?
*Proposed default: Claude builds → Gemini reviews (fresh context, spec+diff package) →
Copilot code review as free PR-level extra → cheap model (Haiku-class) judges the
review. Confirm you have Gemini API access.*
Happy with proposal. Will get Gemini access.

**Q6. Spec format: OpenSpec, Spec Kit, or minimal in-house schema?**
Spike 2 verified OpenSpec installs cleanly and serves ~30 agent tools from one spec
store (good for multi-LLM). Spec Kit is heavier governance. In-house = your gates
consume your own format, no dependency. There is also overlap with agent-skills'
`/spec` — pick one canonical.
*Proposed default: OpenSpec as the artifact store; agent-skills `/spec` skill retired
for this project to avoid two formats.*
Agree with proposal.


**Q7. Escalation policy — the gap in all prior art.**
When a gate fails repeatedly, when does the loop stop and call you?
*Proposed default: 3 consecutive red iterations on the same gate → halt, write a
handoff note (what was tried, hypotheses, blocking gate), notify human. 5 total
iterations per task regardless of gate → same. Budget abort per Q4. Zero-retry
escalation for: security-gate criticals, any attempt to modify protected paths.*
Agree with proposal.

**Q8. What does "human approval of the spec" look like?**
Hard human gate on every task, or only above a size/risk threshold? (Tessl gates every
spec; that's your in-the-loop starting point, but it's also the first candidate for
graduation.)
*Proposed default: every spec human-approved in v1; revisit after 20 tasks of metrics.*
agree with proposal.

**Q9. Mutation-testing gate placement and threshold.**
*Proposed default: diff-scoped incremental on every PR, break < 80% on changed lines;
full run nightly, informational; surviving mutants auto-fed to the test agent;
equivalent-mutant labels proposed by agents but confirmed by you (v1) — you'll see the
volume and can decide whether to delegate.*
agree with proposal

**Q10. Test-ownership boundary.**
Builder can't touch `tests/**` — but where exactly is the line for: fixtures, test
helpers/utilities, type stubs, config used by both (vitest.config, tsconfig)?
And the collusion problem: when the builder believes a test is wrong, the handoff is a
written request the test agent evaluates — but who arbitrates a disagreement?
*Proposed default: `tests/**` + `*.test.*` + fixtures owned by test agent; shared
config owned by neither (human/ask-first tier); disagreement = automatic escalation to
you.*

agree with proposal

**Q11. Risk classification of changes — how much machinery in v1?**
Verification depth should scale with risk (low-stakes changes don't need
LLM-judge + mutation + DAST). But a risk classifier is itself a component that can be
gamed by an agent that wants a lighter gate.
*Proposed default: v1 has exactly two classes — `docs/chore` (light gates) and
`everything else` (full gates); classifier is a path-based rule, not an LLM.*

Agree with proposal

**Q12. Metrics event schema — approve early.**
Everything (iterations-to-green, cost-per-PR, escaped-defect attribution) hangs off a
JSONL event log. Draft schema is in `metrics.md`. Any fields you want added before it
ossifies (it's painful to retrofit)?
nothing to add 


## C. Operational — can wait until the loop runs

**Q13. Where do mutation-testing incremental history files live** — CI cache
(ephemeral, safe) or committed (faster, risks staleness)?
*Proposed default: CI cache.*
committed

**Q14. Merge queue on from day 1** even with a single agent, or add when parallel
agents arrive? *Proposed default: on from day 1 — cheap, and retrofitting merge
semantics later is worse.*
agree with proposal

**Q15. Bot identity: GitHub App or your PAT** for agent-authored PRs? Affects
CODEOWNERS semantics, required-review integrity (a PAT-authored PR can't be
"independently" approved by you-as-CODEOWNER in spirit), and audit trail.
*Proposed default: GitHub App / machine user for the agent, you as human reviewer.*
agree with proposal

**Q16. Security findings surface:** SARIF → GitHub code scanning tab (native, free) or
a standalone report artifact for the "Security team" (you, for now)?
*Proposed default: SARIF to code scanning + a per-release markdown summary generated
from it.*
agree with proposal

**Q17. Nightly/staging environment for DAST** (ZAP active, Schemathesis): is a
docker-compose "staging" on your machine acceptable for v1, or should nightly jobs run
in Actions against an ephemeral environment?
*Proposed default: ephemeral environment inside the nightly Actions job.*
agree with proposal

**Q18. GitHub Agentic Workflows (public preview):** adopt now or stay runner-agnostic
and revisit in 6 months? *Proposed default: track, don't adopt; the harness keeps its
own loop controller.*
agree with proposal

**Q19. Human review graduation — what evidence moves a change class from
"you review every line" to "sampling"?**
*Proposed default: per change class, after ≥30 merged changes with zero escaped
defects and stable review-finding density, drop to 20% sampling; any escaped defect
resets the class to 100%.*
agree with proposal

**Q20. Loop cadence: how often does the harness-improvement retro run** (the ratchet
step that converts failures into new rules/gates)?
*Proposed default: automatic note per escalation + a weekly retro pass you skim.*
agree with proposal

## E. Extension requirements (added 2026-07-05 — see `extensions.md` for the analysis)

**Q21. Context check: are the new requirements (Spring Boot, Cassandra→Spanner/RDS,
Solace/Kafka→Pub/Sub, mobile) for a work/enterprise environment, separate from the
personal aitutor track?** This matters structurally: a work environment usually means
GitHub Enterprise (different ruleset/App constraints), restricted model access
(which cross-family reviewer is even allowed?), compliance/audit requirements, and a
CI platform that might not be GitHub Actions (Cloud Build? Jenkins?). If yes: which
constraints apply?
*Proposed default: treat as a second deployment target of the same chassis; the
profile/add-on architecture in extensions.md is designed so nothing in v1 needs
reworking either way.*

**Q22. Do you agree with the sequencing in extensions.md** (prove chassis on v1 →
SLO/o11y add-on → Spring Boot profile → prod evals + A/B → messaging migration →
DB migration → Angular/MCP → mobile last)? Or does work pressure force a different
first target (e.g., Spring Boot before v1 is proven)?
*Proposed default: as listed.*

**Q23. Migration loops: agents write shims/backfill/parity checks, humans own the
mapping spec and cutover decisions — agreed?** And rollback drills are mandatory
gates before any cutover?
*Proposed default: yes to both; cutover stays a hard human gate indefinitely (it
never graduates).*

**Q24. SLO stack**: where do the SLOs/telemetry live — GCP-native (Cloud Monitoring,
given the Pub/Sub/Spanner direction), Grafana/Prometheus OSS, or Datadog-class SaaS?
Determines the o11y gate's query interface.
*Proposed default: OpenTelemetry instrumentation everywhere (vendor-neutral),
GCP Cloud Monitoring as first backend given the Google direction.*

**Q25. A/B platform**: in-repo flag lib + JSONL assignment logging (harness-native,
free) vs GrowthBook/Unleash-class platform from day 1?
*Proposed default: harness-native until an experiment volume justifies a platform.*

**Q26. Mobile scope cut**: is "support iOS/Android" full app development through the
loop, or the realistic v2 cut (domain/view-model layer TDD in the loop; UI/e2e on a
nightly device lane; ship = release candidate, never store submission)?
*Proposed default: the realistic cut.*

**Q27. MCP servers**: first MCP server target = wrapping the harness itself (gates/
metrics/spec store as MCP tools for other agents), or an unrelated product server?
*Proposed default: wrap the harness — dogfoods the profile and makes the harness
consumable by every MCP-capable agent, which fits the multi-LLM direction.*

## D. Open research questions (no answer needed — tracked for later)

- Model-specificity of ratchet rules: are failure-mode rules portable across models, or per-model rule sets?
- Self-improving harness: can the loop mine its own transcripts to propose new gates — and who approves those?
- Cross-repo features (OpenSpec store model) — out of scope for v1.
- Sensor adequacy drills: cadence for seeded-fault injection (monthly?).
- Comprehension debt: what practice keeps you able to explain shipped code as volume grows ("I won't commit code I couldn't explain" — Willison)?
