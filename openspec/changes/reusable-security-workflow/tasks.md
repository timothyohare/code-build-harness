# Tasks — CHG-0024

- [x] 1.1 `.github/workflows/security-reusable.yml` (`workflow_call`, three
      jobs from CHG-0023, `include-dev-deps` input → `TRIVY_INCLUDE_DEV_DEPS`);
      `security.yml` rewritten as same-repo caller passing
      `include-dev-deps: true`. Local proof: actionlint green on both.
- [ ] 1.2 PR to this repo; `harness-config-approved` label from Tim
      (.github/** protected); read the actual nested check contexts off the
      PR run, update `main-protection` required checks
      (`semgrep`→`security / semgrep` etc.), merge.
- [ ] 1.3 nrl-predictor triage (pre-scanned 2026-07-15): SHA-pin
      `ci.yml` actions (fixes 2 semgrep mutable-tag findings); inline
      `# nosemgrep` on `fetcher-spikes/run_spikes.py:29` (intentional
      dynamic import) and `scripts/gate/acceptance.py:20` (intentional
      dynamic urllib); `.gitleaksignore` with the 20 fingerprints for
      CloudFormation asset hashes in `tasks/baseline/v{1,2}.template.json`
      @ 5fa28ada. Local proof: all three scanners exit 0 via docker
      (trivy with `--skip-dirs .venv,infra/cdk.out` — untracked local dirs).
- [ ] 1.4 nrl-predictor caller `.github/workflows/security.yml`
      (`uses: timothyohare/code-build-harness/.github/workflows/security-reusable.yml@main`);
      PR after 1.2 merges; all three scanner checks green on the PR —
      cross-repo live drill.
- [ ] 1.5 Follow-up recorded: fan-out to kickpool/aitutor/remaining repos +
      per-repo required-check wiring once stable. Merge; archive bundle.
