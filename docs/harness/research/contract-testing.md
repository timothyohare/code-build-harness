# Contract Testing (Pact) — Evaluation

Evaluated: 2026-10-12. Outcome: **Pact deferred** — no current need. A lighter
breaking-change gate (oasdiff) is a candidate follow-up.

## Question

Should the harness add consumer-driven API contract testing, e.g. [Pact](https://pact.io)?

## When Pact earns its keep

- Consumer and provider live in **separate repos**, deploy **independently**, and
  often have **different owners**.
- The provider can break a consumer without either side's own test suite noticing.
- Pact records the consumer's real interactions and replays them against the
  provider in CI. Contracts are shared through a Pact Broker (or paid PactFlow),
  and `can-i-deploy` checks gate releases.

## Why it doesn't fit today

- Consumer projects mostly ship frontend + backend from **one repo, deployed
  together** (Next.js / SAM bindings). Shared types and the build already catch a
  contract break.
- The `fuzz` gate already proves the **provider conforms to its OpenAPI doc**
  (Schemathesis vs `fuzzSchema`). That is the provider half of contract testing.
- A broker is an extra stateful service to run. That's a lot of overhead for a
  solo-maintained setup.

## Remaining gap

Nothing stops a PR from changing the OpenAPI doc itself in a **breaking** way.
Fuzz proves the code matches the spec, not that the spec still matches what
existed before.

### Candidate: `contract` gate (oasdiff)

- Run `oasdiff breaking` on the PR's `fuzzSchema` against the copy on `main`.
- Exit non-zero on a breaking change unless it's explicitly acknowledged.
- No broker and no consumer-side tests. It reuses the existing `fuzzSchema` binding key.
- Would land as its own OpenSpec bundle (`/opsx:propose`).

## Revisit Pact when

Any repo starts calling another repo's API: a mobile app, a separate worker, or
another service hitting a kickpool or aitutor endpoint. The consumer's real usage
is then invisible from the provider side. Pact would back the same `contract`
gate in place of (or alongside) oasdiff.

---

# OpenAPI & AsyncAPI — Future Exploration

Surveyed: 2026-10-12. Status: **parked**, to explore later. Nothing is scheduled.

## AsyncAPI: not applicable yet

No harness-bound repo has messaging between services:

- **nrl-predictor:** EventBridge cron rules trigger Lambdas with a hard-coded
  payload (`infra/v2_stack.py`). It's a timer, not a message channel.
- **rotrade:** `scripts/alerts.py` publishes to SNS only to alert the operator.

Revisit (alongside Pact) when two services talk over SQS / SNS / EventBridge /
WebSocket / Kafka.

## OpenAPI: already in use, worth hardening

Current specs are hand-written and exist mainly so `fuzz` has something to test:
`kickpool/docs/openapi.yaml` and `nrl-predictor/scripts/gate/openapi.yaml`.

Gaps, cheapest first:

1. **Spec lint.** Run Redocly or Spectral on the spec inside the existing `lint` step.
2. **Breaking-change gate.** The oasdiff `contract` gate above.
3. **Route coverage.** Fuzz only tests the routes the spec lists (kickpool deliberately
   excludes `match-pulse`). A route that never gets added to the spec is invisible to
   every gate. Fail when a route is neither in the spec nor explicitly excluded.
4. **Specs for unbound repos.** aitutor and strengthtraining have harness bindings
   but no `fuzzSchema`, so fuzz never runs on them. Options: write the spec by hand,
   or generate it from code (e.g. zod-to-openapi). Generated specs can't drift from
   the code, which makes #3 unnecessary.

Suggested order when picked up: #1 + #2 as one OpenSpec change, then choose
between #3 and #4 depending on whether specs stay hand-written.
