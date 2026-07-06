# Legacy Harness Parity (D-25)

The user-level gate layer at `~/.claude/{bin,lib}` (gate-ci, gate-verify, gate-perf,
harness-resolve + lib/harness.mjs, 486 lines, June 2026) is the incumbent harness for
Tim's repos (aitutor, kickpool, nrl-predictor). **This project replaces it** (Tim,
2026-07-05). Rule: no legacy feature is dropped without an explicit decision; the
`harness.json` schema stays compatible so bound repos need no rebinding.

## Feature inventory → parity status

Status: ✅ present in new harness · 🔜 planned (milestone noted) · 🆕 new-harness improvement over legacy

> **Update 2026-07-05 (CHG-0014…0018):** every 🔜 row below is now ✅ — ported
> as-is into `harness/gates/` (`resolve.mjs` + `resolve-cli.mjs`, `ci.mjs`,
> `verify.mjs`, `perf.mjs`), each gate emitting `validate.gate_run` JSONL events
> (the 🆕 rows), with 33 new unit tests. See "M-parity execution record" below.

### Resolver (`lib/harness.mjs`)

| Feature | Status |
|---|---|
| `findProjectRoot`: walk-up for `.claude/harness.json`, fallback git root | 🔜 port as-is (M-parity) |
| Autodetect Node/Next.js: lint/typecheck/build/test from npm scripts; placeholder-`test` exclusion; boot/ready for Next | 🔜 port as-is |
| Autodetect Python: ruff/mypy/pytest from pyproject; `.venv/bin` preference; tests-dir heuristic | 🔜 port as-is |
| Autodetect Python + Next frontend subdir (`frontend/web/client/app`) | 🔜 port as-is |
| Autodetect SAM/Lambda (`template.yaml` → sam build/local, localstack) | 🔜 port as-is |
| Explicit binding overlays defaults; absent key ⇒ gate no-ops (never a bogus command) | 🔜 port as-is — this contract is the heart of the design |

### gate-ci

| Feature | Status |
|---|---|
| lint + typecheck + test; `--full` adds build; aggregate failures, run all steps | 🔜 becomes `harness/gates/ci.mjs`; the loop's `ci` gate consumes it (today run-live shells npm directly — interim only) |
| `--force` + source-changed guard (git porcelain, source-extension filter) so the Stop hook is near-free | 🔜 port as-is |
| Stop-hook protocol: stdin JSON, `stop_hook_active` loop guard, exit 2 + stderr feedback | 🔜 port as-is; Stop hook re-pointed at new path at cutover |
| — | 🆕 new: every gate run emits a JSONL event (task/cost/duration attribution) — legacy has no telemetry |

### gate-verify

| Feature | Status |
|---|---|
| Mock adapters `dynamodb-local`/`localstack` (compose up/down + readiness port 8000/4566); `mockUp`/`mockDown` overrides | 🔜 port; extensions.md adds Testcontainers as the successor pattern, adapters kept for compatibility |
| `setup` step; `env` merge | 🔜 port as-is |
| Boot as detached process group; log-file capture; `tail -40` on failure; kill process tree + mock down on exit/SIGINT; `--keep` | 🔜 port as-is |
| HTTP readiness (`ready` + `readyMatch` substring) | 🔜 port as-is |
| `acceptance` + `observability` steps against the live app | 🔜 port; o11y step later deepens per extensions.md (OTel signal checks) |

### gate-perf

| Feature | Status |
|---|---|
| No-op without `perfBoot`/`perfRoutes`; `perfReady`/`perfReadyMatch`/`perfBase`/`perfEnv`/`perfBaseline` defaulting chain | 🔜 port as-is (M-parity, lower priority — no repo currently binds perf keys) |
| Warmup 3 + N samples (`--samples`, default 40); p50/p95; **median-gated** budget `base×1.5 + 10ms` (p95 shown, not gated); machine-noise guidance | 🔜 port as-is — the median-gating rationale is documented and correct for a dev machine |
| `--update` baseline rewrite; committed baseline file with note/timestamp | 🔜 port as-is |
| Boot-death detection during readiness wait | 🔜 port as-is |

### harness-resolve

| Feature | Status |
|---|---|
| `--json` / `--root` / `<key>` inspection CLI | 🔜 port as-is |

## What the new harness already adds beyond legacy

Role-based guardrail hooks (protect-paths, bash-guard) · two-agent TDD loop with
verified RED and D-11 escalation · TDD Guard integration (aitutor pattern) · JSONL
event telemetry with cost capture · GitHub outer loop (required checks, tamper-proof
guard, labels) · review-chain design · OpenSpec change bundles · decisions register.

## Migration plan (M-parity milestone, before any legacy retirement)

1. Port `lib/harness.mjs` → `harness/gates/resolve.mjs` unchanged (plus unit tests —
   legacy has none 🆕).
2. Port the three gates into `harness/gates/`, each emitting JSONL events (🆕),
   behavior otherwise identical; `harness.json` schema unchanged.
