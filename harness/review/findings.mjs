const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'nit']);

function validateFinding(finding, index) {
  if (!finding || typeof finding !== 'object') throw new Error(`finding ${index} must be an object`);
  for (const key of ['id', 'severity', 'category', 'evidence']) {
    if (typeof finding[key] !== 'string' || !finding[key]) throw new Error(`finding ${index}.${key} must be a string`);
  }
  if (!SEVERITIES.has(finding.severity)) throw new Error(`finding ${index}.severity is invalid`);
  if (typeof finding.confidence !== 'number' || finding.confidence < 0 || finding.confidence > 1) {
    throw new Error(`finding ${index}.confidence must be between 0 and 1`);
  }
}

export function parseReview(output) {
  let review;
  try {
    review = JSON.parse(output);
  } catch {
    throw new Error('review output is not valid JSON');
  }
  if (typeof review.context_sufficient !== 'boolean') throw new Error('context_sufficient must be boolean');
  if (typeof review.summary !== 'string') throw new Error('summary must be a string');
  if (!Array.isArray(review.findings)) throw new Error('findings must be an array');
  review.findings.forEach(validateFinding);
  return { ...review, blocking: !review.context_sufficient };
}

export function routeFindings(review, { minConfidence = 0.7 } = {}) {
  const routed = { builder: [], 'test-writer': [], advisory: [] };
  for (const finding of review.findings) {
    if (finding.confidence < minConfidence) {
      routed.advisory.push(finding);
    } else if (['coverage', 'test'].includes(finding.category)) {
      routed['test-writer'].push(finding);
    } else {
      routed.builder.push(finding);
    }
  }
  return routed;
}
