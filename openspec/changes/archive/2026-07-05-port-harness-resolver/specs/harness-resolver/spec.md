# harness-resolver

## ADDED Requirements

### Requirement: Project root discovery

`findProjectRoot(startDir)` SHALL walk up from `startDir` and return the first
directory containing `.claude/harness.json`; if none exists, it SHALL return the
nearest directory containing `.git` seen during the walk; otherwise it SHALL
return `startDir`.

#### Scenario: Explicit binding wins over git root

- **GIVEN** a repo with `.git` at its root and `.claude/harness.json` in a
  subdirectory `svc/`
- **WHEN** `findProjectRoot` starts from `svc/deep/dir`
- **THEN** it returns `svc/` (the binding directory), not the git root

#### Scenario: Git root fallback

- **GIVEN** a directory tree with `.git` at the root and no `harness.json`
  anywhere
- **WHEN** `findProjectRoot` starts from a nested directory
- **THEN** it returns the git root

### Requirement: Explicit binding overlays autodetected defaults

`loadConfig(startDir)` SHALL return `{ root, hasExplicit, config }` where
`config` is autodetected defaults overlaid with the explicit
`.claude/harness.json` binding, and explicit keys MUST always win.

#### Scenario: Explicit key overrides autodetection

- **GIVEN** a Node repo whose `package.json` has a `lint` script and whose
  `harness.json` sets `"lint": "custom-lint"`
- **WHEN** `loadConfig` resolves it
- **THEN** `config.lint` is `"custom-lint"` and `hasExplicit` is `true`

### Requirement: Absent key means no-op, never a bogus command

Autodetection SHALL only emit a key when the underlying command actually exists
(npm script present, tool configured in pyproject). A gate reading an absent key
MUST no-op. The npm-init placeholder test script (`no test specified`) SHALL NOT
produce a `test` key.

#### Scenario: Placeholder test script excluded

- **GIVEN** a `package.json` whose `test` script is the npm-init
  `echo "Error: no test specified" && exit 1` placeholder
- **WHEN** `loadConfig` resolves it
- **THEN** `config.test` is undefined

### Requirement: Runtime autodetection families

Autodetection SHALL support: Node (npm scripts → lint/typecheck/build/test),
Next.js (adds boot/ready on port 3000), Python via pyproject/setup.py (ruff /
mypy / pytest only when configured, preferring `.venv/bin` binaries when
present), a Next.js frontend in a `frontend|web|client|app` subdirectory
contributing build/boot/ready, and SAM/Lambda (`template.yaml` →
sam build / sam local / localstack). Unrecognized repos SHALL resolve to
`runtime: "unknown"` with no command keys.

#### Scenario: Python repo with configured tools and venv

- **GIVEN** a repo with `pyproject.toml` containing `[tool.ruff]` and
  `[tool.mypy]` sections and a `.venv/bin/ruff` binary
- **WHEN** `loadConfig` resolves it
- **THEN** `config.lint` is `.venv/bin/ruff check .` and `config.typecheck`
  uses `mypy`

#### Scenario: SAM app detected

- **GIVEN** a repo containing `template.yaml` and no `package.json`
- **WHEN** `loadConfig` resolves it
- **THEN** `config.runtime` is `"lambda"`, `config.boot` is
  `sam local start-api --port 3000`, and `config.mockAws` is `"localstack"`

### Requirement: Resolver inspection CLI

The CLI SHALL print the full resolved config as JSON (no args or `--json`),
the detected root (`--root`), or a single key's value (`<key>`), exiting 3
when the key is not defined.

#### Scenario: Undefined key exits 3

- **GIVEN** a repo whose resolved config has no `perfBoot` key
- **WHEN** the CLI is invoked with argument `perfBoot`
- **THEN** it exits with code 3 and prints nothing to stdout
