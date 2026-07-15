#!/usr/bin/env node
// Perf gate (D-25 port of ~/.claude/bin/gate-perf.mjs + event telemetry):
// deterministic route-latency check. Boots the app in a *deterministic* mode
// (fixtures/mocks, no live upstream network), measures p50/p95 for the
// configured routes, and soft-gates against a committed baseline. It catches
// code-caused latency regressions (parse, render, sort, serialization) while
// staying immune to real upstream network noise — which is why it must boot
// against fixtures, not the live world.
//
//   perf.mjs            # measure + compare to baseline
//   perf.mjs --update   # (re)write the baseline, always pass
//   perf.mjs --samples N
//
// Driven entirely by <repo>/.claude/harness.json:
//   perfBoot       deterministic boot command (e.g. prod build + start w/ fixtures)  [required]
//   perfRoutes     array of route paths to measure                                   [required]
//   perfReady      readiness URL (default: `ready`)
//   perfReadyMatch readiness body substring (default: `readyMatch`)
//   perfBase       base URL for routes (default: origin of perfReady/ready)
//   perfEnv        env vars for the perf boot, merged over `env`
//   perfBaseline   baseline file, relative to root (default: perf-baseline.json)
// If perfBoot/perfRoutes are absent the gate no-ops (exit 0), like the other gates.

import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emit } from '../controller/emit-event.mjs';
import { loadConfig } from './resolve.mjs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : d;
};
const UPDATE = has('--update');
const SAMPLES = Number(val('--samples', '40'));
const WARMUP = 3;

const { root, config } = loadConfig();
const log = (m) => process.stderr.write(`${m}\n`);
const sh = (cmd, opts = {}) => execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });

const started = Date.now();
// Telemetry is best-effort: a metrics write failure must never flip the verdict.
function record(result, detail = {}) {
  try {
    emit({
      event: 'validate.gate_run',
      phase: 'validate',
      result,
      duration_ms: Date.now() - started,
      detail: { gate: 'perf', root, ...detail },
    });
  } catch {}
}

const boot = config.perfBoot;
const routes = config.perfRoutes;
if (!boot || !Array.isArray(routes) || routes.length === 0) {
  log('• gate-perf: no perfBoot/perfRoutes configured — skipping.');
  process.exit(0);
}
const ready = config.perfReady ?? config.ready;
const readyMatch = config.perfReadyMatch ?? config.readyMatch;
if (!ready) {
  record('fail', { reason: 'perfReady/ready not configured' });
  log('✗ gate-perf: perfReady/ready not configured');
  process.exit(1);
}
const base = config.perfBase ?? new URL(ready).origin;
const baselinePath = join(root, config.perfBaseline ?? 'perf-baseline.json');
const env = { ...process.env, ...(config.env ?? {}), ...(config.perfEnv ?? {}) };

