// Architecture fitness rules (CHG-0028, M2 "eslint-boundaries" item —
// dependency-cruiser chosen because this repo lints with Biome, which has no
// boundaries plugin; 04-validate.md names either tool for this layer).
// Rides the lint step: `npm run lint` fails on any violation.
//
// The layering these rules freeze (see docs/harness/architecture.md and the
// trust model in CLAUDE.md):
//   gates  → may use resolve/telemetry only; they are standalone executables
//   hooks  → telemetry only; they run inside constrained hook contexts (D-9)
//   controller → self-contained; it runs gates as subprocesses, never imports
//                them (keeps the loop's verdict authority at the exit code)
//   live   → wiring layer; may import controller, nothing imports it
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Circular imports hide initialization order bugs.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'gates-only-resolve-and-telemetry',
      comment:
        'Gates are standalone executables: gates-internal imports plus controller/emit-event.mjs (telemetry) only — never the loop, executors, hooks, or live (D-25).',
      severity: 'error',
      from: { path: '^harness/gates' },
      to: {
        path: '^harness/(controller|hooks|live)',
        pathNot: '^harness/controller/emit-event\\.mjs$',
      },
    },
    {
      name: 'hooks-only-telemetry',
      comment:
        'Hooks run in constrained PreToolUse/Stop contexts: telemetry import only — a hook that pulls in the loop or gates can deadlock or widen the trust surface (D-9).',
      severity: 'error',
      from: { path: '^harness/hooks' },
      to: {
        path: '^harness/(controller|gates|live)',
        pathNot: '^harness/controller/emit-event\\.mjs$',
      },
    },
    {
      name: 'controller-imports-nothing-above',
      comment:
        'The controller invokes gates as subprocesses so the verdict authority stays at the exit code — importing a gate would bypass that contract (D-11).',
      severity: 'error',
      from: { path: '^harness/controller' },
      to: { path: '^harness/(gates|hooks|live)' },
    },
    {
      name: 'nothing-imports-live',
      comment: 'live/ is the top-level wiring; nothing may depend on it.',
      severity: 'error',
      from: { path: '^harness/', pathNot: '^harness/live' },
      to: { path: '^harness/live' },
    },
    {
      name: 'no-prod-import-of-tests',
      comment: 'Production code must never import test files or fixtures.',
      severity: 'error',
      from: { path: '^harness/' },
      to: { path: '^(tests|fixtures)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    includeOnly: '^(harness|tests)/',
  },
};
