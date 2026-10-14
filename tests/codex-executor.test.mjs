import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import {
  buildArgs,
  buildPrompt,
  createCodexExecutor,
  parseResult,
} from '../harness/controller/executors/codex-cli.mjs';

const TASK = { name: 'demo', description: 'a demo task', acceptance: 'exit 0' };

test('test-writer prompt owns tests and excludes implementation', () => {
  const prompt = buildPrompt({ role: 'test-writer', step: 'write-failing-test', task: TASK, feedback: [] });
  assert.match(prompt, /Write only tests/);
  assert.match(prompt, /must fail for the right reason/);
  assert.match(prompt, /Do not modify implementation/);
});

test('reviewer prompt requires evidence-backed JSON', () => {
  const prompt = buildPrompt({ role: 'reviewer', step: 'review', task: { name: 'review', package: '# Evidence' } });
  assert.match(prompt, /Return only JSON/);
  assert.match(prompt, /evidence/);
  assert.match(prompt, /# Evidence/);
});

test('args are ephemeral and sandbox roles independently', () => {
  const writer = buildArgs({ role: 'test-writer', prompt: 'x', cwd: '/repo' });
  assert.equal(writer[0], 'exec');
  assert.equal(writer.at(-1), 'x');
  assert.ok(writer.includes('--ephemeral'));
  assert.equal(writer[writer.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(writer[writer.indexOf('--cd') + 1], '/repo');

  const reviewer = buildArgs({ role: 'reviewer', prompt: 'x', cwd: '/repo', outputSchema: '/schema.json' });
  assert.equal(reviewer[reviewer.indexOf('--sandbox') + 1], 'read-only');
  assert.equal(reviewer[reviewer.indexOf('--output-schema') + 1], '/schema.json');
});

test('test-writer prompt requests structured full-file proposals without direct edits', () => {
  const prompt = buildPrompt({ role: 'test-writer', step: 'write-failing-test', task: TASK, feedback: [] });
  assert.match(prompt, /Return only JSON/);
  assert.match(prompt, /complete new file content/);
  assert.match(prompt, /Do not edit files directly/);
});

test('parses Codex JSONL agent message and usage', () => {
  const out = [
    JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '{"context_sufficient":true}' } }),
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 120, output_tokens: 30 } }),
  ].join('\n');
  assert.deepEqual(parseResult(out), {
    summary: '{"context_sufficient":true}',
    model: null,
    tokens_in: 120,
    tokens_out: 30,
  });
});

test('executor rejects non-zero exits', async () => {
  const spawnFn = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    setImmediate(() => {
      child.stderr.emit('data', 'failure');
      child.emit('close', 1);
    });
    return child;
  };
  const execute = createCodexExecutor({
    cwd: '/repo',
    outputSchemas: { 'test-writer': '/test-change.schema.json' },
    spawnFn,
  });
  await assert.rejects(
    () => execute({ role: 'test-writer', step: 'write-failing-test', task: TASK }),
    /codex exited 1/,
  );
});

test('test-writer output is validated and applied by the harness', async () => {
  const proposal = JSON.stringify({
    summary: 'added test',
    changes: [{ path: 'tests/value.test.mjs', content: 'test content' }],
  });
  const spawnFn = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    setImmediate(() => {
      child.stdout.emit(
        'data',
        `${JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: proposal } })}\n`,
      );
      child.emit('close', 0);
    });
    return child;
  };
  const applied = [];
  const execute = createCodexExecutor({
    cwd: '/repo',
    outputSchemas: { 'test-writer': '/test-change.schema.json' },
    applyTestChangesFn: (request) => {
      applied.push(request);
      return { summary: 'added test', paths: ['tests/value.test.mjs'] };
    },
    spawnFn,
  });
  const result = await execute({ role: 'test-writer', step: 'write-failing-test', task: TASK });
  assert.equal(applied[0].root, '/repo');
  assert.equal(applied[0].output, proposal);
  assert.deepEqual(result.changed_paths, ['tests/value.test.mjs']);
});
