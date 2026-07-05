# Tasks — CHG-0014

## 1. Port

- [x] 1.1 `harness/gates/resolve.mjs` — port `~/.claude/lib/harness.mjs`
      unchanged (header comment paths only)
- [x] 1.2 `harness/gates/resolve-cli.mjs` — port `~/.claude/bin/harness-resolve.mjs`,
      import path updated

## 2. Tests (new — legacy had none)

- [x] 2.1 `tests/resolve.test.mjs` covering: root discovery (binding beats git
      root; git fallback), explicit-overlay-wins, placeholder-test exclusion,
      Node/Next detection, Python (+venv, +frontend subdir), SAM, unknown
      runtime, CLI exit-3 contract

## 3. Land

- [x] 3.1 `npm test` + `npm run lint` green locally
- [x] 3.2 Branch `chg/port-harness-resolver`; commit with CHG-0014 + emit event;
      include CHG-0013 archive move
- [x] 3.3 PR with `tests-approved` label (tests/** touched); checks green;
      squash-merge; archive bundle
