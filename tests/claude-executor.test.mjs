import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { buildPrompt, buildArgs, createClaudeExecutor, ROLE_MODELS } from '../harness/controller/executors/claude-cli.mjs';

const TASK = { name: 'demo', description: 'a demo task', acceptance: 'exit 0' };

test('prompt: test-writer told tests-only, builder told no-test-edits', () => {
  const tw = buildPrompt({ role: 'test-writer', step: 'write-failing-test', task: TASK, feedback: [] });
  assert.match(tw, /Do not write implementation code/);
  const b = buildPrompt({ role: 'builder', step: 'implement', task: TASK, feedback: [] });
  assert.match(b, /Do not modify tests/);
  assert.match(b, /memory\/test-requests\.md/);
});

test('prompt: gate feedback is included on retries', () => {
  const p = buildPrompt({ role: 'builder', step: 'implement', task: TASK, feedback: [{ gate: 'green', detail: '2 tests failing' }] });
  assert.match(p, /gate 'green': 2 tests failing/);
});

test('args: model routing per role (D-14), headless flags present', () => {
  const args = buildArgs({ role: 'test-writer', prompt: 'x', cwd: '/repo' });
  assert.equal(args[args.indexOf('--model') + 1], ROLE_MODELS['test-writer']);
  for (const flag of ['-p', '--permission-mode', '--output-format', '--max-turns']) {
    assert.ok(args.includes(flag), `missing ${flag}`);
  }
});

test('executor: parses JSON result, rejects on non-zero exit', async () => {
  function fakeSpawn(ok) {
    return () => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => {};
      setImmediate(() => {
        if (ok) child.stdout.emit('data', JSON.stringify({ result: 'did the thing' }));
        else child.stderr.emit('data', 'kaboom');
        child.emit('close', ok ? 0 : 1);
      });
      return child;
    };
  }
  const good = createClaudeExecutor({ cwd: '/repo', spawnFn: fakeSpawn(true) });
  const res = await good({ role: 'builder', step: 'implement', task: TASK, feedback: [] });
  assert.equal(res.summary, 'did the thing');

  const bad = createClaudeExecutor({ cwd: '/repo', spawnFn: fakeSpawn(false) });
  await assert.rejects(() => bad({ role: 'builder', step: 'implement', task: TASK, feedback: [] }), /claude exited 1: kaboom/);
});
