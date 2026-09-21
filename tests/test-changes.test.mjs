import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { applyTestChanges, parseTestChanges } from '../harness/controller/executors/test-changes.mjs';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-changes-'));
  roots.push(root);
  return root;
}

test('applies schema-validated test and fixture files', () => {
  const root = makeRoot();
  const output = JSON.stringify({
    summary: 'Added boundary coverage',
    changes: [
      { path: 'tests/value.test.mjs', content: "import { test } from 'node:test';\n" },
      { path: 'fixtures/value.json', content: '{"value":1}\n' },
    ],
  });
  const result = applyTestChanges({ root, output });
  assert.deepEqual(result.paths, ['tests/value.test.mjs', 'fixtures/value.json']);
  assert.equal(fs.readFileSync(path.join(root, 'tests/value.test.mjs'), 'utf8'), "import { test } from 'node:test';\n");
});

test('rejects implementation and configuration targets before writing', () => {
  const root = makeRoot();
  for (const target of ['src/app.mjs', 'package.json', '.github/workflows/ci.yml']) {
    const output = JSON.stringify({ summary: 'bad target', changes: [{ path: target, content: 'x' }] });
    assert.throws(() => applyTestChanges({ root, output }), /is not test-writer owned/);
    assert.equal(fs.existsSync(path.join(root, target)), false);
  }
});

test('rejects absolute paths and traversal', () => {
  const root = makeRoot();
  for (const target of ['/tmp/escape.test.mjs', '../escape.test.mjs', 'tests/../../escape.test.mjs']) {
    const output = JSON.stringify({ summary: 'escape', changes: [{ path: target, content: 'x' }] });
    assert.throws(() => applyTestChanges({ root, output }), /safe relative path/);
  }
});

test('rejects a symlinked test directory that escapes the repository', () => {
  const root = makeRoot();
  const outside = makeRoot();
  fs.symlinkSync(outside, path.join(root, 'tests'));
  const output = JSON.stringify({ summary: 'escape', changes: [{ path: 'tests/escape.test.mjs', content: 'x' }] });
  assert.throws(() => applyTestChanges({ root, output }), /escapes repository root/);
  assert.equal(fs.existsSync(path.join(outside, 'escape.test.mjs')), false);
});

test('rejects a symlinked test path that resolves to implementation inside the repository', () => {
  const root = makeRoot();
  fs.mkdirSync(path.join(root, 'src'));
  fs.symlinkSync(path.join(root, 'src'), path.join(root, 'tests'));
  const output = JSON.stringify({ summary: 'escape', changes: [{ path: 'tests/app.mjs', content: 'x' }] });
  assert.throws(() => applyTestChanges({ root, output }), /resolves outside test-writer owned paths/);
  assert.equal(fs.existsSync(path.join(root, 'src/app.mjs')), false);
});

test('rejects malformed, duplicate, empty, or oversized proposals', () => {
  assert.throws(() => parseTestChanges('not json'), /not valid JSON/);
  assert.throws(() => parseTestChanges('{"summary":"x","changes":[]}'), /at least one change/);
  assert.throws(
    () =>
      parseTestChanges(JSON.stringify({ summary: 'x', changes: [{ path: 'tests/a.test.mjs', content: '12345' }] }), {
        maxBytes: 4,
      }),
    /exceeds 4-byte limit/,
  );
  assert.throws(
    () =>
      parseTestChanges(
        JSON.stringify({
          summary: 'x',
          changes: [
            { path: 'tests/a.test.mjs', content: 'a' },
            { path: 'tests/a.test.mjs', content: 'b' },
          ],
        }),
      ),
    /duplicate path/,
  );
});
