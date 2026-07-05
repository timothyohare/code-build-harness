import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const GATE = new URL('../harness/gates/verify.mjs', import.meta.url).pathname;
// Distinct port per test run; verify boots a real HTTP server against it.
const PORT = 34100 + (process.pid % 400);

function scaffold(binding) {
  const root = mkdtempSync(join(tmpdir(), 'verify-gate-test-'));
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(root, '.claude', 'harness.json'), JSON.stringify(binding));
  const eventsDir = join(root, 'events');
  return { root, eventsDir };
}

function runGate({ root, eventsDir }, args = []) {
  return spawnSync(process.execPath, [GATE, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, HARNESS_EVENTS_DIR: eventsDir },
    timeout: 60_000,
  });
}

function events(eventsDir) {
  const file = join(eventsDir, `${new Date().toISOString().slice(0, 7)}.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
}

const SERVER = `node -e "require('http').createServer((q,s)=>s.end('app-ready')).listen(${PORT})"`;

test('happy path: mock up, setup, boot, readiness, acceptance/o11y, teardown', () => {
  const fx = scaffold({
    mockUp: 'touch mock.up',
    mockDown: 'touch mock.down',
    setup: 'touch setup.ran',
    boot: SERVER,
    ready: `http://127.0.0.1:${PORT}/`,
    readyMatch: 'app-ready',
    acceptance: 'touch acceptance.ran',
    observability: 'touch o11y.ran',
    env: { GATE_TEST_VAR: 'yes' },
  });
  try {
    const r = runGate(fx);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /✓ gate-verify passed/);
    for (const marker of ['mock.up', 'setup.ran', 'acceptance.ran', 'o11y.ran', 'mock.down']) {
      assert.ok(existsSync(join(fx.root, marker)), `${marker} missing`);
    }
    const evs = events(fx.eventsDir);
    assert.equal(evs.length, 1);
    assert.equal(evs[0].result, 'pass');
    assert.equal(evs[0].detail.gate, 'verify');
    assert.deepEqual(evs[0].detail.steps, ['acceptance', 'observability']);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('env binding is passed to steps', () => {
  const fx = scaffold({
    boot: SERVER,
    ready: `http://127.0.0.1:${PORT}/`,
    acceptance: 'test "$GATE_TEST_VAR" = "yes" && touch env.ok',
    env: { GATE_TEST_VAR: 'yes' },
  });
  try {
    const r = runGate(fx);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(fx.root, 'env.ok')));
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('missing boot/ready fails fast with a fail event', () => {
  const fx = scaffold({ acceptance: 'touch acceptance.ran' });
  try {
    const r = runGate(fx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /boot\/ready not configured/);
    assert.ok(!existsSync(join(fx.root, 'acceptance.ran')));
    const evs = events(fx.eventsDir);
    assert.equal(evs[0].result, 'fail');
    assert.match(evs[0].detail.reason, /boot\/ready/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('setup failure aborts before boot', () => {
  const fx = scaffold({
    setup: 'exit 1',
    boot: SERVER,
    ready: `http://127.0.0.1:${PORT}/`,
  });
  try {
    const r = runGate(fx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /setup failed/);
    assert.equal(events(fx.eventsDir)[0].result, 'fail');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('acceptance failure fails the gate and still tears down the mock', () => {
  const fx = scaffold({
    mockUp: 'touch mock.up',
    mockDown: 'touch mock.down',
    boot: SERVER,
    ready: `http://127.0.0.1:${PORT}/`,
    acceptance: 'exit 1',
  });
  try {
    const r = runGate(fx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /acceptance failed/);
    assert.ok(existsSync(join(fx.root, 'mock.down')), 'mockDown must run on failure exit');
    const evs = events(fx.eventsDir);
    assert.equal(evs[0].result, 'fail');
    assert.match(evs[0].detail.reason, /acceptance/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('mock up failure fails the gate before setup/boot', () => {
  const fx = scaffold({
    mockUp: 'exit 1',
    setup: 'touch setup.ran',
    boot: SERVER,
    ready: `http://127.0.0.1:${PORT}/`,
  });
  try {
    const r = runGate(fx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /mock up failed/);
    assert.ok(!existsSync(join(fx.root, 'setup.ran')));
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});
