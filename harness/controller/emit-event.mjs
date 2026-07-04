#!/usr/bin/env node
// JSONL event emitter — the schema in docs/harness/metrics.md (D-12).
// Usable as a library (import { emit }) or CLI:
//   node emit-event.mjs --phase build --event gate_run --task-id CHG-1 \
//        --agent-role builder --result pass --detail '{"gate":"ci"}'
// Events append to metrics/events/YYYY-MM.jsonl at the repo root.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function emit(fields) {
  const now = new Date();
  const event = {
    ts: now.toISOString(),
    run_id: process.env.HARNESS_RUN_ID || null,
    task_id: fields.task_id ?? process.env.HARNESS_TASK_ID ?? null,
    phase: fields.phase ?? null,
    event: fields.event,
    agent_role: fields.agent_role ?? null,
    model: fields.model ?? null,
    tokens_in: fields.tokens_in ?? null,
    tokens_out: fields.tokens_out ?? null,
    cost_usd: fields.cost_usd ?? null,
    duration_ms: fields.duration_ms ?? null,
    result: fields.result ?? 'n/a',
    detail: fields.detail ?? {},
  };
  const dir = process.env.HARNESS_EVENTS_DIR || path.join(REPO_ROOT, 'metrics', 'events');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${now.toISOString().slice(0, 7)}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(event) + '\n');
  return event;
}

export function newRunId() {
  return randomUUID();
}

// CLI mode
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const fields = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '').replaceAll('-', '_');
    let val = args[i + 1];
    if (key === 'detail') val = JSON.parse(val);
    else if (/^(tokens_in|tokens_out|duration_ms)$/.test(key)) val = parseInt(val, 10);
    else if (key === 'cost_usd') val = parseFloat(val);
    fields[key] = val;
  }
  if (!fields.event) {
    console.error('usage: emit-event.mjs --event <name> [--phase p] [--task-id id] [--agent-role r] [--result pass|fail|blocked|escalated] [--detail json] ...');
    process.exit(1);
  }
  const e = emit(fields);
  console.log(JSON.stringify(e));
}
