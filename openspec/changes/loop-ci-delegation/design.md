# Design — CHG-0018

One-line rewiring. `--force` is required because the loop's ci gate must run
even when the working tree looks clean to the source-extension filter (the
builder may have just committed, or touched only config). Verified by invoking
the gate exactly as run-live does (execSync, piped stdio, 120s timeout) —
exit 0 and a `validate.gate_run` pass event.
