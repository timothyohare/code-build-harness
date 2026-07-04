# Decisions Register

Converged from the divergent research (see `research/`). Status: **Final** = ratified
by Tim (2026-07-05, via answers in `QUESTIONS.md`); **Firm** = evidence is strong
enough that reversal would need new information.

## Ratification 2026-07-05

Tim answered all 20 questions. All proposed defaults accepted, with these specifics
and deviations:

| Q | Answer | Consequence |
|---|---|---|
| Q1 | New GitHub repo | Visibility TBD at creation. ⚠️ Push rulesets on a **private** repo require the GitHub Team plan — on the free plan the choice is: public repo, or drop push rulesets and rely on CODEOWNERS + required checks + CI diff-checks (weaker: blocks merge, not push). |
| Q2 | **Deviation from default**: first target is the existing `~/dev/newdev/aitutor` monorepo (dotpoint — TS/pnpm workspace), not a toy-first calibration project | Brownfield onboarding is M0 work: `harness.json` binding for a pnpm monorepo, architecture-rule baselining (ratchet mode, no wall-of-violations), metrics calibration will be noisier than greenfield |
| Q4 | Budget: **~$40/month** total; has Claude (subscription); will acquire Gemini, GitHub Copilot, and OpenAI Codex access | Per-task abort stays at $5 but the monthly cap binds first (~8 worst-case tasks). Mitigations: Claude usage rides the existing subscription (log tokens, marginal cost ≈ $0); route judge to cheapest tier; Copilot flat $10/mo comes out of the $40. Track cost-per-merged-PR from day 1. |
| Q13 | **Deviation from default**: mutation-testing incremental history files are **committed**, not CI-cached | Faster PR runs, no cache eviction; accepted risk is staleness/merge noise. Guard: nightly full run rewrites the history file; the file is bot-committed and excluded from review-diff sizing. |

All other questions: proposed default accepted as-is.

