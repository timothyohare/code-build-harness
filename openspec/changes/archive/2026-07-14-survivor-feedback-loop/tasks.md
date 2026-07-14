# Tasks — CHG-0022

- [x] 1.1 `loop.mjs`: optional mutation gate after ci; sticky
      survivor-strengthening mode (`state.mode`), GREEN-only verification,
      feedback routing, caps unchanged
- [x] 1.2 `claude-cli.mjs`: step-aware `strengthen-tests` test-writer prompt
- [x] 1.3 `run-live.mjs`: mutation gate wired to `harness/gates/mutation.mjs`
- [x] 1.4 Tests: strengthen routing (no red re-run, feedback delivery), sticky
      mode across a green red, mutation escalation, strengthen prompt (80 total)
- [x] 1.5 `npm test` + `npm run lint` green; PR with `tests-approved` +
      `harness-config-approved`; merge; archive bundle
