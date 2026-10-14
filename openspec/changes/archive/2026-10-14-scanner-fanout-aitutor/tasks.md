# Tasks — CHG-0029

- [x] 1.1 Local first scan: semgrep + gitleaks + trivy via docker against
      aitutor's full local tree and history; classify every finding
      (real fix / inline suppression)
- [x] 1.2 Branch from `origin/main`: caller workflow
      `.github/workflows/security.yml` + triage files; push; PR; all three
      `security / *` checks green on the PR itself (live drill) — aitutor
      PR #8 (merged 2026-07-21): caller + 16 HIGH/CRITICAL vuln fixes +
      supply-chain hardening; `.trivyignore.yaml` DS-0002 (Lambda image USER)
      reviewed suppression; scanners green on aitutor PRs through 2026-10-14
- [x] 1.3 Record the enforcement gap: private + free plan = no rulesets, so
      checks report but cannot be required — noted in proposal Impact
      (re-confirmed 2026-10-14: rulesets API still 403 "Upgrade to GitHub Pro")
- [x] 1.4 Rider: reusable workflow permissions fix (drop capping
      `permissions:` block; callers own least privilege) — harness PR #36
      (bdadb2c); aitutor caller grants `pull-requests: read` (f492fab)
- [x] 1.5 Merge both PRs; archive bundle (archived 2026-10-14 with CHG-0031)
