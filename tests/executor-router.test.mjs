import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRoleRouter } from '../harness/controller/executors/router.mjs';

test('routes builder to Claude and test/review roles to Codex', async () => {
  const calls = [];
  const router = createRoleRouter({
    builder: async (request) => {
      calls.push(['claude', request.role]);
      return { summary: 'built' };
    },
    'test-writer': async (request) => {
      calls.push(['codex', request.role]);
      return { summary: 'tested' };
    },
    reviewer: async (request) => {
      calls.push(['codex', request.role]);
      return { summary: 'reviewed' };
    },
  });

  await router({ role: 'test-writer' });
  await router({ role: 'builder' });
  await router({ role: 'reviewer' });
  assert.deepEqual(calls, [
    ['codex', 'test-writer'],
    ['claude', 'builder'],
    ['codex', 'reviewer'],
  ]);
});

test('rejects an unmapped role', async () => {
  const router = createRoleRouter({ builder: async () => ({}) });
  await assert.rejects(() => router({ role: 'judge' }), /no executor configured for role 'judge'/);
});
