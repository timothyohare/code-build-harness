import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createDeliveryLoop } from '../harness/controller/delivery-loop.mjs';
import { createReviewLoop } from '../harness/controller/review-loop.mjs';

const finding = (overrides = {}) => ({
  id: 'R-1',
  severity: 'high',
  confidence: 0.95,
  category: 'correctness',
  evidence: 'the result is wrong',
  ...overrides,
});

function fixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-loop-'));
  const calls = [];
  const gates = Object.fromEntries(
    ['green', 'ci', 'mutation'].map((name) => [
      name,
      async () => {
        calls.push(`gate:${name}`);
        return { pass: true };
      },
    ]),
  );
  return {
    root,
    calls,
    evidenceProvider: async () => ({ spec: 'spec', plan: 'plan', diff: 'diff', tests: 'tests', gates: 'green' }),
    correctors: {
      builder: async ({ findings }) => calls.push(`builder:${findings.map((item) => item.id).join(',')}`),
      'test-writer': async ({ findings }) => calls.push(`test-writer:${findings.map((item) => item.id).join(',')}`),
    },
    gates,
    emit: (event) => calls.push(`event:${event.event}`),
    ...overrides,
  };
}

test('approves a clean independent review without invoking correctors', async () => {
  const setup = fixture({
    reviewer: async () => ({
      review: { context_sufficient: true, summary: 'clean', findings: [], blocking: false },
      routed: { builder: [], 'test-writer': [], advisory: [] },
    }),
  });
  const loop = createReviewLoop({ taskId: 'clean', ...setup });

  const result = await loop.run();

  assert.deepEqual(result, { status: 'approved', rounds: 1, advisory: [] });
  assert.ok(!setup.calls.some((call) => call.startsWith('builder:') || call.startsWith('test-writer:')));
  assert.equal(loop._internals.loadState().status, 'approved');
});

test('routes coverage before implementation findings and runs owner-specific gates', async () => {
  let round = 0;
  const setup = fixture({
    reviewer: async () => {
      round += 1;
      if (round === 2) {
        return {
          review: { context_sufficient: true, summary: 'fixed', findings: [], blocking: false },
          routed: { builder: [], 'test-writer': [], advisory: [] },
        };
      }
      return {
        review: { context_sufficient: true, summary: 'fix both', findings: [], blocking: false },
        routed: {
          builder: [finding()],
          'test-writer': [finding({ id: 'R-2', category: 'coverage' })],
          advisory: [],
        },
      };
    },
  });
  const loop = createReviewLoop({ taskId: 'routed', ...setup });

  const result = await loop.run();

  assert.equal(result.status, 'approved');
  assert.deepEqual(
    setup.calls.filter(
      (call) => call.startsWith('test-writer:') || call.startsWith('builder:') || call.startsWith('gate:'),
    ),
    ['test-writer:R-2', 'gate:green', 'gate:ci', 'gate:mutation', 'builder:R-1', 'gate:green', 'gate:ci'],
  );
});

test('escalates insufficient context and malformed reviewer output', async () => {
  for (const [taskId, reviewer, reason] of [
    [
      'context',
      async () => ({
        review: { context_sufficient: false, summary: 'missing diff', findings: [], blocking: true },
        routed: { builder: [], 'test-writer': [], advisory: [] },
      }),
      'insufficient review context: missing diff',
    ],
    [
      'malformed',
      async () => {
        throw new Error('review output is not valid JSON');
      },
      'review failed closed: review output is not valid JSON',
    ],
  ]) {
    const setup = fixture({ reviewer });
    const result = await createReviewLoop({ taskId, ...setup }).run();
    assert.equal(result.status, 'escalated');
    assert.equal(result.reason, reason);
    assert.ok(fs.existsSync(result.handoff));
  }
});

test('escalates evidence and correction-gate process failures', async () => {
  const evidenceFailure = fixture({
    evidenceProvider: async () => {
      throw new Error('git diff failed');
    },
    reviewer: async () => assert.fail('reviewer must not run without evidence'),
  });
  const evidenceResult = await createReviewLoop({ taskId: 'evidence', ...evidenceFailure }).run();
  assert.equal(evidenceResult.reason, 'review evidence failed closed: git diff failed');

  const gateFailure = fixture({
    reviewer: async () => ({
      review: { context_sufficient: true, summary: 'finding', findings: [], blocking: false },
      routed: { builder: [finding()], 'test-writer': [], advisory: [] },
    }),
  });
  gateFailure.gates.green = async () => {
    throw new Error('process could not start');
  };
  const gateResult = await createReviewLoop({ taskId: 'gate-crash', ...gateFailure }).run();
  assert.equal(gateResult.reason, "correction gate 'green' crashed for builder: process could not start");
});

test('escalates critical findings without allowing an automatic correction', async () => {
  const setup = fixture({
    reviewer: async () => ({
      review: { context_sufficient: true, summary: 'critical issue', findings: [], blocking: false },
      routed: { builder: [finding({ severity: 'critical' })], 'test-writer': [], advisory: [] },
    }),
  });

  const result = await createReviewLoop({ taskId: 'critical', ...setup }).run();

  assert.equal(result.status, 'escalated');
  assert.match(result.reason, /critical review finding R-1/);
  assert.ok(!setup.calls.some((call) => call.startsWith('builder:')));
});

test('escalates when a correction gate fails or the review cap is reached', async () => {
  const failedGate = fixture({
    reviewer: async () => ({
      review: { context_sufficient: true, summary: 'finding', findings: [], blocking: false },
      routed: { builder: [finding()], 'test-writer': [], advisory: [] },
    }),
  });
  failedGate.gates.green = async () => ({ pass: false, detail: 'still red' });
  const gateResult = await createReviewLoop({ taskId: 'gate', ...failedGate }).run();
  assert.equal(gateResult.status, 'escalated');
  assert.match(gateResult.reason, /correction gate 'green' failed/);

  const capped = fixture({
    reviewer: async () => ({
      review: { context_sufficient: true, summary: 'finding remains', findings: [], blocking: false },
      routed: { builder: [finding()], 'test-writer': [], advisory: [] },
    }),
  });
  const capResult = await createReviewLoop({ taskId: 'cap', ...capped, caps: { reviewRounds: 2 } }).run();
  assert.equal(capResult.status, 'escalated');
  assert.equal(capResult.rounds, 2);
  assert.match(capResult.reason, /review round cap \(2\) reached/);
});

test('delivery orchestration reviews only after deterministic build validation is green', async () => {
  const calls = [];
  const approved = createDeliveryLoop({
    buildLoop: { runBuildTask: async () => ({ status: 'green' }) },
    reviewLoop: {
      run: async () => {
        calls.push('review');
        return { status: 'approved' };
      },
    },
  });
  assert.equal((await approved.run({ name: 'task' })).status, 'approved');
  assert.deepEqual(calls, ['review']);

  const blocked = createDeliveryLoop({
    buildLoop: { runBuildTask: async () => ({ status: 'escalated' }) },
    reviewLoop: { run: async () => calls.push('should-not-run') },
  });
  const result = await blocked.run({ name: 'task' });
  assert.equal(result.status, 'escalated');
  assert.equal(result.review, null);
  assert.deepEqual(calls, ['review']);
});
