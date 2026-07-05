#!/usr/bin/env node
// Executor that drives Claude Code headless (`claude -p`) for one loop step.
// Contract: async ({ role, step, task, feedback }) => ({ summary })
//
// Design notes (docs/harness/phases/03-build.md):
// - Fresh context per step: each invocation is a new `claude -p` process; durable
//   state lives in the filesystem (bundle, memory files), not the conversation.
// - The role's path permissions are enforced by the PreToolUse hooks via
//   .harness-role (the loop controller writes it before calling us) — the prompt
//   states the role for clarity, but hooks are the enforcement.
// - Model routing (D-14) via per-role model map.
// - NOT yet exercised against a live agent; the arg contract is unit-tested and
//   the first live run is a supervised M1 milestone task.
import { spawn } from 'node:child_process';

export const ROLE_MODELS = {
  'test-writer': 'claude-sonnet-5',
  builder: 'claude-opus-4-8',
};

export function buildPrompt({ role, step, task, feedback }) {
  const lines = [
    `You are operating as the '${role}' agent in the build harness loop (see CLAUDE.md).`,
    `Step: ${step}. Task: ${task.name}.`,
    task.description ? `Description: ${task.description}` : null,
    task.acceptance ? `Acceptance criteria: ${task.acceptance}` : null,
  ];
  if (feedback?.length) {
    lines.push('', 'Previous attempt failed these gates — address them:');
    for (const f of feedback) lines.push(`- gate '${f.gate}': ${f.detail ?? 'failed'}`);
  }
  if (role === 'test-writer') {
    lines.push(
      '',
      'Write the failing test(s) for the acceptance criteria only. Do not write implementation code. The test must fail for the right reason.',
    );
  } else {
    lines.push(
      '',
      'Implement the minimum change to make the failing test pass. Do not modify tests; if a test looks wrong, write your case to memory/test-requests.md and stop.',
    );
  }
  return lines.filter((l) => l !== null).join('\n');
}

export function buildArgs({ role, prompt, cwd }) {
  return [
    '-p',
    prompt,
    '--model',
    ROLE_MODELS[role] ?? ROLE_MODELS.builder,
    '--permission-mode',
    'acceptEdits',
    '--output-format',
    'json',
    '--max-turns',
    '25',
    '--add-dir',
    cwd,
  ];
}

// Extract summary + usage/cost telemetry from `claude -p --output-format json`.
// The CLI reports total_cost_usd and usage itself — authoritative, nothing hardcoded.
export function parseResult(out, role) {
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch {
    return { summary: out, model: ROLE_MODELS[role] ?? null };
  }
  return {
    summary: parsed.result ?? out,
    model: ROLE_MODELS[role] ?? null,
    // input_tokens alone understates volume when caching dominates (live-verified:
    // a call with tokens_in=2 cost $0.12 via cache creation) — count cache tokens in.
    tokens_in:
      (parsed.usage?.input_tokens ?? 0) +
        (parsed.usage?.cache_creation_input_tokens ?? 0) +
        (parsed.usage?.cache_read_input_tokens ?? 0) || null,
    tokens_out: parsed.usage?.output_tokens ?? null,
    cost_usd: parsed.total_cost_usd ?? null,
    duration_ms: parsed.duration_ms ?? null,
    num_turns: parsed.num_turns ?? null,
  };
}

export function createClaudeExecutor({ cwd, spawnFn = spawn, timeoutMs = 15 * 60 * 1000 } = {}) {
  return async function execute({ role, step, task, feedback }) {
    const prompt = buildPrompt({ role, step, task, feedback });
    const args = buildArgs({ role, prompt, cwd });
    return await new Promise((resolve, reject) => {
      const child = spawnFn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '',
        err = '';
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`executor timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(`claude exited ${code}: ${err.slice(0, 500)}`));
        resolve(parseResult(out, role));
      });
      child.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  };
}
