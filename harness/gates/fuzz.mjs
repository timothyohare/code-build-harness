#!/usr/bin/env node
// Fuzz gate (CHG-0026, spec: gate-fuzz): schema-driven API fuzzing.
// Boots the app deterministically (reusing the perf boot by default — no live
// network), then runs Schemathesis against the repo's OpenAPI document and
// fails on server errors (5xx) or responses that violate the declared schema.
// On-demand like gate-perf: NOT wired into the Stop hook or per-PR checks —
// fuzzing is slow and probabilistic; run it when touching API surface, plus
// scheduled runs once stable.
//
//   fuzz.mjs                # boot, fuzz, verdict
//   fuzz.mjs --examples N   # override the per-operation example budget
//
// Driven entirely by <repo>/.claude/harness.json:
//   fuzzSchema     OpenAPI document path, relative to root                [required]
//   fuzzBoot       boot command (default: perfBoot, then boot)            [required]
//   fuzzReady      readiness URL (default: perfReady, then ready)
//   fuzzReadyMatch readiness body substring (default: perfReadyMatch/readyMatch)
//   fuzzBase       base URL for requests (default: origin of the ready URL)
//   fuzzEnv        env vars merged over `env`
//   fuzzExamples   max generated examples per operation (default 50)
//   fuzzChecks     schemathesis checks (default: not_a_server_error,
//                  response_schema_conformance)
//   fuzzSeed       generation seed for reproducible runs (default 42)
//   fuzz           full command override — replaces the docker schemathesis
//                  invocation entirely (verdict still follows its exit code)
// If fuzzSchema is absent the gate no-ops (exit 0), like the other gates.

import { execSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emit } from '../controller/emit-event.mjs';
import { loadConfig } from './resolve.mjs';

const args = process.argv.slice(2);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : d;
};

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
      detail: { gate: 'fuzz', root, ...detail },
    });
  } catch {}
}

const schema = config.fuzzSchema;
if (!schema) {
  log('• gate-fuzz: no fuzzSchema configured — skipping.');
  process.exit(0);
}
if (!existsSync(join(root, schema))) {
  record('fail', { reason: `fuzzSchema not found: ${schema}` });
  log(`✗ gate-fuzz: fuzzSchema not found: ${schema}`);
  process.exit(1);
}
const boot = config.fuzzBoot ?? config.perfBoot ?? config.boot;
const ready = config.fuzzReady ?? config.perfReady ?? config.ready;
if (!boot || !ready) {
  record('fail', { reason: 'fuzzBoot/fuzzReady (or perf/boot fallbacks) not configured' });
  log('✗ gate-fuzz: fuzzBoot/fuzzReady not configured');
  process.exit(1);
}
const readyMatch = config.fuzzReadyMatch ?? config.perfReadyMatch ?? config.readyMatch;
const base = config.fuzzBase ?? new URL(ready).origin;
const examples = Number(val('--examples', config.fuzzExamples ?? 50));
const checks = config.fuzzChecks ?? 'not_a_server_error,response_schema_conformance';
const seed = config.fuzzSeed ?? 42;
const env = { ...process.env, ...(config.env ?? {}), ...(config.fuzzEnv ?? {}) };

// --network host so the container reaches the app on the loopback interface.
const fuzzCmd =
  config.fuzz ??
  `docker run --rm --network host -v ${root}:/repo:ro schemathesis/schemathesis:stable ` +
    `run /repo/${schema} --url ${base} --checks ${checks} --max-examples ${examples} --seed ${seed}`;

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

async function main() {
  log(`▶ fuzz boot: ${boot}`);
  const logFile = join(mkdtempSync(join(tmpdir(), 'gate-fuzz-')), 'boot.log');
  const fd = openSync(logFile, 'a');
  // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true -- fuzzBoot is a shell command string from the repo's committed harness.json (same trust boundary as an npm script), not user input
  server = spawn(boot, { cwd: root, shell: true, detached: true, stdio: ['ignore', fd, fd], env });

  log(`▶ waiting for ${ready} ...`);
  if (!(await waitHttp(ready, readyMatch))) {
    try {
      sh(`tail -n 40 ${logFile}`);
    } catch {}
    record('fail', { reason: `app never became ready at ${ready}` });
    log(`✗ gate-fuzz: app never became ready at ${ready}`);
    process.exit(1);
  }
  log(`✓ ready — fuzzing ${schema} against ${base} (${examples} examples/operation)\n`);

  // nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true -- fuzz command is composed from the repo's committed harness.json binding, not user input
  const run = spawnSync(fuzzCmd, { cwd: root, shell: true, stdio: 'inherit', env });

  if (run.status !== 0) {
    record('fail', { reason: 'fuzz findings', schema, examples, exit: run.status });
    log(`\n✗ gate-fuzz: findings above (exit ${run.status}). Failing requests are`);
    log('  reproducible with the printed seed/curl lines. Fix the handler or the');
    log('  schema — never widen the checks to silence a finding.');
    process.exit(1);
  }
  record('pass', { schema, examples });
  log('\n✓ gate-fuzz passed');
  process.exit(0);
}

main();
