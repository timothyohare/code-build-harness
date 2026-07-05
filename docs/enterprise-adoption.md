# Enterprise adoption plan

Status: draft (Tim + Claude, 2026-07-05)
Related: `harness/decisions.md` (D-1…D-25), `harness/legacy-parity.md`, `harness/metrics.md`

How to transfer this harness — its findings, methodology, and enforcement design —
into an enterprise environment using an internal model.

## The core principle

The most valuable transfer artifact is **not the documentation or the code**. It is
the decisions register and the process that produced it. Documentation describes
conclusions; the register records *why* each conclusion was reached, which is the
only part that survives contact with a different environment.

The one prompt to avoid: *"look at this documentation and build something similar."*
That produces a plausible-looking clone that silently inherits assumptions that are
false in the enterprise (GitHub labels, client-side Stop hooks, local docker-compose,
personal-machine trust model), and nobody will know which parts were load-bearing.

## Transfer sequence

### 1. Write an enterprise-constraints doc first

One page, before anything else. Without it, "matches our enterprise settings" is a
vibe, not a spec, and the internal model will guess. It must state:

- Repo host (GitHub Enterprise, GitLab, other) and what PR/label/required-check
  machinery is available.
- CI system and what a "required check" looks like there.
- What the internal model's agent harness supports: hooks? stop-hooks? tool
  permissions? file-path restrictions? If it has no client-side hook system, the
  enforcement layer must move entirely server-side (see §4).
- Secrets, network egress, and data-classification rules.
- Compliance requirements and which teams own what.

Also resolve the boring blocker early: confirm you are **allowed** to feed this
repo's docs into the internal model, and that nothing in them (research notes,
whitepaper excerpts) is something legal/security would object to.

### 2. Port the decisions register, not the conclusions

Feed the internal model `docs/harness/decisions.md` (D-1…D-25) plus the constraints
doc, and ask it to **re-litigate every decision against the enterprise context**.
The output is an enterprise decisions register with an explicit verdict per decision:

- **Adopted as-is** — rationale still holds.
- **Adapted** — because enterprise constraint X changes the trade-off; record how.
- **Rejected** — because Y; record what replaces it.

`QUESTIONS.md` is the companion artifact: the batch question/answer pattern maps
directly onto an enterprise architecture-review board and is far more efficient than
interactive back-and-forth.

### 3. Gap analysis, then build incrementally

Only after the enterprise register exists: produce the gap list (what the enterprise
version needs that this harness doesn't have, and vice versa), then build it under
the harness's own discipline — one change per PR, gates green before any "done"
claim, escalation caps respected. **If the enterprise harness isn't built under the
discipline it enforces, it won't be trusted.**

### 4. Lead with the server-side enforcement pattern

The design already anticipates weaker client environments: the tamper-proof
server-side guard + required-checks pattern (CHG-0001/0002) does not depend on any
client-side hook support. It is the most portable enforcement asset in this repo.
If the enterprise agent platform lacks hooks, enforcement collapses onto this layer
cleanly — that is a feature of the design, and the pitch should say so.

## What the naive plan misses

Items that were absent from "pass in the docs, build something similar, fill gaps":

1. **The constraints doc** (§1) — the single biggest gap.
2. **An adoption success metric.** How do we know the enterprise harness works?
   The telemetry schema (`harness/metrics.md`) answers this. Port it early and set a
   target before rollout — e.g. escalation rate, gate red-to-green time, cost per
   merged change.
3. **A pilot repo.** Pick one low-risk enterprise service as the nrl-predictor
   equivalent and prove the full loop there before generalizing. One repo, end to
   end, beats ten repos half-onboarded.
4. **A coexistence/rollback story.** The forwarding-shim retirement pattern from
   `legacy-parity.md` (new path proven → shims for one release → removal) should be
   named explicitly in the enterprise plan. "We can back out at any point" is what
   gets these things approved.

## Sequencing relative to this repo

Two prerequisites in this repo before the transfer payload is stable:

- **Finish M-parity first.** The migration plan is `legacy-parity.md` steps 1–6;
  next task is porting `lib/harness.mjs` → `harness/gates/resolve.mjs` with unit
  tests. The 486-line legacy layer exceeds the ≤~100-line task target, so split:
  resolver core + explicit binding in one CHG, the autodetect families (Node/Next,
  Python, SAM) in follow-ups.
- **Do not change `harness.json` in bound repos (aitutor, kickpool, nrl-predictor)
  before cutover.** Reference baselines were recorded in CHG-0012, and cutover
  step 5 requires old and new gates to produce identical verdicts on **identical
  bindings** — changing bindings now invalidates the comparison and destroys the
  regression oracle. Inventory the debt now (short list per repo), fix it as
  separate per-repo changes *after* cutover, when the new gates themselves verify
  each cleanup. Exception: something actively broken (dead command, wrong key) —
  fix it and re-record that repo's baseline.

## Transfer payload checklist

In priority order:

| Artifact | Why it transfers |
|---|---|
| `harness/decisions.md` | The distilled learning; input to §2 re-litigation |
| Enterprise-constraints doc (new, §1) | Turns "similar" into a spec |
| Trust model (CLAUDE.md §Trust model) | Role/path ownership + server-side guard pattern |
| `harness/legacy-parity.md` | Template for "inventory what exists, decide replace/keep" |
| `harness/metrics.md` | Telemetry schema → adoption success metric |
| Phase docs (`harness/phases/`) | The methodology itself |
| `harness.json` schema | Stable (frozen by D-25 compatibility rule); safe to document now |
