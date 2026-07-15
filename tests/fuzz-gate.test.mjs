import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const GATE = new URL('../harness/gates/fuzz.mjs', import.meta.url).pathname;

// Each fixture boots a real one-shot HTTP server so ready-wait is exercised;
// ports are distinct per test to avoid cross-test collisions.
const bootCmd = (port) =>
  `node -e "require('node:http').createServer((q,s)=>{s.setHeader('content-type','application/json');s.end('{\\"status\\":\\"ok\\"}')}).listen(${port})"`;

function scaffold(binding, { schema } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'fuzz-gate-test-'));
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(root, '.claude', 'harness.json'), JSON.stringify(binding));
  if (schema) writeFileSync(join(root, 'openapi.yaml'), schema);
  const eventsDir = join(root, 'events');
  return { root, eventsDir };
}

function runGate({ root, eventsDir }, extraArgs = []) {
  return spawnSync(process.execPath, [GATE, ...extraArgs], {
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

const SCHEMA = 'openapi: 3.0.3\ninfo: {title: t, version: "1"}\npaths: {}\n';

test('no fuzzSchema: gate no-ops silently', () => {
  const fx = scaffold({ lint: 'true' });
  try {
    const r = runGate(fx);
    assert.equal(r.status, 0);
    assert.match(r.stderr, /skipping/);
    assert.equal(events(fx.eventsDir).length, 0);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('fuzzSchema configured but file missing: fail fast, no boot', () => {
  const fx = scaffold({ fuzzSchema: 'openapi.yaml', fuzzBoot: 'true', fuzzReady: 'http://127.0.0.1:1/' });
  try {
    const r = runGate(fx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /fuzzSchema not found/);
    assert.equal(events(fx.eventsDir)[0].result, 'fail');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('schema present but no boot/ready resolvable: fail', () => {
  const fx = scaffold({ fuzzSchema: 'openapi.yaml' }, { schema: SCHEMA });
  try {
    const r = runGate(fx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /not configured/);
    assert.equal(events(fx.eventsDir)[0].result, 'fail');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('green run: boots, waits ready, verdict follows fuzz command (pass event)', () => {
  const fx = scaffold(
    {
      fuzzSchema: 'openapi.yaml',
      fuzzBoot: bootCmd(8791),
      fuzzReady: 'http://127.0.0.1:8791/',
      fuzzReadyMatch: 'ok',
      fuzz: 'true',
    },
    { schema: SCHEMA },
  );
  try {
    const r = runGate(fx);
    assert.equal(r.status, 0);
    assert.match(r.stderr, /✓ gate-fuzz passed/);
    const ev = events(fx.eventsDir)[0];
    assert.equal(ev.result, 'pass');
    assert.equal(ev.detail.gate, 'fuzz');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('red run: fuzz command failure reds the gate with guidance', () => {
  const fx = scaffold(
    {
      fuzzSchema: 'openapi.yaml',
      fuzzBoot: bootCmd(8792),
      fuzzReady: 'http://127.0.0.1:8792/',
      fuzz: 'exit 1',
    },
    { schema: SCHEMA },
  );
  try {
    const r = runGate(fx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /never widen the checks/);
    const ev = events(fx.eventsDir)[0];
    assert.equal(ev.result, 'fail');
    assert.equal(ev.detail.reason, 'fuzz findings');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('boot never becomes ready: fail with reason', () => {
  const fx = scaffold(
    {
      fuzzSchema: 'openapi.yaml',
      // exits immediately, so the dead-boot fast path trips rather than the timeout
      fuzzBoot: 'true',
      fuzzReady: 'http://127.0.0.1:8793/',
      fuzz: 'true',
    },
    { schema: SCHEMA },
  );
  try {
    const r = runGate(fx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /never became ready/);
    assert.equal(events(fx.eventsDir)[0].result, 'fail');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});
