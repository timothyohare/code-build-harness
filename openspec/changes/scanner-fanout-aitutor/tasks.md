# Tasks — CHG-0029

- [ ] 1.1 Local first scan: semgrep + gitleaks + trivy via docker against
      aitutor's full local tree and history; classify every finding
      (real fix / inline suppression)
- [ ] 1.2 Branch from `origin/main`: caller workflow
      `.github/workflows/security.yml` + triage files; push; PR; all three
      `security / *` checks green on the PR itself (live drill)
- [ ] 1.3 Record the enforcement gap: private + free plan = no rulesets, so
      checks report but cannot be required — noted in proposal Impact and
      legacy-parity/fan-out follow-ups
- [ ] 1.4 Rider: reusable workflow permissions fix (drop capping
      `permissions:` block; callers own least privilege) — needs
      harness-config-approved
- [ ] 1.5 Merge both PRs; archive bundle
