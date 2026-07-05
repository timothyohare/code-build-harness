import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { emit } from '../harness/controller/emit-event.mjs';

const eventsDir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'emit-test-'));
process.env.HARNESS_EVENTS_DIR = eventsDir;
const monthFile = () => path.join(eventsDir, `${new Date().toISOString().slice(0, 7)}.jsonl`);

test('emit appends a schema-complete JSONL line', () => {
  const before = fs.existsSync(monthFile())
    ? fs.readFileSync(monthFile(), 'utf8').split('\n').filter(Boolean).length
    : 0;
  const e = emit({
    phase: 'build',
    event: 'gate_run',
    agent_role: 'builder',
    result: 'pass',
    task_id: 'TEST-1',
    detail: { gate: 'ci' },
  });
  const lines = fs.readFileSync(monthFile(), 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, before + 1);
  const parsed = JSON.parse(lines.at(-1));
  // every schema field present (metrics.md, D-12)
  for (const key of [
    'ts',
    'run_id',
    'task_id',
    'phase',
    'event',
    'agent_role',
    'model',
    'tokens_in',
    'tokens_out',
    'cost_usd',
    'duration_ms',
    'result',
    'detail',
  ]) {
    assert.ok(key in parsed, `missing field ${key}`);
  }
  assert.equal(parsed.event, 'gate_run');
  assert.equal(parsed.task_id, 'TEST-1');
  assert.equal(parsed.detail.gate, 'ci');
  assert.ok(!Number.isNaN(Date.parse(parsed.ts)));
  assert.deepEqual(e.detail, { gate: 'ci' });
});

test('emit defaults result to n/a and reads env task id', () => {
  process.env.HARNESS_TASK_ID = 'ENV-7';
  const e = emit({ event: 'spec.drafted' });
  delete process.env.HARNESS_TASK_ID;
  assert.equal(e.result, 'n/a');
  assert.equal(e.task_id, 'ENV-7');
});
