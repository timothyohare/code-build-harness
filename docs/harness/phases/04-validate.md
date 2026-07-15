# Phase 4 — Validate (Test & Verify)

> Goal: prove the change works — and prove the *tests* work — with layered,
> mostly-deterministic gates. LLM checks share failure modes with LLM builders
> (homogenisation trap); the deterministic gates here are the uncorrelated backstop
> that carries the quality guarantee.

## Entry

Build phase exit: all tasks green, `gate-ci --full` exit 0.

## The validation stack (fast → slow, local → CI)

| Layer | What | Where | Blocking? |
|---|---|---|---|
| 1. Unit/integration/e2e suite | Test pyramid, 80/15/5 target | Local + CI required check | Yes |
| 2. Architecture fitness | eslint-boundaries / dependency-cruiser rules | Rides the lint step | Yes |
| 3. Boot-and-verify | `gate-verify`: mocked AWS up, app boots, acceptance + observability checks | Local + CI | Yes |
| 4. **Mutation testing** (diff-scoped) | StrykerJS `--incremental` (TS) / mutmut (Py) on changed lines | CI, per PR | Yes, break < 80% on changed code |
| 5. Security fast pass | Semgrep (diff) + Gitleaks + Trivy | CI, per PR | Yes on high/critical |
| 6. Perf check | `gate-perf` p50 vs committed baseline | On-demand / suspected regression | Soft |
| 6b. API fuzz | `gate-fuzz`: Schemathesis vs the repo's OpenAPI doc (`fuzzSchema` binding) over the deterministic boot; reds on 5xx / schema violations | On-demand when touching API surface; nightly once stable | Soft (CHG-0026) |
| 7. Mutation full run | Whole-codebase score | Nightly | Informational + retro feed |
| 8. Security deep pass | CodeQL, ZAP baseline→active, Nuclei, Schemathesis, TruffleHog verified, nmap expected-ports diff | Nightly vs ephemeral staging | Findings triaged next morning |

## Mutation testing — the "grade the graders" gate

Spike 3 proved the mechanics and the trap:

- 100% line coverage happily coexists with 0% mutant kill — mutation score is the only
  automated detector of green-but-meaningless agent tests, arguably the highest-risk
  gap in an agent pipeline without it.
- **Equivalent mutants survive even trivial code** (`v < lo → v <= lo` at a boundary),
  so a 100%-kill gate is wrong. Policy (Q9): break < 80% on changed lines;
  equivalent-mutant labels are *proposed* by an agent, *confirmed* by human in v1 —
  the build agent must never self-approve a survivor as "equivalent."
- **Survivor feedback loop**: surviving mutants are appended to the test agent's next
  prompt ("here is a bug your tests didn't catch — kill it"). MuTAP research: removing
  this loop cost ~50% fault detection. Feedback stays attached to the PR — overnight
  results detached from context get ignored.
- Cost control: incremental/diff-scoped on PRs (documented case: 3,731 of 3,965
  results reused), full runs nightly, results cached in CI (Q13).

## Behavioral verification beyond the suite

Tests validate what tests encode; `gate-verify`'s acceptance + observability checks
validate the running system. Two additions over time:

- **Trajectory audit**: the loop log shows every gate actually ran — "a fluent output
  that skipped its verification steps is a more dangerous failure than one with a
  visible error" (whitepaper). The Ship phase re-checks the trail is complete.
- **Seeded-fault drills** (periodic, not per-PR): inject a known bug, confirm the
  stack catches it. Answers "gates never fire — good code or blind sensors?"

## Behavioural (BDD) acceptance suites (CHG-0025)

The `acceptance` binding should point at a behavioural suite where the repo has
an HTTP API: scenarios in version-controlled feature files (given/when/then over
requests and responses), so the covered behaviours are readable in a diff without
running anything, and a failing scenario reds the gate by name.

Framework policy (ratified 2026-07-15): **native BDD per stack** — `pytest-bdd`
for Python repos, `cucumber-js` for JS/TS repos, Karate only for Java projects.
Reference implementation: nrl-predictor `scripts/gate/bdd/` (kept outside pytest
`testpaths` so unit CI never collects live-server scenarios; the binding invokes
it explicitly). Migration from an imperative acceptance script is
parity-then-cutover: the binding runs both until the scenario suite covers
everything the script asserts, then the script retires.

## Metrics emitted

| Event | Fields |
|---|---|
| `validate.gate_run` | task_id, gate, pass/fail, duration, findings_count |
| `validate.mutation` | task_id, score_changed_lines, survivors[], equivalents_proposed |
| `validate.security` | task_id, tool, severity histogram |
| `validate.drill` | drill_id, seeded_fault, caught_by (or MISSED) |

## Failure / escalation

- Deterministic gate red → back to Build (counts toward iteration caps).
- Mutation survivors → test agent (not build agent) gets the survivor loop.
- Security critical → immediate halt + human notification (zero-retry class, D-11).
- Drill MISSED → automatic retro item: a new sensor/gate is owed (ratchet).
