import fs from 'node:fs';
import path from 'node:path';

const TEST_OWNED = [/(^|\/)tests?\//, /(^|\/)fixtures?\//, /\.(test|spec)\.[jt]sx?$/, /_test\.py$/];

function safeRelativePath(candidate) {
  return (
    typeof candidate === 'string' &&
    candidate.length > 0 &&
    !candidate.includes('\\') &&
    !candidate.includes('\0') &&
    !path.posix.isAbsolute(candidate) &&
    path.posix.normalize(candidate) === candidate &&
    !candidate.split('/').some((segment) => segment === '.' || segment === '..' || segment === '')
  );
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function validateResolvedParent(rootReal, target) {
  let existing = fs.existsSync(target) ? target : path.dirname(target);
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  const existingReal = fs.realpathSync(existing);
  if (!isWithin(rootReal, existingReal))
    throw new Error(`test change '${target}' escapes repository root through a symlink`);
  const resolvedTarget = path.resolve(existingReal, path.relative(existing, target));
  const resolvedRelative = path.relative(rootReal, resolvedTarget).split(path.sep).join('/');
  if (!TEST_OWNED.some((pattern) => pattern.test(resolvedRelative))) {
    throw new Error(`test change '${target}' resolves outside test-writer owned paths`);
  }
}

export function parseTestChanges(output, { maxBytes = 1_000_000, maxChanges = 50 } = {}) {
  let proposal;
  try {
    proposal = JSON.parse(output);
  } catch {
    throw new Error('test change output is not valid JSON');
  }
  if (!proposal || typeof proposal !== 'object') throw new Error('test change output must be an object');
  if (typeof proposal.summary !== 'string') throw new Error('test change summary must be a string');
  if (!Array.isArray(proposal.changes) || proposal.changes.length === 0) {
    throw new Error('test change output must contain at least one change');
  }
  if (proposal.changes.length > maxChanges) throw new Error(`test change output exceeds ${maxChanges}-file limit`);

  let totalBytes = 0;
  const seen = new Set();
  for (const [index, change] of proposal.changes.entries()) {
    if (!change || typeof change !== 'object') throw new Error(`test change ${index} must be an object`);
    if (!safeRelativePath(change.path)) throw new Error(`test change '${change.path}' is not a safe relative path`);
    if (!TEST_OWNED.some((pattern) => pattern.test(change.path))) {
      throw new Error(`test change '${change.path}' is not test-writer owned`);
    }
    if (seen.has(change.path)) throw new Error(`test change output contains duplicate path '${change.path}'`);
    seen.add(change.path);
    if (typeof change.content !== 'string') throw new Error(`test change ${index}.content must be a string`);
    totalBytes += Buffer.byteLength(change.content);
  }
  if (totalBytes > maxBytes) throw new Error(`test change output exceeds ${maxBytes}-byte limit`);
  return proposal;
}

export function applyTestChanges({ root, output, maxBytes, maxChanges }) {
  const proposal = parseTestChanges(output, { maxBytes, maxChanges });
  const rootReal = fs.realpathSync(root);
  const targets = proposal.changes.map((change) => {
    const target = path.resolve(rootReal, change.path);
    if (!isWithin(rootReal, target)) throw new Error(`test change '${change.path}' escapes repository root`);
    validateResolvedParent(rootReal, target);
    return { ...change, target };
  });

  for (const change of targets) {
    fs.mkdirSync(path.dirname(change.target), { recursive: true });
    fs.writeFileSync(change.target, change.content);
  }
  return { summary: proposal.summary, paths: targets.map((change) => change.path) };
}