let server;
function cleanup() {
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {}
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

async function waitHttp(url, match, ms = 120_000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (server && server.exitCode !== null) return false; // boot process died
    try {
      const r = await fetch(url);
      const body = await r.text();
      if (r.ok && (!match || body.includes(match))) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];

async function timeRoute(route) {
  const url = `${base}${route}`;
  for (let i = 0; i < WARMUP; i++) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${route} → ${r.status} (warmup)`);
    await r.arrayBuffer();
  }
  const samples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t0 = performance.now();
    const r = await fetch(url);
    await r.arrayBuffer();
    const dt = performance.now() - t0;
    if (!r.ok) throw new Error(`${route} → ${r.status}`);
    samples.push(dt);
  }
  samples.sort((a, b) => a - b);
  return { p50: percentile(samples, 0.5), p95: percentile(samples, 0.95) };
}

const r1 = (n) => Math.round(n * 10) / 10;
// Soft-gate budget: 50% over baseline plus a 10ms cushion for absolute machine
// noise — flags "a lot slower" without flaking on jitter, and scales from
// single-digit-ms API routes up to slower pages (a flat ms floor would let a
// fast route balloon undetected). We gate on the MEDIAN (p50): background load
// inflates the p95 tail but the median tracks real per-request work, so it's the
// robust "did the code get slower" signal on a noisy dev machine. p95 is shown
// for tail visibility but not gated.
const allowedBudget = (baseP50) => baseP50 * 1.5 + 10;

async function main() {
  log(`▶ perf boot: ${boot}`);
  const logFile = join(mkdtempSync(join(tmpdir(), 'gate-perf-')), 'boot.log');
  const fd = openSync(logFile, 'a');
  // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true -- perfBoot is a shell command string from the repo's committed harness.json (same trust boundary as an npm script), not user input
  server = spawn(boot, { cwd: root, shell: true, detached: true, stdio: ['ignore', fd, fd], env });

  log(`▶ waiting for ${ready} ...`);
  if (!(await waitHttp(ready, readyMatch))) {
    try {
      sh(`tail -n 40 ${logFile}`);
    } catch {}
    record('fail', { reason: `app never became ready at ${ready}` });
    log(`✗ gate-perf: app never became ready at ${ready}`);
    process.exit(1);
  }
  log(`✓ ready — measuring ${routes.length} routes × ${SAMPLES} samples\n`);

  const results = {};
  try {
    for (const route of routes) results[route] = await timeRoute(route);
  } catch (err) {
    record('fail', { reason: err.message });
    log(`✗ gate-perf: ${err.message}`);
    process.exit(1);
  }

  const baseline =
    !UPDATE && existsSync(baselinePath) ? (JSON.parse(readFileSync(baselinePath, 'utf8')).routes ?? {}) : null;

  const pad = (s, n) => String(s).padEnd(n);
  log(
    `${pad('route', 24)}${pad('p50*', 9)}${pad('p95', 9)}${pad('base p50', 10)}${pad('budget', 9)}status   (* = gated)`,
  );
  log('─'.repeat(80));
  const regressions = [];
  for (const route of routes) {
    const { p50, p95 } = results[route];
    const b = baseline?.[route];
    if (b) {
      const budget = allowedBudget(b.p50);
      const ok = p50 <= budget;
      if (!ok) regressions.push({ route, p50, budget, base: b.p50 });
      log(
        `${pad(route, 24)}${pad(`${r1(p50)}ms`, 9)}${pad(`${r1(p95)}ms`, 9)}${pad(`${r1(b.p50)}ms`, 10)}${pad(`${r1(budget)}ms`, 9)}${ok ? '✓' : '✗ SLOW'}`,
      );
    } else {
      log(
        `${pad(route, 24)}${pad(`${r1(p50)}ms`, 9)}${pad(`${r1(p95)}ms`, 9)}${pad('—', 10)}${pad('—', 9)}${baseline ? 'new route' : 'baseline'}`,
      );
    }
  }
  log('');

  if (UPDATE || !baseline) {
    const payload = {
      note: 'Deterministic route-latency baseline (gate-perf). Refresh with `node harness/gates/perf.mjs --update`.',
      capturedAt: new Date().toISOString(),
      samples: SAMPLES,
      routes: Object.fromEntries(routes.map((r) => [r, { p50: r1(results[r].p50), p95: r1(results[r].p95) }])),
    };
    writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`);
    record('pass', { baseline: UPDATE ? 'updated' : 'written', routes: routes.length });
    log(`✓ gate-perf: baseline ${UPDATE ? 'updated' : 'written'} → ${baselinePath}`);
    process.exit(0);
  }
  if (regressions.length) {
    record('fail', {
      reason: 'latency regression',
      regressions: regressions.map((r) => ({ route: r.route, p50: r1(r.p50), budget: r1(r.budget), base: r1(r.base) })),
    });
    log(`✗ gate-perf: ${regressions.length} route(s) regressed beyond budget (median):`);
    for (const r of regressions)
      log(`  ${r.route}: p50 ${r1(r.p50)}ms > budget ${r1(r.budget)}ms (baseline ${r1(r.base)}ms)`);
    log('\nIf the whole table rose uniformly it is likely machine load — re-run on a quiet machine.');
    log('If intended, refresh the baseline: node harness/gates/perf.mjs --update');
    process.exit(1);
  }
  record('pass', { routes: routes.length });
  log('✓ gate-perf: all routes within latency budget');
  process.exit(0);
}

main();
