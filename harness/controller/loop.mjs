#!/usr/bin/env node
// Loop controller — M1 core (docs/harness/phases/03-build.md, decisions D-4/D-5/D-11/D-15).
//
// Runs one task through the two-agent TDD cycle:
//   test-writer writes failing test → RED verified → builder implements →
//   GREEN verified → gate-ci → commit point.
// Enforces the escalation policy (D-11): 3 consecutive reds on the same gate,
// or `totalIterations` per task → halt, write a handoff note, emit `escalated`.
// Zero-retry escalation when a gate reports { severity: "critical" }.
//
// Dependencies are injected so the controller is testable without agents:
//   executor: async ({ role, step, task, feedback }) => ({ summary })
//   gates:    { red, green, ci } — each async () => ({ pass, detail?, severity? })
//     `red` must PASS when the new test FAILS (verified-RED, not file presence).
//   emit:     event sink (defaults to the JSONL emitter).
import fs from 'node:fs';
import path from 'node:path';
import { emit as defaultEmit } from './emit-event.mjs';

export const DEFAULT_CAPS = { consecutiveGateReds: 3, totalIterations: 5 };

export function createLoop({ taskId, root, executor, gates, caps = DEFAULT_CAPS, emit = defaultEmit }) {
  const rolePath = path.join(root, '.harness-role');
  const statePath = path.join(root, 'memory', 'loop-state', `${taskId}.json`);

  const setRole = (role) => fs.writeFileSync(rolePath, role);
  const clearRole = () => fs.rmSync(rolePath, { force: true });

  const saveState = (state) => {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  };
  const loadState = () => {
    try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { return null; }
  };

  function writeHandoff(state, reason) {
    const dir = path.join(root, 'memory', 'handoffs');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${taskId}.md`);
    const attempts = state.history
      .map((h, i) => `${i + 1}. [iter ${h.iteration}] ${h.step} → gate ${h.gate}: ${h.pass ? 'pass' : 'FAIL'}${h.detail ? ` — ${h.detail}` : ''}`)
      .join('\n');
    fs.writeFileSync(file, [
      `# Handoff: ${taskId}`,
      ``,
      `**Escalated:** ${new Date().toISOString()}`,
      `**Reason:** ${reason}`,
      ``,
      `## What was tried`,
      attempts || '(no iterations recorded)',
      ``,
      `## Blocking gate`,
      state.blockingGate ?? 'n/a',
      ``,
      `## Notes for the human`,
      `State file: memory/loop-state/${taskId}.json — resume with the loop CLI after intervention.`,
    ].join('\n'));
    return file;
  }

  function escalate(state, reason) {
    state.status = 'escalated';
    saveState(state);
    const handoff = writeHandoff(state, reason);
    emit({ task_id: taskId, phase: 'build', event: 'escalated', agent_role: 'controller', result: 'escalated', detail: { reason, handoff, iterations: state.iteration } });
    return { status: 'escalated', reason, handoff, iterations: state.iteration };
  }

  async function runGate(state, name, feedbackSink) {
    const res = await gates[name]();
    state.history.push({ iteration: state.iteration, step: state.lastStep, gate: name, pass: res.pass, detail: res.detail ?? null });
    emit({ task_id: taskId, phase: 'build', event: 'gate_run', agent_role: 'controller', result: res.pass ? 'pass' : 'fail', detail: { gate: name, ...res } });
    if (!res.pass) {
      if (res.severity === 'critical') return { escalation: escalate(state, `critical failure in gate '${name}'`) };
      state.consecutive[name] = (state.consecutive[name] ?? 0) + 1;
      state.blockingGate = name;
      if (state.consecutive[name] >= caps.consecutiveGateReds) {
        return { escalation: escalate(state, `${caps.consecutiveGateReds} consecutive reds on gate '${name}'`) };
      }
      feedbackSink.push({ gate: name, detail: res.detail ?? null });
      return { pass: false };
    }
    state.consecutive[name] = 0;
    return { pass: true };
  }

  async function step(state, role, stepName, feedback) {
    setRole(role);
    state.lastStep = stepName;
    emit({ task_id: taskId, phase: 'build', event: 'task_step', agent_role: role, detail: { step: stepName } });
    try {
      const res = await executor({ role, step: stepName, task: state.task, feedback });
      emit({
        task_id: taskId, phase: 'build', event: 'step_complete', agent_role: role,
        model: res?.model ?? null,
        tokens_in: res?.tokens_in ?? null,
        tokens_out: res?.tokens_out ?? null,
        cost_usd: res?.cost_usd ?? null,
        duration_ms: res?.duration_ms ?? null,
        result: 'pass',
        detail: { step: stepName, num_turns: res?.num_turns ?? null },
      });
      return res;
    } finally {
      clearRole();
    }
  }

  async function runBuildTask(task) {
    const state = loadState() ?? { task, taskId, status: 'running', iteration: 0, consecutive: {}, history: [], lastStep: null, blockingGate: null };
    state.status = 'running';
    const feedback = [];
    try {
      while (state.iteration < caps.totalIterations) {
        state.iteration += 1;
        saveState(state);

        // 1. test-writer produces the failing test; RED must be verified by running it.
        await step(state, 'test-writer', 'write-failing-test', feedback.splice(0));
        const red = await runGate(state, 'red', feedback);
        if (red.escalation) return red.escalation;
        if (!red.pass) continue;

        // 2. builder implements the minimum to pass; GREEN verified.
        await step(state, 'builder', 'implement', feedback.splice(0));
        const green = await runGate(state, 'green', feedback);
        if (green.escalation) return green.escalation;
        if (!green.pass) continue;

        // 3. full fast gate (lint + typecheck + tests + arch rules).
        const ci = await runGate(state, 'ci', feedback);
        if (ci.escalation) return ci.escalation;
        if (!ci.pass) continue;

        state.status = 'green';
        state.blockingGate = null;
        saveState(state);
        emit({ task_id: taskId, phase: 'build', event: 'task_green', agent_role: 'controller', result: 'pass', detail: { iterations: state.iteration } });
        return { status: 'green', iterations: state.iteration };
      }
      return escalate(state, `iteration cap (${caps.totalIterations}) reached`);
    } finally {
      clearRole();
    }
  }

  return { runBuildTask, _internals: { loadState, statePath } };
}
