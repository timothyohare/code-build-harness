import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const GATE = new URL('../harness/gates/ci.mjs', import.meta.url).pathname;

function scaffold(binding) {
  const root = mkdtempSync(join(tmpdir(), 'ci-gate-test-'));
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(root, '.claude', 'harness.json'), JSON.stringify(binding));
  const eventsDir = join(root, 'events');
  return { root, eventsDir };
}

function runGate({ root, eventsDir }, { args = [], stdin = '' } = {}) {
  return spawnSync(process.execPath, [GATE, ...args], {
    cwd: root,
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, HARNESS_EVENTS_DIR: eventsDir },
  });
}

function events(eventsDir) {
  const file = join(eventsDir, `${new Date().toISOString().slice(0, 7)}.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
}

test('runs only bound steps and exits 0 when they pass', () => {
  const fx = scaffold({ lint: 'touch lint.ran', test: 'touch test.ran' });
  try {
    const r = runGate(fx, { args: ['--force'] });
    assert.equal(r.status, 0);
    assert.ok(existsSync(join(fx.root, 'lint.ran')));
    assert.ok(existsSync(join(fx.root, 'test.ran')));
    const evs = events(fx.eventsDir);
    assert.equal(evs.length, 1);
    assert.equal(evs[0].event, 'validate.gate_run');
    assert.equal(evs[0].result, 'pass');
    assert.deepEqual(evs[0].detail.steps, ['lint', 'test']);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('aggregates failures, runs all steps, exits 2, emits fail event', () => {
  const fx = scaffold({ lint: 'exit 1', test: 'touch test.ran' });
  try {
    const r = runGate(fx, { args: ['--force'] });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /gate-ci failed: lint/);
    assert.ok(existsSync(join(fx.root, 'test.ran')), 'later steps still run after a failure');
    const evs = events(fx.eventsDir);
    assert.equal(evs[0].result, 'fail');
    assert.deepEqual(evs[0].detail.failures, ['lint']);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('--full adds the build step', () => {
  const fx = scaffold({ build: 'touch build.ran' });
  try {
    const skip = runGate(fx, { args: ['--force'] });
    assert.equal(skip.status, 0);
    assert.ok(!existsSync(join(fx.root, 'build.ran')), 'build must not run without --full');
    const full = runGate(fx, { args: ['--force', '--full'] });
    assert.equal(full.status, 0);
    assert.ok(existsSync(join(fx.root, 'build.ran')));
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('stop_hook_active loop guard exits 0 without running steps or emitting', () => {
  const fx = scaffold({ lint: 'touch lint.ran' });
  try {
    const r = runGate(fx, { args: ['--force'], stdin: '{"stop_hook_active": true}' });
    assert.equal(r.status, 0);
    assert.ok(!existsSync(join(fx.root, 'lint.ran')));
    assert.equal(events(fx.eventsDir).length, 0);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('clean git tree skips the gate unless --force', () => {
  const fx = scaffold({ lint: 'touch lint.ran' });
  try {
    execFileSync('git', ['init', '-q'], { cwd: fx.root });
    const skip = runGate(fx);
    assert.equal(skip.status, 0);
    assert.ok(!existsSync(join(fx.root, 'lint.ran')), 'no source change: gate skipped');
    assert.equal(events(fx.eventsDir).length, 0, 'early exit emits nothing');

    writeFileSync(join(fx.root, 'index.mjs'), 'export {};\n');
    const run = runGate(fx);
    assert.equal(run.status, 0);
    assert.ok(existsSync(join(fx.root, 'lint.ran')), 'changed source triggers the gate');
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('telemetry write failure does not flip the verdict', () => {
  const fx = scaffold({ lint: 'touch lint.ran' });
  try {
    // Point the events dir at a regular file so mkdir/append inside emit() throws.
    const blocker = join(fx.root, 'not-a-dir');
    writeFileSync(blocker, 'x');
    const r = spawnSync(process.execPath, [GATE, '--force'], {
      cwd: fx.root,
      input: '',
      encoding: 'utf8',
      env: { ...process.env, HARNESS_EVENTS_DIR: blocker },
    });
    assert.equal(r.status, 0, 'gate stays green when the event append fails');
    assert.ok(existsSync(join(fx.root, 'lint.ran')));
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('non-git directory does not suppress the run', () => {
  const fx = scaffold({ lint: 'touch lint.ran' });
  try {
    const r = runGate(fx);
    assert.equal(r.status, 0);
    assert.ok(existsSync(join(fx.root, 'lint.ran')));
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});
