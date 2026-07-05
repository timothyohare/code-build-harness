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

### Amendment 2026-07-05 (discovered during M0 scaffolding)

GitHub platform constraints on a **user-owned public** repo (`timothyohare/code-build-harness`):

1. **Merge queue is organization-owned-repos only** — the `merge_queue` ruleset rule
   is rejected on user repos. Q14's "on from day 1" is therefore deferred; option:
   transfer the repo to a free org when parallel agents arrive (or sooner).
2. **Push rulesets are org-owned AND non-public repos only** — the "block the push
   itself" layer from D-13 is unavailable. Replacement with equivalent merge-blocking
   strength: main is PR-only (branch ruleset), and a **`guard` required check runs on
   `pull_request_target`** — GitHub executes the *base branch's* version of that
   workflow, so a PR that tampers with workflows/hooks/harness config is judged by
   the untampered guard and fails unless a human applied the `harness-config-approved`
   label. Test-path changes likewise require `tests-approved`. Nothing ships without
   merging, so blocking merge ≈ blocking push for trunk protection purposes.

D-13 stands with this substitution. Revisit if/when the repo moves to an org.

## Ratification 2026-07-05 (2) — extension questions Q21–Q27

| Q | Answer | Consequence |
|---|---|---|
| Q21 | **Spring Boot is needed on the personal track too**; the rest (mobile, Angular, migrations, Sumo/Dynatrace) is enterprise. Work constraints to be provided later; Tim is exploring enterprise plans separately (with Fable). | Spring Boot profile moves up: it's now a personal-track deliverable, not gated on enterprise constraints. Enterprise chassis deployment deferred until constraints arrive. |
| Q22 | Sequencing agreed | Chassis proof (M1–M3) remains first; extensions.md order stands |
| Q23 | Agreed — humans own mapping spec + cutover (never graduates); rollback drills mandatory pre-cutover | Recorded as D-21 |
| Q24 | **Correction to proposed default**: personal projects deploy on **AWS**, not GCP. OTel everywhere agreed. Enterprise uses Sumo Logic (SLOs) + Dynatrace. | o11y gate: OTel instrumentation (vendor-neutral) with **AWS-native backend (CloudWatch / Managed Prometheus — pick at implementation)** for personal; Sumo/Dynatrace query adapters are enterprise work. extensions.md §SLO updated. |
| Q25 | Harness-native flags agreed; **explicit request: best practices for flag lifecycle** — fear is unbounded flag accumulation ("hard to track what's actually on") | Flag-lifecycle policy added to extensions.md (TTL on every flag, registry as code, stale-flag gate, cleanup as part of Simplify). Recorded as D-22. |
| Q26 | Mobile scope cut confirmed | Realistic cut only; mobile remains last in sequence |
| Q27 | Wrap the harness as the first MCP server | Future milestone after M5 |

Section D notes from Tim: self-improving harness proposals are approved by a human;
seeded-fault drills monthly; on comprehension debt he offered the C-compiler/assembly
analogy — gates may become the new "compiler trust" boundary (accepted as a direction,
with the review-phase explanation artifact as the safeguard while trust is earned).

New decisions from this ratification:

| ID | Decision | Status |
|---|---|---|
| D-21 | Migration loops: agents write shims/backfill/parity checks; humans own mapping spec and cutover (cutover never graduates); rollback drill is a mandatory gate before any cutover | **Final** |
| D-22 | Feature flags are harness-native with a mandatory lifecycle: every flag declared in a registry file with owner + expiry; a stale-flag gate fails CI when a flag passes its expiry; flag removal is a standing Simplify-phase task | **Final** |
| D-23 | Observability: OTel instrumentation everywhere; personal backend AWS-native; enterprise adapters (Sumo Logic, Dynatrace) deferred until work constraints are known | **Final** |
| D-24 | Builder agents get scoped `Bash(npm test)` (and only that) via `--allowedTools` for inner-loop feedback; authoritative verification remains the controller's gates; bash-guard hook stays as backstop (Tim, 2026-07-05, after first live run) | **Final** |
| D-25 | This harness **replaces** the legacy `~/.claude/{bin,lib}` gate layer. No legacy feature is dropped without an explicit decision; `harness.json` schema stays compatible; migration per `legacy-parity.md` (port gates with event telemetry added, dual-run cutover check per bound repo, forwarding shims before removal) (Tim, 2026-07-05) | **Final** |

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
