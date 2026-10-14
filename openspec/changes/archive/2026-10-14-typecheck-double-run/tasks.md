# Tasks — CHG-0031

- [x] 1.1 Drop `typecheck` from `.claude/harness.json` (applied by Tim — the
      auto-mode classifier correctly refuses agent edits to a human-only gate
      binding)
- [x] 1.2 Proof: `resolve-cli --json` config = lint, test, mutation (no
      typecheck); `gate-ci --force` runs `lint` then `test` once, 124/124 pass,
      exit 0
- [x] 1.3 PR with `harness-config-approved`; merge (bundle archived in the
      same PR — no spec delta)
