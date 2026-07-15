# Tasks — CHG-0028

- [x] 1.1 `.dependency-cruiser.cjs` with six named rationale-commented rules
      (no-circular, gates-only-resolve-and-telemetry, hooks-only-telemetry,
      controller-imports-nothing-above, nothing-imports-live,
      no-prod-import-of-tests); devDep pinned
- [x] 1.2 `npm run lint` extended with `depcruise harness tests`; green on
      the current 24-module graph; red drill — seeded gates→loop import
      failed lint naming the rule, reverted
- [x] 1.3 Rider: qs override ^6.15.2 (GHSA-q8mj-m7cp-5q26 via stryker →
      typed-rest-client); npm audit 0 vulnerabilities; suite 86 green
- [ ] 1.4 PR; merge; archive bundle
