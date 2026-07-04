# code-build-harness

Agentic build harness: Spec → Plan → Build → Validate → Review → Simplify → Ship.
Full design: `docs/harness/README.md`. Decisions register: `docs/harness/decisions.md`
(D-1…D-20 are ratified — don't relitigate them; propose amendments via PR instead).

## Commands (the proof, not the claim)

- `npm run lint` — syntax gate over all `.mjs`
- `npm test` — hook + emitter suite (18 tests). Must be green before any "done" claim.
- `node harness/controller/emit-event.mjs --event <name> [--phase p --task-id CHG-NNNN --agent-role r --result pass|fail|blocked|escalated --detail '{}']` — log a loop event (schema: `docs/harness/metrics.md`)

Every quality claim must be backed by a command that exits non-zero when the claim is
false. Run the gate; paste the output.

## Trust model (enforced by hooks + server-side guard — do not work around)

- Roles come from `.harness-role` (written by the loop controller; absent = human session).
- `tests/**`, `*.test.*`, `fixtures/**` — owned by the test-writer role. Builders:
  write requests to `memory/test-requests.md`, never edit tests directly.
- `.github/**`, `harness/hooks/**`, `harness/controller/**`, `.claude/**`, `CODEOWNERS`
  — human-only. PRs touching these fail the `guard` check unless a human applies the
  `harness-config-approved` label (`tests-approved` for test paths).
- If a hook blocks you: do what the block message says (usually: write the request to
  `memory/escalations.md` and halt). Do not attempt shell workarounds — the server-side
  guard catches them at the PR and the attempt is logged.

## Workflow

- `main` is PR-only; squash merges; required checks: `gates`, `guard`.
- One change = one OpenSpec bundle (`/opsx:propose` → apply → archive). Task IDs
  `CHG-NNNN` go in commit messages and event logs.
- Small increments: target ≤ ~100 changed lines per task; split larger work.
- Escalation caps (D-11): 3 consecutive reds on one gate, or 5 iterations on a task →
  stop, write a handoff note, escalate. Never grind past a cap.
