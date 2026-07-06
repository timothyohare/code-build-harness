# Design — CHG-0019

- **One status-flip note, not 20 row edits.** The matrix rows keep their
  original 🔜 text as written; a dated blockquote above the tables flips them
  all at once with CHG references. Cheaper to read as history and a smaller
  diff.
- **Step 6 stays open on purpose.** Replacing legacy files under `~/.claude/`
  with shims is the one action that changes behavior outside this repo for
  every session on the machine; the execution record notes it as
  human-gated. The Stop-hook repoint (step 4) is recorded with its one-line
  rollback.
