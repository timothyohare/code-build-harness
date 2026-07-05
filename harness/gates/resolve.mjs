// Shared resolver for the harness gates (D-25 port of ~/.claude/lib/harness.mjs).
//
// The harness ships generic gates (ci, verify, perf) that know nothing about
// any specific repo. Each project declares what its commands mean in
// <repo>/.claude/harness.json. This module resolves a project's config by
// reading that binding and falling back to runtime autodetection, so the same
// gate works across a Next.js app and a Lambda app.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Walk up from startDir to find the project root. Prefer a directory that holds
// .claude/harness.json (the explicit binding); otherwise fall back to the git
// root; otherwise the starting directory.
export function findProjectRoot(startDir = process.cwd()) {
  let dir = startDir;
  let gitRoot = null;
  while (true) {
    if (existsSync(join(dir, '.claude', 'harness.json'))) return dir;
    if (gitRoot === null && existsSync(join(dir, '.git'))) gitRoot = dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return gitRoot ?? startDir;
}

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function readText(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

// Detect a Next.js app living in a conventional subdirectory (the common
// "Python backend + JS frontend" monorepo shape). Contributes build/boot/ready
// pointing into that subdir. Returns {} when there's no such frontend.
function detectFrontend(root) {
  for (const sub of ['frontend', 'web', 'client', 'app']) {
    const pkg = readJson(join(root, sub, 'package.json'));
    if (!pkg) continue;
    const isNext = !!(pkg.dependencies?.next || pkg.devDependencies?.next);
    if (!isNext) continue;
    const scripts = pkg.scripts ?? {};
    const has = (s) => typeof scripts[s] === 'string' && scripts[s].length > 0;
    const cfg = {};
    if (has('build')) cfg.build = `cd ${sub} && npm run build`;
    cfg.boot = has('dev') ? `cd ${sub} && npm run dev` : `cd ${sub} && npx next dev`;
    cfg.ready = 'http://localhost:3000';
    return cfg;
  }
  return {};
}

// Best-effort defaults inferred from the repo. Only emits a key when the
// underlying command actually exists (e.g. the npm script is present), so a
// gate reading an absent key simply no-ops rather than running a bogus command.
function detectDefaults(root) {
  const pkg = readJson(join(root, 'package.json'));

  if (pkg) {
    const scripts = pkg.scripts ?? {};
    const has = (s) => typeof scripts[s] === 'string' && scripts[s].length > 0;
    const isNext = !!(pkg.dependencies?.next || pkg.devDependencies?.next);
    const cfg = { runtime: isNext ? 'nextjs' : 'node' };
    if (has('lint')) cfg.lint = 'npm run lint';
    if (has('typecheck')) cfg.typecheck = 'npm run typecheck';
    if (has('build')) cfg.build = 'npm run build';
    // `npm init` writes a placeholder test script that just errors — ignore it.
    if (has('test') && !/no test specified/.test(scripts.test)) cfg.test = 'npm test';
    if (isNext) {
      cfg.boot = has('dev') ? 'npm run dev' : 'next dev';
      cfg.ready = 'http://localhost:3000';
    }
    return cfg;
  }

  // Python project (pyproject.toml / setup.py at root). Prefer a project venv's
  // binaries when present, else the bare command on PATH. Only emit lint /
  // typecheck when the tool is actually configured in pyproject, so a gate
  // reading an absent key no-ops rather than running an unconfigured tool.
  const pyproject = readText(join(root, 'pyproject.toml'));
  if (pyproject !== null || existsSync(join(root, 'setup.py'))) {
    const py = pyproject ?? '';
    const bin = (name) => (existsSync(join(root, '.venv', 'bin', name)) ? `.venv/bin/${name}` : name);
    const cfg = { runtime: 'python' };
    if (/\[tool\.ruff\b/.test(py)) cfg.lint = `${bin('ruff')} check .`;
    if (/\[tool\.mypy\b/.test(py)) cfg.typecheck = `${bin('mypy')} .`;
    if (/\[tool\.pytest\b/.test(py) || existsSync(join(root, 'pytest.ini')) || existsSync(join(root, 'tests'))) {
      cfg.test = existsSync(join(root, '.venv', 'bin', 'pytest')) ? '.venv/bin/pytest' : 'python3 -m pytest';
    }
    // A Next.js frontend in a subdir contributes build/boot/ready.
    Object.assign(cfg, detectFrontend(root));
    return cfg;
  }

  // SAM / Lambda app
  if (['template.yaml', 'template.yml', 'samconfig.toml'].some((f) => existsSync(join(root, f)))) {
    return {
      runtime: 'lambda',
      build: 'sam build',
      boot: 'sam local start-api --port 3000',
      ready: 'http://localhost:3000',
      mockAws: 'localstack',
    };
  }

  return { runtime: 'unknown' };
}

// Resolve the effective config: autodetected defaults overlaid with the
// explicit binding (explicit always wins).
export function loadConfig(startDir = process.cwd()) {
  const root = findProjectRoot(startDir);
  const defaults = detectDefaults(root);
  const explicit = readJson(join(root, '.claude', 'harness.json')) ?? {};
  return {
    root,
    hasExplicit: Object.keys(explicit).length > 0,
    config: { ...defaults, ...explicit },
  };
}

export function resolveKey(key, startDir = process.cwd()) {
  return loadConfig(startDir).config[key];
}
