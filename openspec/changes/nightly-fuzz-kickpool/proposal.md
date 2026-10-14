# nightly-fuzz-kickpool

## Why

nrl-predictor has run gate-fuzz nightly since 2026-07-16 (green since
2026-10-10). kickpool, the other fuzz-bound repo, has no scheduled run.

## What Changes

- kickpool `.github/workflows/nightly-fuzz.yml`, same shape as nrl-predictor's
  (fixtured boot, no secrets), cron 03:30 AEST. Draft is actionlint-clean.

## BLOCKED — decision needed (Tim)

gate-fuzz is **red on kickpool main today**: Schemathesis v4.22.4's coverage
phase sends `TRACE` to every API route, and each returns 500. Root cause is
Next.js itself: it builds a WHATWG `Request` for route handlers *and* for
`proxy.ts`, and undici throws "'TRACE' HTTP method is unsupported" — so no
app-level code runs before the crash (verified: a proxy.ts 405 guard builds
and loads but never executes; same on Next 16.3.4 and 16.3.8). Pages already
405. Options:

1. Exclude TRACE from kickpool's fuzz run as a documented framework limitation
   (production fronting via Amplify/CloudFront doesn't forward TRACE — verify),
   then ship the nightly.
2. Ship the nightly red and track an upstream Next.js issue.
3. Hold the nightly until Next fixes it.

## Also found

harness `fuzz.mjs` reports a docker daemon error (exit 125, e.g. the Docker Hub
timeout that failed nrl's 2026-10-09 nightly) as "findings above" — should be
a distinct infra-failure message.
