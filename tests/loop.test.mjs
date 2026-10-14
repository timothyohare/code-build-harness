import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, test } from 'node:test';
import { createLoop, DEFAULT_CAPS } from '../harness/controller/loop.mjs';

// All state in a temp root; events captured in-memory (no JSONL side effects).
let root, events;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-test-'));
  events = [];
});
const emit = (e) => events.push(e);

// Gate stub factory: pops scripted results in order, repeats the last one.
function scriptedGate(results) {
  const queue = [...results];
  return async () => (queue.length > 1 ? queue.shift() : queue[0]);
}

function makeLoop({ gates, executor, caps } = {}) {
  return createLoop({
    taskId: 'T-1',
    root,
    executor: executor ?? (async ({ role }) => ({ summary: `${role} done` })),
    gates,
    caps,
    emit,
  });
}

const PASS = { pass: true };
const FAIL = { pass: false, detail: 'boom' };

test('happy path: red→green→ci on first iteration', async () => {
  const loop = makeLoop({
    gates: { red: scriptedGate([PASS]), green: scriptedGate([PASS]), ci: scriptedGate([PASS]) },
  });
  const res = await loop.runBuildTask({ name: 'demo' });
  assert.equal(res.status, 'green');
  assert.equal(res.iterations, 1);
  assert.ok(events.some((e) => e.event === 'task_green'));
  // role file cleaned up afterward
  assert.ok(!fs.existsSync(path.join(root, '.harness-role')));
});

test('role file is set per step: test-writer then builder', async () => {
  const rolesSeen = [];
  const executor = async ({ role }) => {
    rolesSeen.push([role, fs.readFileSync(path.join(root, '.harness-role'), 'utf8')]);
    return {};
  };
  const loop = makeLoop({
    executor,
    gates: { red: scriptedGate([PASS]), green: scriptedGate([PASS]), ci: scriptedGate([PASS]) },
  });
  await loop.runBuildTask({ name: 'demo' });
  assert.deepEqual(rolesSeen, [
    ['test-writer', 'test-writer'],
    ['builder', 'builder'],
  ]);
});

test('builder GREEN failure retries the builder without rewriting tests', async () => {
  const feedbackSeen = [];
  const executor = async ({ step, feedback }) => {
    feedbackSeen.push([step, feedback]);
    return {};
  };
  const loop = makeLoop({
    executor,
    gates: { red: scriptedGate([PASS]), green: scriptedGate([FAIL, PASS]), ci: scriptedGate([PASS]) },
  });
  const res = await loop.runBuildTask({ name: 'demo' });
  assert.equal(res.status, 'green');
  assert.equal(res.iterations, 2);
  assert.deepEqual(
    feedbackSeen.map(([step]) => step),
    ['write-failing-test', 'implement', 'implement'],
  );
  assert.deepEqual(feedbackSeen[2][1], [{ gate: 'green', detail: 'boom' }]);
});

test('builder CI failure retries the builder without rewriting tests', async () => {
  const stepsSeen = [];
  const executor = async ({ step, feedback }) => {
    stepsSeen.push([step, feedback]);
    return {};
  };
  const loop = makeLoop({
    executor,
    gates: { red: scriptedGate([PASS]), green: scriptedGate([PASS]), ci: scriptedGate([FAIL, PASS]) },
  });
  const res = await loop.runBuildTask({ name: 'demo' });
  assert.equal(res.status, 'green');
  assert.deepEqual(
    stepsSeen.map(([step]) => step),
    ['write-failing-test', 'implement', 'implement'],
  );
  assert.deepEqual(stepsSeen[2][1], [{ gate: 'ci', detail: 'boom' }]);
});

test('persisted builder retry ownership survives resume', async () => {
  const first = makeLoop({
    gates: { red: scriptedGate([PASS]), green: scriptedGate([FAIL]), ci: scriptedGate([PASS]) },
    caps: { consecutiveGateReds: 1, totalIterations: 5 },
  });
  const escalated = await first.runBuildTask({ name: 'demo' });
  assert.equal(escalated.status, 'escalated');

  const stepsSeen = [];
  const resumed = makeLoop({
    executor: async ({ step }) => {
      stepsSeen.push(step);
      return {};
    },
    gates: { red: scriptedGate([PASS]), green: scriptedGate([PASS]), ci: scriptedGate([PASS]) },
  });
  const res = await resumed.runBuildTask({ name: 'demo' });
  assert.equal(res.status, 'green');
  assert.deepEqual(stepsSeen, ['implement']);
});

test('3 consecutive reds on one gate escalates with handoff note', async () => {
  const loop = makeLoop({
    gates: { red: scriptedGate([FAIL]), green: scriptedGate([PASS]), ci: scriptedGate([PASS]) },
  });
  const res = await loop.runBuildTask({ name: 'demo' });
  assert.equal(res.status, 'escalated');
  assert.match(res.reason, /3 consecutive reds on gate 'red'/);
  const note = fs.readFileSync(path.join(root, 'memory', 'handoffs', 'T-1.md'), 'utf8');
  assert.match(note, /Blocking gate/);
  assert.match(note, /red/);
  assert.ok(events.some((e) => e.event === 'escalated' && e.result === 'escalated'));
});

