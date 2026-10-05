import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { evaluateSeededDefects } from '../harness/pilot/evaluation.mjs';
import { runFixturePilot } from '../harness/pilot/fixture.mjs';
import { loadPilotConfig, validatePilotConfig } from '../harness/pilot/input.mjs';

const CONFIG = {
  task: {
    id: 'PILOT-1',
    name: 'validated-input',
    description: 'Build a deterministic feature.',
    acceptance: 'The feature returns the expected value.',
    plan: 'Write a failing test, implement, validate, and review.',
  },
  seededDefects: [
    {
      id: 'SEED-CORRECTNESS',
      category: 'correctness',
      owner: 'builder',
      severity: 'high',
      evidenceIncludes: 'SEED-CORRECTNESS',
    },
    {
      id: 'SEED-COVERAGE',
      category: 'coverage',
      owner: 'test-writer',
      severity: 'medium',
      evidenceIncludes: 'SEED-COVERAGE',
    },
  ],
};

test('pilot input is loaded from JSON and validated', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-input-'));
  const file = path.join(dir, 'pilot.json');
  fs.writeFileSync(file, JSON.stringify(CONFIG));
  assert.deepEqual(loadPilotConfig(file), CONFIG);
});

test('pilot input rejects missing tasks and invalid seeded-defect ownership', () => {
  assert.throws(() => validatePilotConfig({}), /task must be an object/);
  assert.throws(
    () => validatePilotConfig({ ...CONFIG, seededDefects: [{ ...CONFIG.seededDefects[0], owner: 'reviewer' }] }),
    /seededDefects\[0\].owner must be builder or test-writer/,
  );
});

test('seed evaluation requires the expected owner/category and supports evidence markers', () => {
  const evaluation = evaluateSeededDefects(CONFIG.seededDefects, [
    {
      id: 'R-17',
      category: 'correctness',
      owner: 'builder',
      evidence: 'The SEED-CORRECTNESS branch returns the wrong value.',
    },
    {
      id: 'SEED-COVERAGE',
      category: 'coverage',
      owner: 'builder',
      evidence: 'wrong owner',
    },
  ]);
  assert.deepEqual(evaluation, {
    seeded: 2,
    detected: 1,
    missed: ['SEED-COVERAGE'],
    catchRate: 0.5,
  });
});

test('fixture pilot exercises build, validation, routed correction, re-review, and defect metrics', async () => {
  const events = [];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-fixture-'));
  const result = await runFixturePilot(CONFIG, { root, emit: (event) => events.push(event) });

  assert.equal(result.status, 'approved');
  assert.equal(result.build.status, 'green');
  assert.equal(result.review.status, 'approved');
  assert.deepEqual(result.evaluation, { seeded: 2, detected: 2, missed: [], catchRate: 1 });
  assert.deepEqual(result.corrections, ['test-writer:SEED-COVERAGE', 'builder:SEED-CORRECTNESS']);
  assert.ok(events.some((event) => event.event === 'task_green'));
  assert.ok(events.some((event) => event.event === 'review_correction'));
  assert.ok(events.some((event) => event.event === 'seeded_defect_evaluation' && event.result === 'pass'));
});

test('fixture pilot fails its evaluation when a configured seed is not detected', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pilot-miss-'));
  const result = await runFixturePilot(CONFIG, { root, omittedSeedIds: ['SEED-COVERAGE'], emit: () => {} });
  assert.equal(result.status, 'evaluation-failed');
  assert.deepEqual(result.evaluation.missed, ['SEED-COVERAGE']);
  assert.equal(result.evaluation.catchRate, 0.5);
});
