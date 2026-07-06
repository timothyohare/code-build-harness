#!/usr/bin/env node
// Mutation gate (M2): grade the graders. Runs the project's bound mutation
// command (StrykerJS with thresholds.break doing the verdict), then reads the
// JSON report to print a survivor summary — the feedback the loop's
// test-writer needs to strengthen weak tests — and emits telemetry.
//
// Binding keys:
//   mutation        the command (e.g. "npx stryker run")            [required, else no-op]
//   mutationReport  JSON report path (default reports/mutation/mutation.json)
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emit } from '../controller/emit-event.mjs';
import { loadConfig } from './resolve.mjs';

const { root, config } = loadConfig();
const log = (m) => process.stderr.write(`${m}\n`);

if (!config.mutation) {
  log('• gate-mutation: no mutation command configured — skipping.');
  process.exit(0);
}

const started = Date.now();
let commandFailed = false;
log(`▶ gate-mutation: ${config.mutation}`);
try {
  execSync(config.mutation, { cwd: root, stdio: 'inherit' });
} catch {
  commandFailed = true;
}

// Survivor summary from the Stryker JSON report (best-effort — the verdict is
// the command's exit code; the report only enriches feedback + telemetry).
let stats = null;
const survivors = [];
try {
  const reportPath = join(root, config.mutationReport ?? 'reports/mutation/mutation.json');
  if (existsSync(reportPath)) {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    let detected = 0;
    let undetected = 0;
    for (const [file, data] of Object.entries(report.files ?? {})) {
      for (const m of data.mutants ?? []) {
        if (m.status === 'Killed' || m.status === 'Timeout') detected++;
        if (m.status === 'Survived' || m.status === 'NoCoverage') {
          undetected++;
          survivors.push({
            file,
            line: m.location?.start?.line ?? null,
            mutator: m.mutatorName,
            replacement: m.replacement,
          });
        }
      }
    }
    const total = detected + undetected;
    stats = { detected, undetected, score: total ? Math.round((detected / total) * 1000) / 10 : null };
  }
} catch {}

if (survivors.length) {
  log(`\n✗ ${survivors.length} surviving mutant(s) — tests that let these live are too weak:`);
  for (const s of survivors.slice(0, 20)) {
    log(`  ${s.file}:${s.line} ${s.mutator} → ${JSON.stringify(s.replacement)}`);
  }
}

// Telemetry is best-effort: a metrics write failure must never flip the verdict.
try {
  emit({
    event: 'validate.gate_run',
    phase: 'validate',
    result: commandFailed ? 'fail' : 'pass',
    duration_ms: Date.now() - started,
    detail: { gate: 'mutation', root, ...(stats ?? {}), survivors: survivors.slice(0, 20) },
  });
} catch {}

if (commandFailed) {
  log('\n✗ gate-mutation failed: mutation score below break threshold (or run error).');
  log("Strengthen the surviving mutants' tests; do not lower the threshold to pass.");
  process.exit(1);
}
log('\n✓ gate-mutation passed');
process.exit(0);
