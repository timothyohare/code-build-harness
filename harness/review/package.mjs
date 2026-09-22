const SECTIONS = [
  ['Specification', 'spec'],
  ['Plan', 'plan'],
  ['Diff', 'diff'],
  ['Tests', 'tests'],
  ['Gate Evidence', 'gates'],
  ['Disagreements', 'disagreements'],
];

export function buildReviewPackage(input, { maxBytes = 200_000 } = {}) {
  const sections = ['# Review Evidence Package'];
  for (const [title, key] of SECTIONS) {
    sections.push('', `## ${title}`, '', String(input[key] ?? '(none)'));
  }
  const result = `${sections.join('\n')}\n`;
  const size = Buffer.byteLength(result);
  if (size > maxBytes) throw new Error(`review package exceeds ${maxBytes}-byte limit (${size} bytes)`);
  return result;
}
