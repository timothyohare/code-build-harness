import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOOKS = path.resolve(import.meta.dirname, '..', 'harness', 'hooks');

// Each case runs the hook as Claude Code would: JSON on stdin, exit code out.
function runHook(hook, toolName, toolInput, role) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-test-'));
  if (role) fs.writeFileSync(path.join(cwd, '.harness-role'), role);
  const input = JSON.stringify({ tool_name: toolName, tool_input: toolInput, cwd });
  const res = spawnSync('node', [path.join(HOOKS, hook)], {
    input,
    encoding: 'utf8',
    env: { ...process.env, HARNESS_EVENTS_DIR: path.join(cwd, 'events') }, // keep real event log clean
  });
  fs.rmSync(cwd, { recursive: true, force: true });
  return res;
}

// ---- protect-paths.mjs (trust model: architecture.md) ----

test('builder may edit src', () => {
  const r = runHook('protect-paths.mjs', 'Edit', { file_path: '/x/src/app.ts' }, 'builder');
  assert.equal(r.status, 0);
});

test('builder blocked from tests/', () => {
  const r = runHook('protect-paths.mjs', 'Edit', { file_path: '/x/tests/app.test.ts' }, 'builder');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /test-writer/);
});

test('builder blocked from fixtures', () => {
  const r = runHook('protect-paths.mjs', 'Write', { file_path: '/x/fixtures/user.json' }, 'builder');
  assert.equal(r.status, 2);
});

test('test-writer may edit tests', () => {
  const r = runHook('protect-paths.mjs', 'Edit', { file_path: '/x/tests/app.test.ts' }, 'test-writer');
  assert.equal(r.status, 0);
});

test('test-writer blocked from src (scope)', () => {
  const r = runHook('protect-paths.mjs', 'Edit', { file_path: '/x/src/app.ts' }, 'test-writer');
  assert.equal(r.status, 2);
});

test('never-tier blocks all roles from workflows', () => {
  for (const role of ['builder', 'test-writer']) {
    const r = runHook('protect-paths.mjs', 'Write', { file_path: '/x/.github/workflows/ci.yml' }, role);
    assert.equal(r.status, 2, `role ${role} should be blocked`);
  }
});

test('never-tier blocks hook self-modification', () => {
  const r = runHook('protect-paths.mjs', 'Edit', { file_path: '/x/harness/hooks/protect-paths.mjs' }, 'builder');
  assert.equal(r.status, 2);
});

test('ask-first tier blocks package.json for agents', () => {
  const r = runHook('protect-paths.mjs', 'Edit', { file_path: '/x/package.json' }, 'builder');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /human approval/);
});

test('no role file = human interactive session, allowed', () => {
  const r = runHook('protect-paths.mjs', 'Edit', { file_path: '/x/tests/app.test.ts' }, null);
  assert.equal(r.status, 0);
});

// ---- bash-guard.mjs ----

test('destructive rm -rf blocked for agents', () => {
  const r = runHook('bash-guard.mjs', 'Bash', { command: 'rm -rf build && echo done' }, 'builder');
  assert.equal(r.status, 2);
});

test('force push blocked', () => {
  const r = runHook('bash-guard.mjs', 'Bash', { command: 'git push --force origin main' }, 'builder');
  assert.equal(r.status, 2);
});

test('sed -i into workflows blocked (hook bypass attempt)', () => {
  const r = runHook('bash-guard.mjs', 'Bash', { command: 'sed -i "s/a/b/" .github/workflows/ci.yml' }, 'builder');
  assert.equal(r.status, 2);
});

test('builder shell-writing a test file blocked', () => {
  const r = runHook('bash-guard.mjs', 'Bash', { command: 'echo "x" >> tests/app.test.ts' }, 'builder');
  assert.equal(r.status, 2);
});

test('builder reading tests is fine', () => {
  const r = runHook('bash-guard.mjs', 'Bash', { command: 'cat tests/app.test.ts' }, 'builder');
  assert.equal(r.status, 0);
});

test('ordinary command allowed', () => {
  const r = runHook('bash-guard.mjs', 'Bash', { command: 'npm run lint' }, 'builder');
  assert.equal(r.status, 0);
});

test('human role bypasses bash guard', () => {
  const r = runHook('bash-guard.mjs', 'Bash', { command: 'rm -rf build' }, null);
  assert.equal(r.status, 0);
});
// tamper
