import { parseReview, routeFindings } from './findings.mjs';
import { buildReviewPackage } from './package.mjs';

export function createReviewRunner({ executor, maxBytes = 200_000, minConfidence = 0.7 }) {
  return async function runReview(evidence) {
    const reviewPackage = buildReviewPackage(evidence, { maxBytes });
    const result = await executor({
      role: 'reviewer',
      step: 'review',
      task: { name: 'independent-review', package: reviewPackage },
      feedback: [],
    });
    const review = parseReview(result.summary);
    const routed = review.context_sufficient
      ? routeFindings(review, { minConfidence })
      : { builder: [], 'test-writer': [], advisory: [] };
    return { review, routed, telemetry: result };
  };
}
