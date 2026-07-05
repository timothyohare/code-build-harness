import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const GATE = new URL('../harness/gates/perf.mjs', import.meta.url).pathname;
// Own range (verify tests use 34100+): unique port per test in this file.
let portSeq = 0;
const nextPort = () => 34600 + (process.pid % 300) + portSeq++;

function scaffold(binding) {
  const root = mkdtempSync(join(tmpdir(), 'perf-gate-test-'));
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
    timeout: 90_000,
  });
}

function events(eventsDir) {
  const file = join(eventsDir, `${new Date().toISOString().slice(0, 7)}.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
}

// Server with a fast route and a ~40ms artificially slow route.
const server = (port) =>
  `node -e "require('http').createServer((q,s)=>{if(q.url==='/slow'){setTimeout(()=>s.end('slow'),40)}else{s.end('perf-ok')}}).listen(${port})"`;

const FAST_ARGS = ['--samples', '5'];

test('no perfBoot/perfRoutes: gate no-ops silently', () => {
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

test('perf keys without any ready URL fails with a fail event', () => {
  const fx = scaffold({ perfBoot: 'true', perfRoutes: ['/'] });
  try {
    const r = runGate(fx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /perfReady\/ready not configured/);
    assert.equal(events(fx.eventsDir)[0].result, 'fail');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('first run writes the baseline and passes', () => {
  const port = nextPort();
  const fx = scaffold({
    perfBoot: server(port),
    perfRoutes: ['/'],
    perfReady: `http://127.0.0.1:${port}/`,
    perfReadyMatch: 'perf-ok',
  });
  try {
    const r = runGate(fx, FAST_ARGS);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /baseline written/);
    const baseline = JSON.parse(readFileSync(join(fx.root, 'perf-baseline.json'), 'utf8'));
    assert.ok(baseline.routes['/'].p50 >= 0);
    assert.equal(baseline.samples, 5);
    const evs = events(fx.eventsDir);
    assert.equal(evs[0].result, 'pass');
    assert.equal(evs[0].detail.baseline, 'written');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('median within budget passes against a committed baseline', () => {
  const port = nextPort();
  const fx = scaffold({
    perfBoot: server(port),
    perfRoutes: ['/'],
    perfReady: `http://127.0.0.1:${port}/`,
  });
  writeFileSync(join(fx.root, 'perf-baseline.json'), JSON.stringify({ routes: { '/': { p50: 100, p95: 120 } } }));
  try {
    const r = runGate(fx, FAST_ARGS);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /all routes within latency budget/);
    assert.equal(events(fx.eventsDir)[0].result, 'pass');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('median over budget fails with regression detail', () => {
  const port = nextPort();
  const fx = scaffold({
    perfBoot: server(port),
    perfRoutes: ['/slow'],
    perfReady: `http://127.0.0.1:${port}/`,
    perfBaseline: 'perf.json',
  });
  // budget = 0.1*1.5 + 10 ≈ 10ms; the /slow route takes ~40ms.
  writeFileSync(join(fx.root, 'perf.json'), JSON.stringify({ routes: { '/slow': { p50: 0.1, p95: 1 } } }));
  try {
    const r = runGate(fx, FAST_ARGS);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /regressed beyond budget/);
    const ev = events(fx.eventsDir)[0];
    assert.equal(ev.result, 'fail');
    assert.equal(ev.detail.regressions[0].route, '/slow');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('--update rewrites the baseline instead of failing', () => {
  const port = nextPort();
  const fx = scaffold({
    perfBoot: server(port),
    perfRoutes: ['/slow'],
    perfReady: `http://127.0.0.1:${port}/`,
  });
  writeFileSync(join(fx.root, 'perf-baseline.json'), JSON.stringify({ routes: { '/slow': { p50: 0.1, p95: 1 } } }));
  try {
    const r = runGate(fx, [...FAST_ARGS, '--update']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /baseline updated/);
    const baseline = JSON.parse(readFileSync(join(fx.root, 'perf-baseline.json'), 'utf8'));
    assert.ok(baseline.routes['/slow'].p50 > 10, 'baseline reflects the new slow reality');
    assert.equal(events(fx.eventsDir)[0].detail.baseline, 'updated');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('boot death is detected during the readiness wait', () => {
  const fx = scaffold({
    perfBoot: 'exit 7',
    perfRoutes: ['/'],
    perfReady: 'http://127.0.0.1:1/',
  });
  try {
    const t0 = Date.now();
    const r = runGate(fx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /never became ready/);
    assert.ok(Date.now() - t0 < 30_000, 'boot death short-circuits the 120s wait');
    assert.equal(events(fx.eventsDir)[0].result, 'fail');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});
