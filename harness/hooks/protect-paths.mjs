#!/usr/bin/env node
// PreToolUse hook: enforce the trust model (docs/harness/architecture.md).
// Blocks Edit/Write/MultiEdit/NotebookEdit to protected paths by role.
// Exit 2 = block (stderr fed back to the agent). Exit 0 = allow.
//
// Roles come from .harness-role (written by the loop controller, itself a
// protected path). Local hooks are UX; the server-side ruleset is the law.
import fs from 'node:fs';
import path from 'node:path';
import { emit } from '../controller/emit-event.mjs';

// Paths no agent role may touch (never-do tier) — human only.
const NEVER = [
  /(^|\/)\.github\//,
  /(^|\/)CODEOWNERS$/,
  /(^|\/)\.claude\/settings.*\.json$/,
  /(^|\/)harness\/hooks\//,
  /(^|\/)harness\/controller\//,
  /(^|\/)\.harness-role$/,
];

// Paths owned by the test-writer role (D-4, Q10).
const TEST_OWNED = [
  /(^|\/)tests?\//,
  /(^|\/)__tests__\//,
  /(^|\/)fixtures?\//,
  /\.(test|spec)\.[jt]sx?$/,
  /_test\.py$/,
];

// Shared config: ask-first tier — no agent role edits it autonomously (Q10).
const ASK_FIRST = [
  /(^|\/)tsconfig(\..*)?\.json$/,
  /(^|\/)vitest\.config\.[jt]s$/,
  /(^|\/)stryker\.config\.(json|mjs)$/,
  /(^|\/)package\.json$/,
];

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const input = JSON.parse(Buffer.concat(chunks).toString() || '{}');

const tool = input.tool_name || '';
if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) process.exit(0);
const file = input.tool_input?.file_path || input.tool_input?.notebook_path || '';
const rel = path.relative(input.cwd || process.cwd(), file);

let role = 'human';
try {
  role = fs.readFileSync(path.join(input.cwd, '.harness-role'), 'utf8').trim();
} catch {}
if (role === 'human') process.exit(0); // no active loop → normal interactive session

function block(rule, redirect) {
  emit({
    phase: 'build',
    event: 'guardrail_block',
    agent_role: role,
    result: 'blocked',
    detail: { rule, path: rel, tool },
  });
  console.error(`BLOCKED (${rule}): role '${role}' may not modify: ${rel}. ${redirect}`);
  process.exit(2);
}

if (NEVER.some((re) => re.test(rel)))
  block(
    'never-tier',
    'This path is human-only (workflows/harness/hook config). If a change is genuinely needed, write the request and rationale to memory/escalations.md and halt.',
  );

if (role !== 'test-writer' && TEST_OWNED.some((re) => re.test(rel)))
  block(
    'test-ownership',
    'Tests are owned by the test-writer agent; record the needed test change in memory/test-requests.md instead.',
  );

if (
  role === 'test-writer' &&
  !TEST_OWNED.some((re) => re.test(rel)) &&
  !/(^|\/)memory\//.test(rel) &&
  !/(^|\/)openspec\//.test(rel)
)
  block('test-writer-scope', 'The test-writer role only modifies test-owned paths, memory/, and the change bundle.');

if (ASK_FIRST.some((re) => re.test(rel)))
  block(
    'ask-first-tier',
    'Shared config requires human approval. Write the proposed change and rationale to memory/escalations.md and halt.',
  );

process.exit(0);
