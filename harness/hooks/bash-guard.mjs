#!/usr/bin/env node
// PreToolUse hook for Bash: deny destructive commands and shell-level writes to
// protected paths (the `sed -i` bypass called out in docs/harness/phases/03-build.md).
// Exit 2 = block. Exit 0 = allow. Deliberately conservative: false positives are
// cheap (the agent rephrases); false negatives are what the server-side layer catches.
import fs from 'node:fs';
import path from 'node:path';
import { emit } from '../controller/emit-event.mjs';

const DESTRUCTIVE = [
  /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)[a-z]*\b/, // rm -rf variants
  /\bgit\s+push\s+.*(--force|-f)\b/,
  /\bgit\s+reset\s+--hard\b.*(origin|@\{u\})/,
  /\bgit\s+clean\s+-[a-z]*f/,
  /\bgh\s+(repo\s+delete|api\s+.*-X\s+DELETE)/,
];

// Shell writes aimed at protected paths (redirection, in-place edit, move/copy onto).
const PROTECTED_TARGET = /(\.github\/|CODEOWNERS|\.claude\/settings|harness\/(hooks|controller)\/|\.harness-role)/;

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const input = JSON.parse(Buffer.concat(chunks).toString() || '{}');
if (input.tool_name !== 'Bash') process.exit(0);
const cmd = input.tool_input?.command || '';

let role = 'human';
try { role = fs.readFileSync(path.join(input.cwd, '.harness-role'), 'utf8').trim(); } catch {}
if (role === 'human') process.exit(0);

function block(rule) {
  emit({ phase: 'build', event: 'guardrail_block', agent_role: role, result: 'blocked',
    detail: { rule, command: cmd.slice(0, 200), tool: 'Bash' } });
  console.error(`BLOCKED (${rule}): this command is not permitted for role '${role}'. If genuinely required, write the request to memory/escalations.md and halt.`);
  process.exit(2);
}

if (DESTRUCTIVE.some((re) => re.test(cmd))) block('destructive-command');

if (PROTECTED_TARGET.test(cmd)) {
  const writeLike = /(>>?|\btee\b|\bsed\s+-i|\bmv\b|\bcp\b|\bln\b|\bchmod\b|\btruncate\b|\brm\b)/.test(cmd);
  if (writeLike) block('protected-path-shell-write');
}

// Builders must not edit test files via shell either.
if (role !== 'test-writer' && /(\btests?\/|\.(test|spec)\.[jt]sx?|_test\.py)/.test(cmd)) {
  const writeLike = /(>>?|\btee\b|\bsed\s+-i|\bmv\b|\bcp\b|\brm\b|\btruncate\b)/.test(cmd);
  if (writeLike) block('test-ownership-shell-write');
}

process.exit(0);
