# Agentic Code Build Harness — Documentation

How to plan, spec, validate, build, simplify, and ship software through an agentic
harness. Produced 2026-07-04 from `docs/ideas.md` via: divergent research (9 source
links + 8 web-research topics + whitepaper + 5 hands-on spikes) → evaluation →
convergence to decisions. **Start with `QUESTIONS.md` — answering it unblocks M0.**

## Reading order

1. **[evaluation.md](evaluation.md)** — every ideas.md idea judged against evidence
   (KEEP / KEEP-MODIFIED / RISKY), the four ideas needing real design work, and what
   the proposal was missing.
2. **[QUESTIONS.md](QUESTIONS.md)** — 20 questions for Tim, each with a proposed
   default ("agree" makes the default the decision). Section A blocks scaffolding.
3. **[decisions.md](decisions.md)** — the converged decisions register (D-1…D-20)
   plus explicitly rejected options.
4. **[architecture.md](architecture.md)** — the system diagram, exists-vs-build
   inventory, milestone build order (M0–M5), repo layout, trust model.
5. **[metrics.md](metrics.md)** — the JSONL event schema (approve via Q12),
   north-star metrics, experiment protocol, and the measured
   in-the-loop → on-the-loop → out-of-the-loop dial.
6. **Phase guides** — the operating manual per loop phase, one template
   (entry → process → exit gate → enforcement → metrics → escalation):
   - [phases/01-spec.md](phases/01-spec.md) — EARS requirements, spec-ready bar
   - [phases/02-plan.md](phases/02-plan.md) — sprint contract, coverage matrix, ≤100-line tasks
   - [phases/03-build.md](phases/03-build.md) — two-agent protocol, guardrail table
   - [phases/04-validate.md](phases/04-validate.md) — the gate stack, mutation policy
   - [phases/05-review.md](phases/05-review.md) — cross-family reviewer + judge chain
   - [phases/06-simplify.md](phases/06-simplify.md) — behavior-preserving reduction
   - [phases/07-ship.md](phases/07-ship.md) — merge queue, audit trail, the ratchet

## Evidence base

- [research/link-research.md](research/link-research.md) — the 9 ideas.md references analyzed
- [research/web-research.md](research/web-research.md) — 8 deep-dive topics with options tables
- [research/whitepaper-notes.md](research/whitepaper-notes.md) — "New SDLC" PDF extract
- [research/spikes.md](research/spikes.md) — 5 hands-on feasibility spikes
- [artifacts/protect-tests.mjs](artifacts/protect-tests.mjs) — working PreToolUse
  role-guard hook from spike 4 (destined for `harness/hooks/`)

## The one-paragraph thesis

Verification, not generation, is the bottleneck. So the harness's value is a stack of
gates that exit non-zero when a quality claim is false — deterministic gates carry
the guarantee (tests, mutation, static analysis, architecture rules), LLM reviews add
decorrelated signal on top, and the human is progressively redirected (never
removed) to where machine judgment fails: specs, business logic, and the retro that
turns every observed failure into a permanent rule. Local hooks are UX; CI is law;
the event log is the memory that lets the harness improve itself.
