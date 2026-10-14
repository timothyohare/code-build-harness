import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReview, routeFindings } from '../harness/review/findings.mjs';
import { buildReviewPackage } from '../harness/review/package.mjs';
import { createReviewRunner } from '../harness/review/runner.mjs';

const INPUT = {
  spec: 'AC-1: return a value',
  plan: 'Modify src/value.mjs',
  diff: 'diff --git a/src/value.mjs b/src/value.mjs',
  tests: 'test returns a value',
  gates: 'gate-ci: pass',
};

test('review package is deterministic and ordered', () => {
  const first = buildReviewPackage(INPUT);
  const second = buildReviewPackage({
    gates: INPUT.gates,
    tests: INPUT.tests,
    diff: INPUT.diff,
    plan: INPUT.plan,
    spec: INPUT.spec,
  });
  assert.equal(first, second);
  assert.ok(first.indexOf('## Specification') < first.indexOf('## Plan'));
  assert.ok(first.indexOf('## Plan') < first.indexOf('## Diff'));
  assert.ok(first.indexOf('## Diff') < first.indexOf('## Tests'));
  assert.ok(first.indexOf('## Tests') < first.indexOf('## Gate Evidence'));
});

test('review package fails closed when it exceeds the byte budget', () => {
  assert.throws(() => buildReviewPackage(INPUT, { maxBytes: 20 }), /review package exceeds 20-byte limit/);
});

test('invalid review output fails closed', () => {
  assert.throws(() => parseReview('not json'), /review output is not valid JSON/);
  assert.throws(
    () => parseReview('{"context_sufficient":true,"summary":"missing findings"}'),
    /findings must be an array/,
  );
});

test('insufficient context is explicitly blocking', () => {
  const review = parseReview(JSON.stringify({ context_sufficient: false, summary: 'missing spec', findings: [] }));
  assert.equal(review.blocking, true);
  assert.equal(review.context_sufficient, false);
});

test('confidence filter and categories route findings deterministically', () => {
  const review = parseReview(
    JSON.stringify({
      context_sufficient: true,
      summary: 'two findings',
      findings: [
        { id: 'R-1', severity: 'high', confidence: 0.9, category: 'correctness', evidence: 'wrong return' },
        { id: 'R-2', severity: 'medium', confidence: 0.8, category: 'coverage', evidence: 'missing boundary test' },
        { id: 'R-3', severity: 'low', confidence: 0.4, category: 'readability', evidence: 'maybe rename' },
      ],
    }),
  );
  const routed = routeFindings(review, { minConfidence: 0.7 });
  assert.deepEqual(
    routed.builder.map((f) => f.id),
    ['R-1'],
  );
  assert.deepEqual(
    routed['test-writer'].map((f) => f.id),
    ['R-2'],
  );
  assert.deepEqual(
    routed.advisory.map((f) => f.id),
    ['R-3'],
  );
});

test('review runner packages evidence, invokes a fresh reviewer role, and routes output', async () => {
  const requests = [];
  const runner = createReviewRunner({
    executor: async (request) => {
      requests.push(request);
      return {
        summary: JSON.stringify({
          context_sufficient: true,
          summary: 'one finding',
          findings: [
            { id: 'R-1', severity: 'high', confidence: 0.95, category: 'correctness', evidence: 'wrong value' },
          ],
        }),
      };
    },
  });
  const result = await runner(INPUT);
  assert.equal(requests[0].role, 'reviewer');
  assert.equal(requests[0].step, 'review');
  assert.match(requests[0].task.package, /## Specification/);
  assert.deepEqual(
    result.routed.builder.map((finding) => finding.id),
    ['R-1'],
  );
});

test('review runner does not route findings when context is insufficient', async () => {
  const runner = createReviewRunner({
    executor: async () => ({
      summary: JSON.stringify({ context_sufficient: false, summary: 'diff omitted', findings: [] }),
    }),
  });
  const result = await runner(INPUT);
  assert.equal(result.review.blocking, true);
  assert.deepEqual(result.routed, { builder: [], 'test-writer': [], advisory: [] });
});
