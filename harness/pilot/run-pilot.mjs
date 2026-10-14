#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emit } from '../controller/emit-event.mjs';
import { runFixturePilot } from './fixture.mjs';
import { loadPilotConfig } from './input.mjs';

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('--'));
if (!input) {
  process.stderr.write('usage: node harness/pilot/run-pilot.mjs <pilot.json> [--state-dir=<path>]\n');
  process.exit(1);
}
const stateArg = args.find((arg) => arg.startsWith('--state-dir='));
const root = stateArg
  ? path.resolve(stateArg.slice('--state-dir='.length))
  : fs.mkdtempSync(path.join(os.tmpdir(), 'code-build-harness-pilot-'));

try {
  const config = loadPilotConfig(path.resolve(process.cwd(), input));
  const result = await runFixturePilot(config, { root, emit });
  process.stdout.write(`${JSON.stringify({ ...result, stateDir: root }, null, 2)}\n`);
  process.exit(result.status === 'approved' ? 0 : 2);
} catch (error) {
  process.stderr.write(`pilot failed closed: ${error.message}\n`);
  process.exit(2);
}
