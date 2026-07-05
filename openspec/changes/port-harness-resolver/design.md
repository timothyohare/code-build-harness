# Design — CHG-0014

## Approach

Port-as-is (parity plan step 1 says "unchanged"): `harness/gates/resolve.mjs` is
`~/.claude/lib/harness.mjs` with only the header comment's path references
updated. No refactoring, no new keys, no behavior drift — the dual-run cutover
check (step 5) depends on old and new producing identical verdicts, so the port
must be boring.

## Decisions

- **Keep the export surface identical** (`findProjectRoot`, `loadConfig`,
  `resolveKey`); internal helpers stay unexported. Tests exercise autodetection
  through `loadConfig` over synthesized temp directories rather than exporting
  internals — tests then pin the public contract, not the implementation.
- **Temp-dir fixtures, not committed `fixtures/`**: each test builds its shape
  under `fs.mkdtemp(os.tmpdir())` and cleans up. Avoids committed fixture trees
  and stays outside the fixtures/** trust boundary.
- **CLI ported alongside** (`resolve-cli.mjs`): 25 lines, pure wrapper; its exit-3
  contract is part of the parity matrix, so it lands with the module it wraps.
- **No event emission from the resolver**: telemetry is a *gate* concern (parity
  matrix 🆕 rows are on the gates); the resolver is a pure function library.

## Risks

- findProjectRoot walks to filesystem root; tests under `/tmp` rely on no
  `.claude/harness.json` or `.git` existing above the temp dir. `/tmp` has
  neither on this machine; acceptable.