| ID | Decision | Status | Rationale / evidence |
|---|---|---|---|
| D-1 | The loop is Spec → Plan → Build → Validate → Review → Simplify → Ship, run by a local loop controller; GitHub Actions is the outer verification/merge layer | **Firm** | Universal pattern; matches existing gates + installed skills (spike 1) |
| D-2 | OpenSpec is the spec/change-bundle format; agent-skills `/spec` retired for this project | **Final** (Q6) | Spike 2 verified; 30-agent support fits multi-LLM; avoid two competing formats |
| D-3 | Review chain: one strong cross-family reviewer (fresh session, spec as contract, confidence-gated findings) + cheap judge scoring the review with randomized rubric; Copilot-on-PR as free advisory signal. **No councils, no multi-round debate** | **Firm** on shape; model choice **Final** (Q5) | Committees underperform best member (−37.6%); rounds add noise; judge-scores-review reduces position bias |
| D-4 | Test agent and build agent are separate roles; builder cannot modify test paths. Enforced twice: PreToolUse hook locally + CI diff-check/CODEOWNERS/push-ruleset remotely | **Firm** | Salesforce pattern 2; spike 4 proved local half; `sed -i` bypass argument proves the remote half is required |
| D-5 | TDD enforced mechanically (TDD Guard semantics: no implementation without verified-failing test), scoped to behavioral source, not config/scaffolding | **Final** | "Probably vs always is everything"; scoping avoids fighting the agent on non-behavioral files |
| D-6 | Mutation testing: diff-scoped incremental per PR with break <80% on changed lines; nightly full run; survivor-feedback into test agent; equivalent-mutant triage human-confirmed in v1 | **Final** (Q9) | Spike 3 (equivalent mutants exist in trivial code → 100% gate wrong); MuTAP (−50% detection without feedback loop) |
| D-7 | Deterministic gates carry the guarantee; LLM checks are additive | **Firm** | Homogenisation trap: LLM verifiers share blind spots with LLM builders |
| D-8 | Security stack: Semgrep+Gitleaks+Trivy per-PR (blocking on high/critical); CodeQL+ZAP+Nuclei+Schemathesis+TruffleHog nightly vs ephemeral staging; nmap only as expected-ports diff; humans for logic/authz | **Final** (Q16, Q17) | ~40% vuln rate in AI-generated code makes SAST non-negotiable; ZAP+Nuclei ≈ free Burp equivalent |
| D-9 | Architecture rules as fitness functions in the inner loop: eslint-boundaries (rides existing lint gate) + dependency-cruiser; every rule references an ADR; rules are ask-first tier, never builder-editable | **Final** | Named 2026 problem "AI architecture drift"; zero extra pipeline cost via lint |
| D-10 | Three-tier autonomy boundaries (always-do / ask-first / never-do) declared per change in the spec; graduation between tiers is metrics-driven per change class | **Firm** on mechanism; thresholds **Final** (Q19) | good-spec's boundary system; Böckeler's "direct human input where most important" |
| D-11 | Escalation policy: 3 consecutive reds on one gate, or 5 total iterations per task, or per-task budget hit → halt + handoff note + notify. Zero-retry: security criticals, protected-path attempts | **Final** (Q7) | The gap all sources leave open; caps must exist before out-of-loop operation |
| D-12 | All loop events logged as JSONL against a fixed schema from day 1 (schema in `metrics.md`) | **Firm** | Every metric and every experiment hangs off it; retrofitting attribution is painful |
| D-13 | Server-side machinery from day 1: required checks, CODEOWNERS, push rulesets on workflows/harness-config/hooks, merge queue | **Final** (Q1, Q14, Q15) | Local hooks are UX, CI is law; queue prevents semantic conflicts between green PRs |
| D-14 | Model routing: frontier for spec/build/primary-review; cheap for judge/commit-messages/summaries/release-notes | **Firm** | Quality-neutral cost lever (whitepaper p39–42); supports quality>speed>cost |
| D-15 | Worktree per change; filesystem (bundle + memory files) is durable state, fresh contexts per task | **Firm** | Loop Engineering isolation pattern; context-degradation evidence |
| D-16 | Harness config is code: versioned, PR-reviewed, under its own gates; the ratchet (retro step) is a formal loop phase with pruning discipline | **Firm** | Factory model; every rule traces to a failure; cap rules-file size |
| D-17 | v1 risk classes: exactly two (`docs/chore` light, everything else full), path-based not LLM-based | **Final** (Q11) | A gameable classifier is worse than none; add classes when metrics justify |
| D-18 | Simplify phase graduates to full autonomy first | **Final** | Behavior preservation is entirely machine-checkable — lowest-risk autonomy pilot |
| D-19 | Stay runner-agnostic: no GitHub Agentic Workflows adoption yet; track the preview | **Final** (Q18) | Custom harness retains control; platform is emerging |
| D-20 | Two-track norm: vibe/spike track (no harness) for prototypes; harness track for anything that ships | **Final** | Whitepaper team-norms recommendation; keeps the harness from taxing exploration |

## Explicitly rejected options

| Rejected | In favor of | Because |
|---|---|---|
| Multi-model review council / debate topology | Single cross-family reviewer + judge | Controlled experiments: ensembles fail to match best member |
| 100% mutation-kill requirement | Threshold + survivor triage | Equivalent mutants (spike 3) |
| Burp Suite Enterprise in CI | ZAP + Nuclei (+ Schemathesis) | Cost; accepted free equivalent |
| Prompt-level TDD/test-protection rules alone | Hooks + server-side enforcement | Prompts are advisory; gates are enforcement |
| GitHub Spec Kit / Kiro / in-house spec schema | OpenSpec | Ceremony / lock-in / build-it-yourself cost |
| LLM-based change-risk classifier (v1) | Path-based two-class rule | Gameable by the agent it constrains |
| nmap as "pentest" | Expected-ports regression check only | It isn't a pentest; CI runners must not scan shared infra |
| Same-session self-review | Fresh-context, cross-family | Same-session anchoring approves its own work |
