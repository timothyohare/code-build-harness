# Design — CHG-0020

- **Shim mechanism**: `await import('<new path>')` for the four CLIs (the new
  scripts execute at module top level against the same process argv/stdin, so
  exit codes, stdin protocol, and stderr are inherited exactly);
  `export * from` for the lib. No spawn, no drift surface.
- **Silent shims**: no deprecation banner on stderr — gate-ci's stderr feeds
  Stop-hook feedback and run-live's failure details; noise there has a cost.
  The shim's header comment carries the pointer.
- **Backups kept locally** (`.legacy-originals-2026-07-06/`) rather than in the
  repo: the ported files already ARE the code, verified equivalent; the backup
  only insures the removal window and is deleted with the shims.
