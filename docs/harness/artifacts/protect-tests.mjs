#!/usr/bin/env node
// PreToolUse hook: block Edit/Write/MultiEdit to protected paths unless the
// current role allows it. Role comes from an env file the harness controls.
// Exit 2 = block (stderr is fed back to the agent). Exit 0 = allow.
import fs from 'node:fs';

const PROTECTED = [/(^|\/)tests?\//, /\.(test|spec)\.[jt]sx?$/, /_test\.py$/, /(^|\/)\.github\/workflows\//, /(^|\/)\.claude\/settings.*\.json$/];
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const input = JSON.parse(Buffer.concat(chunks).toString() || '{}');

const tool = input.tool_name || '';
if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) process.exit(0);
const file = input.tool_input?.file_path || '';

let role = 'builder';
try { role = fs.readFileSync(`${input.cwd}/.harness-role`, 'utf8').trim(); } catch {}

if (role !== 'test-writer' && PROTECTED.some((re) => re.test(file))) {
  console.error(`BLOCKED: role '${role}' may not modify protected path: ${file}. Tests are owned by the test-writer agent; record the needed test change in memory/test-requests.md instead.`);
  process.exit(2);
}
process.exit(0);
