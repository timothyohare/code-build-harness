# Documentation gap analysis

Status: draft (Tim + Claude, 2026-07-05)
Related: `enterprise-adoption.md`, `harness/legacy-parity.md`

What documentation exists, what's missing, and when to write it. Framed with the
[Diátaxis](https://diataxis.fr/) split: four documentation types with different
purposes, which should not be mixed in one document.

## Current coverage

| Diátaxis type | Purpose | Have today | Gap |
|---|---|---|---|
| **Explanation** (understanding-oriented) | Why the system is the way it is | `harness/README.md`, `harness/architecture.md`, `harness/decisions.md` rationale | Largely covered |
| **Reference** (information-oriented) | Look up exact facts | `harness/metrics.md` (event schema), `harness.json` key list, decisions register | Consolidate the `harness.json` schema into one canonical reference page |
| **How-to guides** (task-oriented) | Get a specific job done | — | **Missing entirely** |
| **Tutorials** (learning-oriented) | Take a newcomer from zero to working | — | **Missing entirely** |

How-to guides and tutorials are exactly what enterprise adoption lives or dies on:
explanation convinces an architect, but a how-to guide is what makes the tenth team
onboard without filing a support ticket.

## Gap list (priority order)

1. **Tutorial: onboard a repo in 15 minutes.** Write a `harness.json`, run
   `gate-ci --force --full` and `gate-verify`, see them green. The binding schema is
   frozen by the D-25 compatibility rule, so this is safe to write **now** — the
   only doc that is.
2. **How-to: handle an escalation.** What a blocked agent writes to
   `memory/escalations.md`, what the human does with it, how the loop resumes.
3. **How-to: read the telemetry.** From JSONL events to "what did this change cost
   and where did the loop spend its iterations."
4. **How-to: add a gate.** The no-op contract (unresolvable key ⇒ no-op, never a
   bogus command), event emission, Stop-hook wiring.
5. **Reference: canonical `harness.json` schema page.** Every key, its type, its
   default, which gate consumes it.
6. **Explanation: architecture diagram.** `architecture.md` paired with a C4-style
   context/container diagram — enterprise reviewers expect one.

## Sequencing rule

**Write tutorials and how-tos after M-parity, not before** (item 1 excepted). The
gate surface is mid-migration (`~/.claude/bin` → `harness/gates/`); documenting it
now means rewriting every command and path at cutover. A tutorial that drifts is
worse than no tutorial.

## Executable docs

Applying the harness ethos to its own documentation: every command in a tutorial or
how-to must be runnable, and ideally CI runs them. A doc-test step (extract fenced
commands, execute against a fixture repo, fail on non-zero) makes "the tutorial
works" a claim backed by a command that exits non-zero when false — same standard as
everything else. Add this when the first tutorial lands, not later.

## For the enterprise version

Write guides against the **enterprise** harness, not this one — paths, CI names, and
permission flows all differ. The gap list above transfers as a template; the content
does not. Per `enterprise-adoption.md`, don't let the internal model write docs for
features that don't exist yet: docs follow the gap-analysis build order, they don't
lead it.
