import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const GATE = new URL('../harness/gates/mutation.mjs', import.meta.url).pathname;

function scaffold(binding, report) {
  const root = mkdtempSync(join(tmpdir(), 'mutation-gate-test-'));
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(root, '.claude', 'harness.json'), JSON.stringify(binding));
  if (report) {
    mkdirSync(join(root, 'reports', 'mutation'), { recursive: true });
    writeFileSync(join(root, 'reports', 'mutation', 'mutation.json'), JSON.stringify(report));
  }
  const eventsDir = join(root, 'events');
  return { root, eventsDir };
}

function runGate({ root, eventsDir }) {
  return spawnSync(process.execPath, [GATE], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, HARNESS_EVENTS_DIR: eventsDir },
  });
}

function events(eventsDir) {
  const file = join(eventsDir, `${new Date().toISOString().slice(0, 7)}.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
}

const killed = (line) => ({ mutatorName: 'X', status: 'Killed', location: { start: { line } } });

test('no mutation key: gate no-ops silently', () => {
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

test('green run: pass event with score, no survivor block', () => {
  const fx = scaffold({ mutation: 'true' }, { files: { 'src/a.mjs': { mutants: [killed(1), killed(2)] } } });
  try {
    const r = runGate(fx);
    assert.equal(r.status, 0);
    assert.match(r.stderr, /✓ gate-mutation passed/);
    assert.doesNotMatch(r.stderr, /surviving mutant/);
    const ev = events(fx.eventsDir)[0];
    assert.equal(ev.result, 'pass');
    assert.equal(ev.detail.score, 100);
    assert.equal(ev.detail.detected, 2);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('red run: exit 1, survivor summary names file/line/mutator', () => {
  const fx = scaffold(
    { mutation: 'exit 1' },
    {
      files: {
        'src/a.mjs': {
          mutants: [
            killed(1),
            {
              mutatorName: 'EqualityOperator',
              status: 'Survived',
              replacement: '!==',
              location: { start: { line: 7 } },
            },
          ],
        },
      },
    },
  );
  try {
    const r = runGate(fx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /1 surviving mutant/);
    assert.match(r.stderr, /src\/a\.mjs:7 EqualityOperator → "!=="/);
    assert.match(r.stderr, /do not lower the threshold/);
    const ev = events(fx.eventsDir)[0];
    assert.equal(ev.result, 'fail');
    assert.equal(ev.detail.undetected, 1);
    assert.equal(ev.detail.survivors[0].line, 7);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('missing report: verdict still follows the command', () => {
  const fx = scaffold({ mutation: 'true' });
  try {
    const r = runGate(fx);
    assert.equal(r.status, 0);
    const ev = events(fx.eventsDir)[0];
    assert.equal(ev.result, 'pass');
    assert.equal(ev.detail.score, undefined);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});

test('custom mutationReport path is honored', () => {
  const fx = scaffold({ mutation: 'exit 1', mutationReport: 'out/mut.json' });
  mkdirSync(join(fx.root, 'out'), { recursive: true });
  writeFileSync(
    join(fx.root, 'out', 'mut.json'),
    JSON.stringify({
      files: {
        'b.mjs': {
          mutants: [
            {
              mutatorName: 'BooleanLiteral',
              status: 'NoCoverage',
              replacement: 'false',
              location: { start: { line: 3 } },
            },
          ],
        },
      },
    }),
  );
  try {
    const r = runGate(fx);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /b\.mjs:3 BooleanLiteral/);
  } finally {
    rmSync(fx.root, { recursive: true, force: true });
  }
});
