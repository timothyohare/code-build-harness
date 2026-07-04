# Extensions: Stack Profiles, Concern Add-ons, and Migration Loops

Requirements added 2026-07-05 (Tim, after M0): Java Spring Boot; iOS/Android/Angular;
A/B tests; database migration (Cassandra → GCP Spanner, Cassandra → AWS RDS Postgres);
SLOs & observability; production evals; mocks & test containers; Google Pub/Sub and
Solace/Kafka → Pub/Sub migration; building MCP servers.

**Design position: one chassis, three extension types — not nine harnesses.**
The chassis (loop controller, gate contract, trust model, event schema, review chain,
escalation policy) is stack-agnostic; it is the part that took all the design work and
it does not change. Everything requested lands as one of:

1. **Stack profile** — a binding file mapping each gate slot to that stack's tools
   (what `.claude/harness.json` already does, made first-class).
2. **Concern add-on** — additional gates/phases plugged into the existing loop.
3. **Migration loop** — a different loop *shape* sharing the chassis: the unit of
   progress is a verified parity milestone, not a feature.

This mirrors the existing evidence: every source said the loop and gates transfer
across stacks; only the sensors are stack-specific (Böckeler's "harnessability").

---

## 1. Stack profiles

A profile = one file per stack declaring the gate bindings:

| Gate slot | TS/Node (v1, exists) | Java Spring Boot | Angular | Android | iOS |
|---|---|---|---|---|---|
| lint/style | eslint | Checkstyle/Error Prone + Spotless | eslint + angular-eslint | ktlint/detekt | SwiftLint |
| typecheck/compile | tsc | javac (via build) | tsc (strict) | kotlinc | swiftc |
| unit/integration | node:test / vitest | JUnit 5 + **Testcontainers** | Jest/Vitest + Testing Library | JUnit/Robolectric | XCTest |
| e2e | Playwright | REST-assured / Playwright | Playwright | Espresso (emulator) | XCUITest (simulator) |
| mutation | StrykerJS `--incremental` | **PIT** (git-scoped, threshold gate) | StrykerJS | PIT (JVM code) | muter (weak — see risks) |
| architecture | eslint-boundaries / dep-cruiser | **ArchUnit / Spring Modulith** `verify()` | eslint-boundaries + Nx module boundaries | ArchUnit (Kotlin) | SwiftArchitectureRules (thin) |
| SAST/deps | Semgrep + Gitleaks + Trivy | Semgrep + CodeQL (strong Java) + Trivy | same as TS | MobSF + Semgrep | MobSF + Semgrep |
| boot-and-verify | gate-verify (mock AWS) | Spring context + Testcontainers compose | `ng serve` + Playwright smoke | emulator boot + smoke | simulator boot + smoke |

Notes per stack:

- **Java Spring Boot** is the *easiest* port — the research already named its tools
  (PIT, ArchUnit, Spring Modulith; web-research §2, §7) and its mutation/architecture
  tooling is the most mature of any stack. Testcontainers is native. High
  harnessability; do it first.
- **Angular** is a variant of the TS profile (add angular-eslint, Nx boundary rules if
  a workspace, budget checks in `angular.json` as a perf gate).
- **Mobile (iOS/Android)** is the *lowest* harnessability: slow builds break the
  fast-inner-loop assumption; emulators/simulators in CI are flaky (retry budgets
  needed); Swift mutation tooling is weak; release trains + store review make
  ship-phase autonomy structurally impossible. Adaptation: TDD stays at the
  view-model/domain layer (fast JVM/Swift unit tests); e2e goes to a nightly device
  lane, not the PR gate; the ship phase ends at "release-candidate built + screenshots
  diffed", never "shipped". Expect iterations-to-green to read differently — don't
  compare mobile metrics against service metrics.
- **MCP servers** are a TS (or Python) profile plus protocol-specific validation as
  the acceptance layer: schema/contract tests against the MCP spec, MCP Inspector
  smoke runs in gate-verify, plus MCP-specific security gates (tool-description
  injection/poisoning checks, permission-scope review — this is a named 2026 attack
  surface, so the security phase gets an MCP checklist). The harness itself is a
  future MCP consumer, so this profile is also self-serving.

Repo layout: `harness/profiles/<stack>.json` consumed by the same gates. The profile
is ask-first tier (agents propose, human approves — same as architecture rules).

## 2. Concern add-ons

### SLOs & observability (foundational — do this add-on first)

Two hook points already exist in the phase docs:

- **Validate**: gate-verify's "observability checks" become concrete: the o11y gate
  fails if the changed service doesn't emit the required RED metrics/traces/structured
  logs for new endpoints (spec's EARS requirements name the signals; the gate greps
  the running system's telemetry, not the source).
- **Ship**: SLOs as code in the repo (`slo/` definitions: objective, window, burn-rate
  alerts). The rollout gate consumes the **error budget**: burn-rate breach during
  staged rollout → automatic halt/rollback → escalation + retro entry. This is
  Böckeler's runtime-monitoring sensor class, wired to the same escalation policy
  (D-11) as build-time gates.

Every later add-on (A/B, evals, migrations) *depends on this one* — they all need
trustworthy production signals. Sequence it first.

### Production evals (the "does it actually work in prod" layer)

Extends Ship (07) with a progressive-delivery pipeline; "eval, not demo, is the bar"
(whitepaper) applied to production:

1. **Golden acceptance set**: the spec's EARS scenarios become replayable probes run
   against canary (synthetic monitoring derived from the spec — closes the
   "behavioral verification beyond tests" gap flagged in the research).
2. **Canary + shadow**: route N% or mirror traffic; diff error rate, latency, and
   *output parity* against baseline. Promotion is a gate: canary metrics within
   bounds + golden set green + no budget burn → promote; else auto-rollback (an
   `escalated` event, phase-attributed).
3. **For AI/LLM features specifically**: sampled LLM-as-judge scoring of production
   outputs against the spec's rubric (same judge discipline as the review chain:
   randomized rubric, numeric anchors, cross-family judge) + drift tracking of the
   score over time. Trajectory evals (whitepaper p22) apply to agents in prod too.

### A/B tests

Rides the same rails: a flag platform (start with a simple in-repo flag lib +
assignment logging; adopt GrowthBook/Unleash class tooling when volume justifies) plus
an **experiment-design gate** in the Spec phase — an experiment spec must declare
hypothesis, primary metric, guardrail metrics, minimum detectable effect, and sample
size *before* build (same "verification before code" principle; prevents p-hacking by
agents chasing green). Ship phase: assignment + exposure events land in the same JSONL
event pipeline (extend schema with `experiment_id`, `variant` in `detail`); analysis
is a gate artifact, and **guardrail-metric breach auto-kills the variant** via the
error-budget machinery above. Note: the harness's own improvement experiments
(metrics.md "experiment protocol") and product A/B tests are the same pattern at two
altitudes — one implementation serves both.

### Mocks & test containers

Policy, not new machinery — where each sits in the validate stack:

| Layer | Double | Why |
|---|---|---|
| Unit (PR, fast) | Hand-rolled fakes/mocks at *owned* interface boundaries | Speed; mocking what you don't own is banned (classic trap; tests mirror assumptions, not reality) |
| Integration (PR) | **Testcontainers**: real Postgres/Spanner emulator/Pub/Sub emulator/Kafka in Docker | Kills the "mock drift" false-green class; deterministic, CI-friendly |
| Boot-and-verify | Testcontainers compose profile (successor to gate-verify's mocked AWS) | Whole-system honesty |
| Nightly DAST/perf | Ephemeral real-ish env | Fidelity |

Google-ecosystem note: official emulators exist for Pub/Sub and Spanner and run under
Testcontainers — the same pattern covers the migration work below. Contract tests
(consumer-driven, Pact-style) belong here too once services multiply.

## 3. Migration loops (different loop shape, same chassis)

Feature loops iterate "task → green". Migration loops iterate **"parity milestone →
proven"** through the expand–migrate–contract pattern. The phases rename but the
chassis (gates, events, escalation, review, audit trail) is identical:

```
Spec      → inventory & mapping spec (schemas/topics, consumers, SLAs, cutover +
            ROLLBACK plan per step — rollback is a spec artifact, not an afterthought)
Plan      → milestone ladder, each with a parity gate and a rollback trigger
Build     → dual-write / dual-publish shims, backfill jobs, consumer adapters
Validate  → PARITY GATES (the migration's unit tests):
              data: row/partition counts, checksums over key ranges, sampled
                    field-level diffs, tail-latency of replication lag
              messaging: message-count & ordering parity on mirrored topics,
                    consumer-lag deltas, idempotency/duplicate-rate checks
Review    → cross-family review of mapping/shim code against the mapping spec
Simplify  → CONTRACT: delete shims, dual-writes, old-path code (Chesterton's Fence
            inverted: removal is the goal, gated on parity history)
Ship      → staged cutover (reads first, canary %, then writes), error-budget
            watch, rollback drill BEFORE cutover (a seeded-fault drill variant)
```

**Cassandra → Spanner / RDS Postgres.** The hard part is semantic, not mechanical:
Cassandra's partition-key data model, eventual consistency, and write patterns don't
map 1:1 to relational/Spanner interleaved tables — so the *mapping spec* is the
human-judgment artifact (ask-first tier), while agents grind the shims, backfill
jobs, and parity checks (high-volume, verifiable — ideal agent work). Parity gates
run continuously during dual-write, not once. Spanner path: official
migration tooling + emulator in Testcontainers; RDS path: standard dual-write +
CDC-style backfill. Cutover is per-table/per-keyspace milestone, never big-bang.

**Solace/Kafka → Pub/Sub.** Same shape, messaging-flavored: inventory
topics/queues/subscription semantics (Solace guarantees ≠ Kafka ≠ Pub/Sub —
ordering keys, ack deadlines, replay/seek, and dead-letter semantics differ; the
mapping spec must state per-topic what property each consumer actually relies on —
Hyrum's Law applies to message semantics). Dual-publish with mirrored consumers in
shadow mode, parity gates on count/ordering/duplicates, consumer-by-consumer cutover.
Pub/Sub emulator under Testcontainers makes the inner loop deterministic.

Migration-specific metrics (same event schema): milestones-to-parity, parity-gate
failure rate, rollback drills passed, dual-write overhead, cutover incidents (the
migration's escaped-defects analogue).

## Sequencing recommendation

The chassis needs to be *proven* before it's multiplied — finish M1–M3 on v1 (TS,
aitutor) first, then:

1. **SLO/observability add-on** (everything else depends on its signals)
2. **Java Spring Boot profile** (highest harnessability, most enterprise value,
   tooling already researched) — including Testcontainers as the validate-stack default
3. **Production evals + A/B** (share the canary/flag/error-budget machinery)
4. **First migration loop, messaging first** (Kafka→Pub/Sub is lower-risk than the
   database move: messages are transient, rollback is re-pointing consumers; the
   database migration then reuses the proven loop shape on higher stakes)
5. **Angular, then MCP profile** (small deltas off the TS profile)
6. **Mobile last** (lowest harnessability; needs the most chassis adaptations)

Open questions for Tim: `QUESTIONS.md` section E (Q21–Q27).
