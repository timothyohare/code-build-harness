#!/usr/bin/env node
// Fast quality gate (D-25 port of ~/.claude/bin/gate-ci.mjs + event telemetry).
// Runs the project's lint + typecheck + test (and build with --full). Wired as
// a Stop hook so nothing completes red: a failure exits 2, which feeds stderr
// back to the agent to fix before stopping.
//
//   ci.mjs            # lint + typecheck + test (the fast tier)
//   ci.mjs --full     # also run build
//   ci.mjs --force    # run even when no source files changed
import { execSync } from 'node:child_process';
import { emit } from '../controller/emit-event.mjs';
import { loadConfig } from './resolve.mjs';

const FULL = process.argv.includes('--full');
const FORCE = process.argv.includes('--force');

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  try {
    for await (const c of process.stdin) chunks.push(c);
  } catch {}
  return Buffer.concat(chunks).toString('utf8');
}

// Cheap guard so the Stop hook is near-free when there's nothing to check.
function sourceChanged(root) {
  try {
    const out = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' });
    return out.split('\n').some((l) => /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java)$/.test(l.trim()));
  } catch {
    return true; // not a git repo: don't suppress on the guard
  }
}

const input = JSON.parse((await readStdin()) || '{}');
// Loop guard: if we're already continuing from a Stop hook, let it stop.
if (input.stop_hook_active) process.exit(0);

const { root, config } = loadConfig();
if (!FORCE && !sourceChanged(root)) process.exit(0);

const steps = ['lint', 'typecheck', 'test'];
if (FULL) steps.push('build');

const started = Date.now();
const ran = [];
const failures = [];
for (const key of steps) {
  const cmd = config[key];
  if (!cmd) continue;
  ran.push(key);
  process.stderr.write(`\n▶ gate-ci: ${key} → ${cmd}\n`);
  try {
    execSync(cmd, { cwd: root, stdio: 'inherit' });
  } catch {
    failures.push(key);
  }
}

// Telemetry is best-effort: a metrics write failure must never flip the verdict.
try {
  emit({
    event: 'validate.gate_run',
    phase: 'validate',
    result: failures.length ? 'fail' : 'pass',
    duration_ms: Date.now() - started,
    detail: { gate: 'ci', full: FULL, root, steps: ran, failures },
  });
} catch {}

if (failures.length) {
  process.stderr.write(`\n✗ gate-ci failed: ${failures.join(', ')}. Fix before completing.\n`);
  process.exit(2); // blocking: stderr is surfaced back to the agent
}
process.exit(0);
