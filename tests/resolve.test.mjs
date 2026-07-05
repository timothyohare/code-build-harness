import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { findProjectRoot, loadConfig, resolveKey } from '../harness/gates/resolve.mjs';

const CLI = new URL('../harness/gates/resolve-cli.mjs', import.meta.url).pathname;

function scaffold(shape) {
  const root = mkdtempSync(join(tmpdir(), 'resolve-test-'));
  for (const [rel, content] of Object.entries(shape)) {
    const p = join(root, rel);
    if (content === null) {
      mkdirSync(p, { recursive: true });
    } else {
      mkdirSync(join(p, '..'), { recursive: true });
      writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
    }
  }
  return root;
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test('findProjectRoot: harness.json binding beats git root', () => {
  const root = scaffold({
    '.git': null,
    'svc/.claude/harness.json': {},
    'svc/deep/dir': null,
  });
  try {
    assert.equal(findProjectRoot(join(root, 'svc/deep/dir')), join(root, 'svc'));
  } finally {
    cleanup(root);
  }
});

test('findProjectRoot: falls back to git root when no binding exists', () => {
  const root = scaffold({ '.git': null, 'a/b/c': null });
  try {
    assert.equal(findProjectRoot(join(root, 'a/b/c')), root);
  } finally {
    cleanup(root);
  }
});

test('findProjectRoot: falls back to startDir when neither exists', () => {
  const root = scaffold({ 'a/b': null });
  try {
    assert.equal(findProjectRoot(join(root, 'a/b')), join(root, 'a/b'));
  } finally {
    cleanup(root);
  }
});

test('node repo: emits only keys whose npm scripts exist', () => {
  const root = scaffold({
    'package.json': { scripts: { lint: 'eslint .', build: 'tsc -b' } },
  });
  try {
    const { config, hasExplicit } = loadConfig(root);
    assert.equal(hasExplicit, false);
    assert.equal(config.runtime, 'node');
    assert.equal(config.lint, 'npm run lint');
    assert.equal(config.build, 'npm run build');
    assert.equal(config.typecheck, undefined);
    assert.equal(config.test, undefined);
  } finally {
    cleanup(root);
  }
});

test('node repo: npm-init placeholder test script is excluded', () => {
  const root = scaffold({
    'package.json': {
      scripts: { test: 'echo "Error: no test specified" && exit 1' },
    },
  });
  try {
    assert.equal(loadConfig(root).config.test, undefined);
  } finally {
    cleanup(root);
  }
});

test('next.js repo: adds boot and ready', () => {
  const root = scaffold({
    'package.json': {
      dependencies: { next: '15.0.0' },
      scripts: { dev: 'next dev', test: 'vitest run' },
    },
  });
  try {
    const { config } = loadConfig(root);
    assert.equal(config.runtime, 'nextjs');
    assert.equal(config.boot, 'npm run dev');
    assert.equal(config.ready, 'http://localhost:3000');
    assert.equal(config.test, 'npm test');
  } finally {
    cleanup(root);
  }
});

test('explicit harness.json binding overrides autodetection', () => {
  const root = scaffold({
    'package.json': { scripts: { lint: 'eslint .' } },
    '.claude/harness.json': { lint: 'custom-lint' },
  });
  try {
    const { config, hasExplicit } = loadConfig(root);
    assert.equal(hasExplicit, true);
    assert.equal(config.lint, 'custom-lint');
    assert.equal(resolveKey('lint', root), 'custom-lint');
  } finally {
    cleanup(root);
  }
});

test('python repo: configured tools only, venv binaries preferred', () => {
  const root = scaffold({
    'pyproject.toml': '[tool.ruff]\nline-length = 100\n[tool.mypy]\nstrict = true\n[tool.pytest.ini_options]\n',
    '.venv/bin/ruff': '',
    '.venv/bin/pytest': '',
  });
  try {
    const { config } = loadConfig(root);
    assert.equal(config.runtime, 'python');
    assert.equal(config.lint, '.venv/bin/ruff check .');
    assert.equal(config.typecheck, 'mypy .');
    assert.equal(config.test, '.venv/bin/pytest');
  } finally {
    cleanup(root);
  }
});

test('python repo: unconfigured tools are not emitted', () => {
  const root = scaffold({ 'pyproject.toml': '[project]\nname = "x"\n' });
  try {
    const { config } = loadConfig(root);
    assert.equal(config.runtime, 'python');
    assert.equal(config.lint, undefined);
    assert.equal(config.typecheck, undefined);
    assert.equal(config.test, undefined);
  } finally {
    cleanup(root);
  }
});

test('python repo: next.js frontend subdir contributes build/boot/ready', () => {
  const root = scaffold({
    'pyproject.toml': '[project]\nname = "x"\n',
    'frontend/package.json': {
      dependencies: { next: '15.0.0' },
      scripts: { dev: 'next dev', build: 'next build' },
    },
  });
  try {
    const { config } = loadConfig(root);
    assert.equal(config.runtime, 'python');
    assert.equal(config.build, 'cd frontend && npm run build');
    assert.equal(config.boot, 'cd frontend && npm run dev');
    assert.equal(config.ready, 'http://localhost:3000');
  } finally {
    cleanup(root);
  }
});

test('sam/lambda repo: template.yaml drives sam defaults', () => {
  const root = scaffold({ 'template.yaml': 'AWSTemplateFormatVersion: x\n' });
  try {
    const { config } = loadConfig(root);
    assert.equal(config.runtime, 'lambda');
    assert.equal(config.build, 'sam build');
    assert.equal(config.boot, 'sam local start-api --port 3000');
    assert.equal(config.mockAws, 'localstack');
  } finally {
    cleanup(root);
  }
});

test('unrecognized repo: runtime unknown, no command keys', () => {
  const root = scaffold({ 'README.md': 'hello' });
  try {
    const { config } = loadConfig(root);
    assert.equal(config.runtime, 'unknown');
    assert.equal(Object.keys(config).length, 1);
  } finally {
    cleanup(root);
  }
});

test('cli: prints key value, --root, and exits 3 on undefined key', () => {
  const root = scaffold({
    'package.json': { scripts: { lint: 'eslint .' } },
    '.claude/harness.json': {},
  });
  try {
    const lint = execFileSync(process.execPath, [CLI, 'lint'], { cwd: root, encoding: 'utf8' });
    assert.equal(lint.trim(), 'npm run lint');
    // mkdtemp may hand back a symlinked path (e.g. /tmp -> /private/tmp); the
    // CLI prints the root as the OS resolves it, so only assert the suffix.
    const printedRoot = execFileSync(process.execPath, [CLI, '--root'], { cwd: root, encoding: 'utf8' });
    assert.ok(printedRoot.trim().endsWith(root.split('/').pop()));
    const json = JSON.parse(execFileSync(process.execPath, [CLI, '--json'], { cwd: root, encoding: 'utf8' }));
    assert.equal(json.config.lint, 'npm run lint');
    assert.throws(
      () => execFileSync(process.execPath, [CLI, 'perfBoot'], { cwd: root, encoding: 'utf8' }),
      (err) => err.status === 3,
    );
  } finally {
    cleanup(root);
  }
});