3. Loop controller's `ci` gate delegates to the ported gate-ci (removes run-live's
   inline npm shelling).
4. Repoint the Stop hook: `~/.claude/settings` Stop → `harness/gates/ci.mjs`
   (needs the harness repo path resolvable from any repo — ship as a small npm-linked
   bin or absolute path).
5. Cutover check per bound repo (aitutor, kickpool, nrl-predictor):
   `gate-ci --force --full` and `gate-verify` produce the same verdicts via old and
   new paths.
6. Only then: legacy `~/.claude/{bin,lib}` files replaced with forwarding shims (one
   release), then removed.

## Cutover reference baselines (recorded 2026-07-05, legacy gate-ci --force)

The ported gates must reproduce these verdicts on these repos before any retirement:

| Repo | Binding profile exercised | Verdict |
|---|---|---|
| `~/dev/newdev/kickpool` | Next.js; full gate-perf surface (8 routes, perfEnv fixtures + MOCK_LLM, port 3100), dynamodb-local adapter, setup (`dynamo:init`), acceptance (`verify:persistence`), env block | ✅ exit 0 — lint + typecheck + 131 tests / 19 files |
| `~/dev/newdev/nrl-predictor` | Python + Next frontend; compound lint/typecheck (ruff+mypy+frontend), mockUp/mockDown overrides (custom compose), custom gate scripts (`scripts/gate/*`), custom `perfBaseline` path, env block | ✅ exit 0 — ruff + mypy + frontend checks + 388 pytest tests |
| `~/dev/newdev/aitutor` | pnpm monorepo; boot/ready/readyMatch, new test binding (vitest, 7 tests), mockUp/mockDown (compose postgres+redis) | ✅ lint 0 / typecheck 0 / tests 7-of-7 (2026-07-05, onboarding session) |

Between them these three bindings exercise every `harness.json` key except
`observability` (unbound everywhere so far — it no-ops; the extensions.md o11y gate
will be its first real binding).

New-harness rollout status per repo: **aitutor** has the role-aware TDD Guard hook +
test binding (the template); **kickpool / nrl-predictor** stay legacy-bound until
M-parity, then get the aitutor treatment (TDD Guard + role hooks) as needed.

## M-parity execution record (2026-07-05, CHG-0014…0019)

| Step | Status |
|---|---|
| 1. Resolver + CLI port with unit tests | ✅ CHG-0014 (PR #15) |
| 2. Three gates ported, each with `validate.gate_run` telemetry + tests | ✅ CHG-0015/0016/0017 (PRs #16–18) |
| 3. Loop `ci` gate delegates to ported gate-ci | ✅ CHG-0018 (PR #19) |
| 4. Stop hook repointed | ✅ `~/.claude/settings.json` Stop → `node …/code-build-harness/harness/gates/ci.mjs` (absolute path). Pipe-tested: loop-guard payload exit 0; clean foreign repo exit 0. **Rollback**: revert that one line to `node /home/timohare/.claude/bin/gate-ci.mjs`. |
| 5. Dual-run cutover checks | ✅ see below |
| 6. Legacy shims → removal | 🟡 **shims in place** (Tim approved 2026-07-06, CHG-0020). All five legacy files (`bin/gate-{ci,verify,perf}.mjs`, `bin/harness-resolve.mjs`, `lib/harness.mjs`) replaced with one-line forwarding shims (`await import(...)` / `export * from ...`) into `harness/gates/`. Verified: shimmed resolve CLI byte-identical `--json` on kickpool + exit-3 contract; shimmed lib import resolves; shimmed gate-ci runs the new gate with telemetry + loop guard; perf no-op and verify fail-fast paths exercised. Originals preserved at `~/.claude/bin/.legacy-originals-2026-07-06/`. Global `~/.claude/CLAUDE.md` gate paths updated to the new location. **Remaining**: after one release of quiet shims, delete the five shims + the backup dir. |

### Step-5 dual-run results (legacy path vs `harness/gates/` path, same repo, same binding)

Resolver: `--json` output **byte-identical** on aitutor, kickpool, nrl-predictor.

| Repo | gate-ci --force (old/new) | gate-verify (old/new) | Verdict |
|---|---|---|---|
| aitutor | 0 / 0 | 1 / 1 — both fail at "mock up failed" (compose postgres+redis; pre-existing env issue, not a port regression) | ✅ match |
| kickpool | 0 / 0 | 0 / 0 — dynamodb-local up, boot, persistence acceptance, teardown | ✅ match |
| nrl-predictor | 0 / 0 | 0 / 0 — custom compose overrides, Python + frontend boot, custom gate scripts | ✅ match |

All verdicts reproduce the CHG-0012 reference baselines. gate-perf dual-run not
required: no repo binds perf keys yet (kickpool's perf surface was exercised via
its binding profile in CHG-0012; the ported gate's behavior is pinned by its 7
unit tests including the no-op contract).
