import { createDeliveryLoop } from '../controller/delivery-loop.mjs';
import { createLoop } from '../controller/loop.mjs';
import { createReviewLoop } from '../controller/review-loop.mjs';
import { evaluateSeededDefects } from './evaluation.mjs';
import { validatePilotConfig } from './input.mjs';

function asFinding(seed) {
  return {
    id: seed.id,
    category: seed.category,
    severity: seed.severity,
    confidence: 1,
    evidence: `deterministic fixture for ${seed.id}`,
  };
}

export async function runFixturePilot(config, { root, emit, omittedSeedIds = [] }) {
  validatePilotConfig(config);
  const omitted = new Set(omittedSeedIds);
  const visibleSeeds = (config.seededDefects ?? []).filter((seed) => !omitted.has(seed.id));
  const observedFindings = [];
  const corrections = [];
  let reviewRound = 0;

  const buildLoop = createLoop({
    taskId: config.task.id,
    root,
    emit,
    executor: async () => ({ summary: 'fixture step complete', model: 'deterministic-fixture' }),
    gates: {
      red: async () => ({ pass: true, detail: 'fixture test fails before implementation' }),
      green: async () => ({ pass: true }),
      ci: async () => ({ pass: true }),
      mutation: async () => ({ pass: true }),
    },
  });
  const reviewLoop = createReviewLoop({
    taskId: config.task.id,
    root,
    emit,
    evidenceProvider: async () => ({
      spec: config.task.acceptance,
      plan: config.task.plan ?? 'TDD build and independent review',
      diff: 'deterministic fixture diff',
      tests: 'deterministic fixture tests',
      gates: 'red, green, ci, mutation: pass',
    }),
    reviewer: async () => {
      reviewRound += 1;
      const seeds = reviewRound === 1 ? visibleSeeds : [];
      observedFindings.push(...seeds.map((seed) => ({ ...asFinding(seed), owner: seed.owner })));
      return {
        review: {
          context_sufficient: true,
          summary: seeds.length ? 'seeded defects detected' : 'corrections verified',
          findings: seeds.map(asFinding),
          blocking: false,
        },
        routed: {
          builder: seeds.filter((seed) => seed.owner === 'builder').map(asFinding),
          'test-writer': seeds.filter((seed) => seed.owner === 'test-writer').map(asFinding),
          advisory: [],
        },
      };
    },
    correctors: {
      builder: async ({ findings }) => corrections.push(`builder:${findings.map((finding) => finding.id).join(',')}`),
      'test-writer': async ({ findings }) =>
        corrections.push(`test-writer:${findings.map((finding) => finding.id).join(',')}`),
    },
    gates: {
      green: async () => ({ pass: true }),
      ci: async () => ({ pass: true }),
      mutation: async () => ({ pass: true }),
    },
  });

  const delivery = await createDeliveryLoop({ buildLoop, reviewLoop }).run(config.task);
  const evaluation = evaluateSeededDefects(config.seededDefects, observedFindings);
  emit({
    task_id: config.task.id,
    phase: 'review',
    event: 'seeded_defect_evaluation',
    agent_role: 'controller',
    result: evaluation.missed.length === 0 ? 'pass' : 'fail',
    detail: evaluation,
  });
  return {
    ...delivery,
    status: delivery.status === 'approved' && evaluation.missed.length > 0 ? 'evaluation-failed' : delivery.status,
    corrections,
    evaluation,
  };
}
