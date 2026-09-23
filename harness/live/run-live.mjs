#!/usr/bin/env node
import { execSync } from 'node:child_process';
// Supervised live delivery run. Drives the Claude/Codex TDD and review cycle
// from a validated input file against this repo.
// Watch progress: tail -f metrics/events/$(date +%Y-%m).jsonl
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDeliveryLoop } from '../controller/delivery-loop.mjs';
import { emit } from '../controller/emit-event.mjs';
import { createClaudeExecutor } from '../controller/executors/claude-cli.mjs';
import { createCodexExecutor } from '../controller/executors/codex-cli.mjs';
import { createRoleRouter } from '../controller/executors/router.mjs';
import { createLoop } from '../controller/loop.mjs';
import { createReviewLoop } from '../controller/review-loop.mjs';
import { evaluateSeededDefects } from '../pilot/evaluation.mjs';
import { loadPilotConfig } from '../pilot/input.mjs';
import { createReviewRunner } from '../review/runner.mjs';

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
  // M-parity step 3 (D-25): delegate to the ported gate-ci, which resolves this
  // repo's binding (lint + test here) instead of hardcoding npm commands.
  ci: async () => sh(`node ${path.join(ROOT, 'harness', 'gates', 'ci.mjs')} --force`),
  // M2 survivor feedback: gate-mutation prints survivors on stderr; sh() keeps
  // the tail, so a red's detail carries file:line/mutator into the next
  // strengthen-tests prompt. Unbound repos no-op (exit 0 = pass).
  mutation: async () => sh(`node ${path.join(ROOT, 'harness', 'gates', 'mutation.mjs')}`),
};

const input = process.argv[2];
if (!input) {
  process.stderr.write('usage: node harness/live/run-live.mjs <pilot.json>\n');
  process.exit(1);
}
const config = loadPilotConfig(path.resolve(process.cwd(), input));
const task = config.task;

const taskId = process.env.HARNESS_TASK_ID || task.id;
const claude = createClaudeExecutor({ cwd: ROOT, timeoutMs: 10 * 60 * 1000 });
const codex = createCodexExecutor({
  cwd: ROOT,
  outputSchema: path.join(ROOT, 'harness', 'review', 'review.schema.json'),
  outputSchemas: {
    'test-writer': path.join(ROOT, 'harness', 'controller', 'executors', 'test-changes.schema.json'),
  },
  timeoutMs: 10 * 60 * 1000,
});
const executor = createRoleRouter({ builder: claude, 'test-writer': codex, reviewer: codex });
const buildLoop = createLoop({
  taskId,
  root: ROOT,
  executor,
  gates,
  caps: { consecutiveGateReds: 2, totalIterations: 3 }, // tightened for the first live run
});

function gitText(command) {
  return execSync(command, { cwd: ROOT, encoding: 'utf8', timeout: 30_000 });
}

function untrackedEvidence(prefixes = []) {
  const excluded = ['memory/', 'metrics/events/', 'node_modules/', 'reports/'];
  const files = gitText('git ls-files --others --exclude-standard')
    .split('\n')
    .filter(Boolean)
    .filter((file) => !excluded.some((prefix) => file.startsWith(prefix)))
    .filter((file) => prefixes.length === 0 || prefixes.some((prefix) => file.startsWith(prefix)));
  return files
    .map((file) => {
      const candidate = path.resolve(ROOT, file);
      if (!candidate.startsWith(`${ROOT}${path.sep}`) || !fs.lstatSync(candidate).isFile()) return '';
      return `### Untracked: ${file}\n\n${fs.readFileSync(candidate, 'utf8')}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

const review = createReviewRunner({ executor });
const reviewLoop = createReviewLoop({
  taskId,
  root: ROOT,
  reviewer: review,
  evidenceProvider: async () => ({
    spec: task.acceptance,
    plan: task.plan ?? 'TDD build, deterministic validation, independent review, and owner-routed correction.',
    diff: [
      gitText("git diff --no-ext-diff -- . ':(exclude)memory/**' ':(exclude)metrics/events/**' ':(exclude)reports/**'"),
      untrackedEvidence(),
    ]
      .filter(Boolean)
      .join('\n\n'),
    tests: [gitText('git diff --no-ext-diff -- tests fixtures'), untrackedEvidence(['tests/', 'fixtures/'])]
      .filter(Boolean)
      .join('\n\n'),
    gates: 'The controller observed RED, GREEN, CI, and mutation gates passing before review.',
  }),
  correctors: {
    builder: async ({ findings }) =>
      executor({
        role: 'builder',
        step: 'address-review',
        task,
        feedback: findings.map((finding) => ({ gate: `review:${finding.id}`, detail: finding.evidence })),
      }),
    'test-writer': async ({ findings }) =>
      executor({
        role: 'test-writer',
        step: 'address-review',
        task,
        feedback: findings.map((finding) => ({ gate: `review:${finding.id}`, detail: finding.evidence })),
      }),
  },
  gates,
});

console.log(`[live] starting supervised delivery for ${taskId}: ${task.name}`);
const result = await createDeliveryLoop({ buildLoop, reviewLoop }).run(task);
const reviewState = reviewLoop._internals.loadState();
const evaluation = evaluateSeededDefects(config.seededDefects, reviewState?.observedFindings);
if (evaluation.seeded > 0) {
  emit({
    task_id: taskId,
    phase: 'review',
    event: 'seeded_defect_evaluation',
    agent_role: 'controller',
    result: evaluation.missed.length === 0 ? 'pass' : 'fail',
    detail: evaluation,
  });
}
const status = result.status === 'approved' && evaluation.missed.length > 0 ? 'evaluation-failed' : result.status;
console.log('[live] result:', JSON.stringify({ ...result, status, evaluation }, null, 2));
process.exit(status === 'approved' ? 0 : 1);
