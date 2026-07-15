#!/usr/bin/env node
// Heavy gate (D-25 port of ~/.claude/bin/gate-verify.mjs + event telemetry):
// prove the app actually runs against mocked AWS and meets its acceptance spec.
// Brings up the mock, boots the app, waits for readiness, then runs the
// project's acceptance + observability checks. Tears everything down.
// This is the gate that closes the "we only found out later it didn't work" gap.
//
//   verify.mjs            # full boot-and-verify
//   verify.mjs --keep     # leave the mock + app running afterwards
import { execSync, spawn } from 'node:child_process';
import { mkdtempSync, openSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emit } from '../controller/emit-event.mjs';
import { loadConfig } from './resolve.mjs';

// Built-in mock adapters. A project can override with mockUp/mockDown in its
// binding; otherwise we map the named adapter to compose + a readiness port.
const ADAPTERS = {
  'dynamodb-local': { up: 'docker compose up -d', down: 'docker compose down', waitPort: 8000 },
  localstack: { up: 'docker compose up -d', down: 'docker compose down', waitPort: 4566 },
};

const KEEP = process.argv.includes('--keep');
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
      detail: { gate: 'verify', root, ...detail },
    });
  } catch {}
}

let boot;
let mockDown;
function cleanup() {
  if (KEEP) return;
  if (boot?.pid) {
    try {
      process.kill(-boot.pid, 'SIGTERM');
    } catch {}
  }
  if (mockDown) {
    try {
      sh(mockDown);
    } catch {}
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

function fail(msg) {
  record('fail', { reason: msg });
  log(`\n✗ gate-verify: ${msg}`);
  process.exit(1);
}

async function waitPort(port, ms = 30000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const ok = await new Promise((res) => {
      const s = net.connect(port, '127.0.0.1');
      s.on('connect', () => {
        s.destroy();
        res(true);
      });
      s.on('error', () => res(false));
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function waitHttp(url, match, ms = 90000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      const body = await r.text();
      if (r.ok && (!match || body.includes(match))) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const env = { ...process.env, ...(config.env ?? {}) };

// 1. Mock AWS up
const adapter = config.mockAws ? ADAPTERS[config.mockAws] : null;
const mockUp = config.mockUp ?? adapter?.up;
mockDown = config.mockDown ?? adapter?.down;
if (mockUp) {
  log(`▶ mock (${config.mockAws}): ${mockUp}`);
  try {
    sh(mockUp, { env });
  } catch {
    fail('mock up failed');
  }
  if (adapter?.waitPort && !(await waitPort(adapter.waitPort))) {
    fail(`mock port ${adapter.waitPort} never opened`);
  }
}
if (config.setup) {
  log(`▶ setup: ${config.setup}`);
  try {
    sh(config.setup, { env });
  } catch {
    fail('setup failed');
  }
}

// 2. Boot the app (detached process group so we can kill the whole tree)
if (!config.boot || !config.ready) fail('boot/ready not configured for this project');
const logFile = join(mkdtempSync(join(tmpdir(), 'gate-verify-')), 'boot.log');
const fd = openSync(logFile, 'a');
log(`▶ boot: ${config.boot}   (logs: ${logFile})`);
// nosemgrep: javascript.lang.security.audit.spawn-shell-true.spawn-shell-true -- boot is a shell command string from the repo's committed harness.json (same trust boundary as an npm script), not user input
boot = spawn(config.boot, { cwd: root, shell: true, detached: true, stdio: ['ignore', fd, fd], env });

// 3. Readiness
log(`▶ waiting for ${config.ready} ...`);
if (!(await waitHttp(config.ready, config.readyMatch))) {
  try {
    sh(`tail -n 40 ${logFile}`);
  } catch {}
  fail(`app never became ready at ${config.ready}`);
}
log('✓ ready');

// 4. Acceptance + observability against the live app
const ran = [];
for (const key of ['acceptance', 'observability']) {
  const cmd = config[key];
  if (!cmd) continue;
  ran.push(key);
  log(`▶ ${key}: ${cmd}`);
  try {
    sh(cmd, { env });
  } catch {
    fail(`${key} failed`);
  }
}

record('pass', { steps: ran });
log('\n✓ gate-verify passed');
process.exit(0);
