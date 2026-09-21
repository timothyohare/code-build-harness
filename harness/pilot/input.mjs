import fs from 'node:fs';

const OWNERS = new Set(['builder', 'test-writer']);
const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'nit']);

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`);
}

export function validatePilotConfig(config) {
  if (!config?.task || typeof config.task !== 'object' || Array.isArray(config.task)) {
    throw new Error('task must be an object');
  }
  for (const key of ['id', 'name', 'description', 'acceptance']) requireString(config.task[key], `task.${key}`);
  if (config.task.plan !== undefined) requireString(config.task.plan, 'task.plan');
  if (config.seededDefects !== undefined && !Array.isArray(config.seededDefects)) {
    throw new Error('seededDefects must be an array');
  }
  const ids = new Set();
  for (const [index, seed] of (config.seededDefects ?? []).entries()) {
    if (!seed || typeof seed !== 'object' || Array.isArray(seed)) {
      throw new Error(`seededDefects[${index}] must be an object`);
    }
    for (const key of ['id', 'category', 'owner', 'severity']) {
      requireString(seed[key], `seededDefects[${index}].${key}`);
    }
    if (!OWNERS.has(seed.owner)) throw new Error(`seededDefects[${index}].owner must be builder or test-writer`);
    if (!SEVERITIES.has(seed.severity)) throw new Error(`seededDefects[${index}].severity is invalid`);
    if (seed.evidenceIncludes !== undefined) {
      requireString(seed.evidenceIncludes, `seededDefects[${index}].evidenceIncludes`);
    }
    if (ids.has(seed.id)) throw new Error(`seededDefects contains duplicate id '${seed.id}'`);
    ids.add(seed.id);
  }
  return config;
}

export function loadPilotConfig(file, { maxBytes = 100_000 } = {}) {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error('pilot input must be a regular file');
  if (stat.size > maxBytes) throw new Error(`pilot input exceeds ${maxBytes}-byte limit`);
  let config;
  try {
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`pilot input is not valid JSON: ${error.message}`);
  }
  return validatePilotConfig(config);
}
