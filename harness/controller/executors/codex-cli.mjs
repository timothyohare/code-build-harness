import { spawn } from 'node:child_process';
import { applyTestChanges } from './test-changes.mjs';

export function buildPrompt({ role, step, task, feedback = [] }) {
  if (role === 'reviewer') {
    return [
      'Act as an independent code reviewer. Review only the supplied evidence against the specification.',
      'Return only JSON matching the configured schema. Every finding needs concrete evidence; do not infer missing code.',
      '',
      task.package,
    ].join('\n');
  }

  const lines = [
    `You are the '${role}' in a guarded TDD loop. Step: ${step}. Task: ${task.name}.`,
    task.description ? `Description: ${task.description}` : null,
    task.acceptance ? `Acceptance criteria: ${task.acceptance}` : null,
  ].filter(Boolean);
  if (feedback.length) {
    lines.push('', 'Address this deterministic gate feedback:');
    for (const item of feedback) lines.push(`- ${item.gate}: ${item.detail ?? 'failed'}`);
  }
  if (step === 'strengthen-tests') {
    lines.push(
      '',
      'Write only tests or test assertions that kill the reported surviving mutants. The suite must pass on the current implementation. Do not modify implementation or gate configuration.',
    );
  } else {
    lines.push(
      '',
      'Write only tests for the acceptance criteria. Do not modify implementation. The new test must fail for the right reason before implementation begins.',
    );
  }
  lines.push(
    '',
    'Do not edit files directly. Return only JSON with a summary and changes array. Each change must contain a repository-relative test-owned path and the complete new file content.',
  );
  return lines.join('\n');
}

export function buildArgs({ prompt, cwd, outputSchema }) {
  const args = ['exec', '--ephemeral', '--ignore-user-config', '--json', '--sandbox', 'read-only', '--cd', cwd];
  if (outputSchema) args.push('--output-schema', outputSchema);
  args.push(prompt);
  return args;
}

export function parseResult(output) {
  let summary = '';
  let usage = {};
  for (const line of output.split('\n').filter(Boolean)) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === 'item.completed' && event.item?.type === 'agent_message') summary = event.item.text ?? '';
    if (event.type === 'turn.completed') usage = event.usage ?? {};
  }
  if (!summary) throw new Error('codex returned no final agent message');
  return {
    summary,
    model: null,
    tokens_in: usage.input_tokens ?? null,
    tokens_out: usage.output_tokens ?? null,
  };
}

export function createCodexExecutor({
  cwd,
  outputSchema,
  outputSchemas = {},
  applyTestChangesFn = applyTestChanges,
  spawnFn = spawn,
  timeoutMs = 15 * 60 * 1000,
} = {}) {
  return async function execute({ role, step, task, feedback }) {
    const prompt = buildPrompt({ role, step, task, feedback });
    const roleSchema = outputSchemas[role] ?? (role === 'reviewer' ? outputSchema : undefined);
    if (role === 'test-writer' && !roleSchema) throw new Error('test-writer requires a structured output schema');
    const args = buildArgs({ role, prompt, cwd, outputSchema: roleSchema });
    return await new Promise((resolve, reject) => {
      const child = spawnFn('codex', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`codex executor timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      child.stdout.on('data', (data) => (out += data));
      child.stderr.on('data', (data) => (err += data));
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(`codex exited ${code}: ${err.slice(0, 500)}`));
        try {
          const result = parseResult(out);
          if (role === 'test-writer') {
            const applied = applyTestChangesFn({ root: cwd, output: result.summary });
            result.summary = applied.summary;
            result.changed_paths = applied.paths;
          }
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  };
}
