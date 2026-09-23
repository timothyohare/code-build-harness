import fs from 'node:fs';
import path from 'node:path';
import { emit as defaultEmit } from './emit-event.mjs';

export const DEFAULT_REVIEW_CAPS = { reviewRounds: 2 };

export function createReviewLoop({
  taskId,
  root,
  reviewer,
  evidenceProvider,
  correctors,
  gates,
  caps = DEFAULT_REVIEW_CAPS,
  emit = defaultEmit,
}) {
  const statePath = path.join(root, 'memory', 'review-state', `${taskId}.json`);
  const rolePath = path.join(root, '.harness-role');

  const saveState = (state) => {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  };
  const loadState = () => {
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch {
      return null;
    }
  };
  const setRole = (role) => fs.writeFileSync(rolePath, role);
  const clearRole = () => fs.rmSync(rolePath, { force: true });

  function writeHandoff(state, reason) {
    const dir = path.join(root, 'memory', 'handoffs');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${taskId}-review.md`);
    const attempts = state.history.map((item, index) => `${index + 1}. ${item}`).join('\n');
    fs.writeFileSync(
      file,
      [
        `# Review handoff: ${taskId}`,
        '',
        `**Escalated:** ${new Date().toISOString()}`,
        `**Reason:** ${reason}`,
        '',
        '## Review history',
        attempts || '(no review actions recorded)',
        '',
        '## Notes for the human',
        `State file: memory/review-state/${taskId}.json`,
      ].join('\n'),
    );
    return file;
  }

  function escalate(state, reason) {
    state.status = 'escalated';
    state.reason = reason;
    saveState(state);
    const handoff = writeHandoff(state, reason);
    emit({
      task_id: taskId,
      phase: 'review',
      event: 'review_escalated',
      agent_role: 'controller',
      result: 'escalated',
      detail: { reason, handoff, rounds: state.rounds },
    });
    return { status: 'escalated', reason, handoff, rounds: state.rounds };
  }

  async function runCorrectionGates(state, owner) {
    const names = owner === 'test-writer' ? ['green', 'ci', 'mutation'] : ['green', 'ci'];
    for (const name of names) {
      if (!gates[name]) continue;
      let result;
      try {
        result = await gates[name]();
      } catch (error) {
        return `correction gate '${name}' crashed for ${owner}: ${error.message}`;
      }
      state.history.push(
        `${owner} correction gate ${name}: ${result.pass ? 'pass' : 'FAIL'}${result.detail ? ` — ${result.detail}` : ''}`,
      );
      emit({
        task_id: taskId,
        phase: 'review',
        event: 'review_correction_gate',
        agent_role: 'controller',
        result: result.pass ? 'pass' : 'fail',
        detail: { owner, gate: name, ...result },
      });
      saveState(state);
      if (!result.pass)
        return `correction gate '${name}' failed for ${owner}${result.detail ? `: ${result.detail}` : ''}`;
    }
    return null;
  }

  async function correct(state, owner, findings, evidence) {
    const corrector = correctors[owner];
    if (typeof corrector !== 'function') return `no corrector configured for ${owner}`;
    setRole(owner);
    try {
      await corrector({ taskId, owner, findings, evidence, round: state.rounds });
    } catch (error) {
      return `${owner} correction failed: ${error.message}`;
    } finally {
      clearRole();
    }
    state.history.push(`${owner} corrected findings: ${findings.map((finding) => finding.id).join(', ')}`);
    emit({
      task_id: taskId,
      phase: 'review',
      event: 'review_correction',
      agent_role: owner,
      result: 'pass',
      detail: { round: state.rounds, findings: findings.map((finding) => finding.id) },
    });
    saveState(state);
    return runCorrectionGates(state, owner);
  }

  async function run() {
    const state = loadState() ?? { taskId, status: 'reviewing', rounds: 0, history: [], findings: [], advisory: [] };
    state.status = 'reviewing';
    try {
      while (state.rounds < caps.reviewRounds) {
        state.rounds += 1;
        saveState(state);
        let evidence;
        try {
          evidence = await evidenceProvider({ taskId, round: state.rounds });
        } catch (error) {
          return escalate(state, `review evidence failed closed: ${error.message}`);
        }
        let result;
        try {
          result = await reviewer(evidence);
        } catch (error) {
          return escalate(state, `review failed closed: ${error.message}`);
        }
        const { review, routed } = result;
        state.findings = [...routed['test-writer'], ...routed.builder];
        state.advisory = routed.advisory;
        state.history.push(`review round ${state.rounds}: ${review.summary}`);
        emit({
          task_id: taskId,
          phase: 'review',
          event: 'review_primary',
          agent_role: 'reviewer',
          result: review.context_sufficient ? 'pass' : 'fail',
          detail: { round: state.rounds, summary: review.summary, findings: state.findings.length },
        });
        saveState(state);

        if (!review.context_sufficient) return escalate(state, `insufficient review context: ${review.summary}`);
        const critical = state.findings.find((finding) => finding.severity === 'critical');
        if (critical) return escalate(state, `critical review finding ${critical.id}: ${critical.evidence}`);
        if (state.findings.length === 0) {
          state.status = 'approved';
          saveState(state);
          emit({
            task_id: taskId,
            phase: 'review',
            event: 'review_approved',
            agent_role: 'controller',
            result: 'pass',
            detail: { rounds: state.rounds, advisory: state.advisory.length },
          });
          return { status: 'approved', rounds: state.rounds, advisory: state.advisory };
        }

        for (const owner of ['test-writer', 'builder']) {
          if (routed[owner].length === 0) continue;
          const failure = await correct(state, owner, routed[owner], evidence);
          if (failure) return escalate(state, failure);
        }
      }
      return escalate(state, `review round cap (${caps.reviewRounds}) reached`);
    } finally {
      clearRole();
    }
  }

  return { run, _internals: { loadState, statePath } };
}
