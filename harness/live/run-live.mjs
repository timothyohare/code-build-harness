#!/usr/bin/env node
import { execSync } from 'node:child_process';
// First supervised live loop run (M1 milestone). Drives the two-agent TDD cycle
// with real `claude -p` sub-agents and real gates against this repo.
// Watch progress: tail -f metrics/events/$(date +%Y-%m).jsonl
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClaudeExecutor } from '../controller/executors/claude-cli.mjs';
import { createLoop } from '../controller/loop.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function sh(cmd) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout: 120_000 });
    return { pass: true };
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.toString();
    return { pass: false, detail: out.slice(-500) };
  }
}

const gates = {
  // RED passes only when the suite FAILS (the new test must fail for the right reason).
  red: async () => {
    const r = sh('npm test');
    return r.pass
      ? {
          pass: false,
          detail: 'expected the new test to FAIL, but the whole suite is green — the test does not test anything new',
        }
      : { pass: true, detail: 'suite red as expected' };
  },
  green: async () => sh('npm test'),
  ci: async () => sh('npm run lint && npm test'),
};

const task = {
  name: 'token-cost-calculator',
  description: [
    'Create src/cost.mjs exporting a pure function costUsd(usage, pricing).',
    'usage: { model, tokens_in, tokens_out } (token counts may be null/undefined → treat as 0).',
    'pricing: map of model id → { in: USD per million input tokens, out: USD per million output tokens }.',
    'Returns the cost in USD as a number, or null when usage.model is absent from pricing.',
    'No hardcoded prices anywhere — pricing always comes from the caller.',
  ].join(' '),
  acceptance: [
    'costUsd({model:"m1",tokens_in:1_000_000,tokens_out:0}, {m1:{in:5,out:25}}) === 5',
    'costUsd({model:"m1",tokens_in:500_000,tokens_out:200_000}, {m1:{in:5,out:25}}) === 7.5',
    'costUsd({model:"unknown",tokens_in:10,tokens_out:10}, {m1:{in:5,out:25}}) === null',
    'costUsd({model:"m1"}, {m1:{in:5,out:25}}) === 0 (missing token counts treated as 0)',
    'Test file lives at tests/cost.test.mjs using node:test.',
  ].join('\n'),
};

const taskId = process.env.HARNESS_TASK_ID || 'CHG-0007';
const loop = createLoop({
  taskId,
  root: ROOT,
  executor: createClaudeExecutor({ cwd: ROOT, timeoutMs: 10 * 60 * 1000 }),
  gates,
  caps: { consecutiveGateReds: 2, totalIterations: 3 }, // tightened for the first live run
});

console.log(`[live] starting loop for ${taskId}: ${task.name}`);
const res = await loop.runBuildTask(task);
console.log('[live] result:', JSON.stringify(res, null, 2));
process.exit(res.status === 'green' ? 0 : 1);
