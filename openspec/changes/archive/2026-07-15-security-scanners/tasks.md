# Tasks — CHG-0023

- [x] 1.1 `.github/workflows/security.yml`: `pull_request` trigger; parallel
      jobs semgrep (`semgrep scan --config auto --error` in the
      `semgrep/semgrep` container), gitleaks (`gitleaks/gitleaks-action@v2`,
      `fetch-depth: 0`), trivy (`aquasecurity/trivy-action`, fs scan,
      HIGH/CRITICAL, exit-code 1)
- [x] 1.2 Local proof where possible: workflow YAML parses; scanners the
      machine can run locally (via docker) exit 0 on the current tree
      (actionlint 0; semgrep 0 findings after 2 reviewed nosemgrep
      suppressions on harness.json boot spawns; gitleaks 48 commits clean;
      trivy 0 HIGH/CRITICAL)
- [x] 1.3 PR (carries legacy-shims bundle archive move); `harness-config-approved`
      label from Tim (.github/** is protected); all three scanner checks
      green on the PR itself — the PR is the live drill (PR #25: semgrep,
      gitleaks, trivy all green; guard green after label)
- [x] 1.4 Follow-up recorded: Tim adds the three checks to the branch
      ruleset's required checks once stable (done 2026-07-15: semgrep,
      gitleaks, trivy added to main-protection ruleset required checks)
- [x] 1.5 Merge; archive bundle (merged as dd3769f, PR #25; archived
      2026-07-15)