test('total-iteration cap escalates even when gates alternate', async () => {
  const gates = {
    red: scriptedGate([PASS]),
    // Ownership-aware retries alternate between GREEN and CI failures so no
    // individual gate reaches its consecutive-red cap first.
    green: scriptedGate([FAIL, PASS, FAIL, PASS]),
    ci: scriptedGate([FAIL]),
  };
  const loop = makeLoop({ gates, caps: { consecutiveGateReds: 3, totalIterations: 4 } });
  const res = await loop.runBuildTask({ name: 'demo' });
  assert.equal(res.status, 'escalated');
  assert.match(res.reason, /iteration cap \(4\)/);
});

test('critical gate failure escalates immediately (zero-retry)', async () => {
  const loop = makeLoop({
    gates: {
      red: scriptedGate([PASS]),
      green: scriptedGate([PASS]),
      ci: scriptedGate([{ pass: false, severity: 'critical', detail: 'secret leaked' }]),
    },
  });
  const res = await loop.runBuildTask({ name: 'demo' });
  assert.equal(res.status, 'escalated');
  assert.match(res.reason, /critical failure in gate 'ci'/);
  assert.equal(res.iterations, 1);
});

test('state is persisted and resumable after escalation', async () => {
  const loop = makeLoop({
    gates: { red: scriptedGate([FAIL]), green: scriptedGate([PASS]), ci: scriptedGate([PASS]) },
  });
  await loop.runBuildTask({ name: 'demo' });
  const state = JSON.parse(fs.readFileSync(path.join(root, 'memory', 'loop-state', 'T-1.json'), 'utf8'));
  assert.equal(state.status, 'escalated');
  assert.equal(state.history.length, 3);
  // a fresh loop over the same root resumes from saved state (iteration count carries)
  const resumed = makeLoop({
    gates: { red: scriptedGate([PASS]), green: scriptedGate([PASS]), ci: scriptedGate([PASS]) },
  });
  const res = await resumed.runBuildTask({ name: 'demo' });
  assert.equal(res.status, 'green');
  assert.equal(res.iterations, 4, 'resumes at iteration 3+1, not 1');
});

test('mutation red routes next iteration into strengthen mode: no red re-verification', async () => {
  const stepsSeen = [];
  const executor = async ({ step, feedback }) => {
    stepsSeen.push([step, feedback]);
    return {};
  };
  let redCalls = 0;
  const loop = makeLoop({
    executor,
    gates: {
      red: async () => {
        redCalls++;
        return PASS;
      },
      green: scriptedGate([PASS]),
      ci: scriptedGate([PASS]),
      mutation: scriptedGate([{ pass: false, detail: 'src/cost.mjs:14 ArithmeticOperator → "/"' }, PASS]),
    },
  });
  const res = await loop.runBuildTask({ name: 'demo' });
  assert.equal(res.status, 'green');
  assert.equal(res.iterations, 2);
  assert.equal(redCalls, 1, 'red must not re-run for a strengthening test');
  assert.deepEqual(
    stepsSeen.map(([s]) => s),
    ['write-failing-test', 'implement', 'strengthen-tests'],
  );
  // the survivor detail reaches the strengthen step as gate feedback
  assert.deepEqual(stepsSeen[2][1], [{ gate: 'mutation', detail: 'src/cost.mjs:14 ArithmeticOperator → "/"' }]);
});

test('strengthen mode is sticky: a green red keeps strengthening, never demands a failing test', async () => {
  const stepsSeen = [];
  const executor = async ({ step }) => {
    stepsSeen.push(step);
    return {};
  };
  const loop = makeLoop({
    executor,
    gates: {
      red: scriptedGate([PASS]),
      // iter 1 pass; iter 2 the strengthening test breaks the suite; iter 3 fixed
      green: scriptedGate([PASS, FAIL, PASS]),
      ci: scriptedGate([PASS]),
      mutation: scriptedGate([FAIL, PASS]),
    },
  });
  const res = await loop.runBuildTask({ name: 'demo' });
  assert.equal(res.status, 'green');
  assert.equal(res.iterations, 3);
  assert.deepEqual(stepsSeen, ['write-failing-test', 'implement', 'strengthen-tests', 'strengthen-tests']);
});

test('3 consecutive mutation reds escalate like any other gate', async () => {
  const loop = makeLoop({
    gates: {
      red: scriptedGate([PASS]),
      green: scriptedGate([PASS]),
      ci: scriptedGate([PASS]),
      mutation: scriptedGate([FAIL]),
    },
  });
  const res = await loop.runBuildTask({ name: 'demo' });
  assert.equal(res.status, 'escalated');
  assert.match(res.reason, /3 consecutive reds on gate 'mutation'/);
});

test('DEFAULT_CAPS match D-11', () => {
  assert.deepEqual(DEFAULT_CAPS, { consecutiveGateReds: 3, totalIterations: 5 });
});

test('step_complete events carry executor telemetry (tokens, cost, model)', async () => {
  const executor = async ({ role }) => ({
    summary: 'ok',
    model: `model-for-${role}`,
    tokens_in: 100,
    tokens_out: 20,
    cost_usd: 0.01,
    duration_ms: 5000,
    num_turns: 3,
  });
  const loop = makeLoop({
    executor,
    gates: { red: scriptedGate([PASS]), green: scriptedGate([PASS]), ci: scriptedGate([PASS]) },
  });
  await loop.runBuildTask({ name: 'demo' });
  const completes = events.filter((e) => e.event === 'step_complete');
  assert.equal(completes.length, 2);
  assert.equal(completes[0].model, 'model-for-test-writer');
  assert.equal(completes[0].tokens_in, 100);
  assert.equal(completes[0].cost_usd, 0.01);
  assert.equal(completes[1].model, 'model-for-builder');
  assert.equal(completes[1].detail.num_turns, 3);
});
