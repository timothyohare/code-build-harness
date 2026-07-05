#!/usr/bin/env node
// CLI over the harness resolver (D-25 port of ~/.claude/bin/harness-resolve.mjs).
//
//   resolve-cli.mjs            # print full resolved config as JSON
//   resolve-cli.mjs --json     # same
//   resolve-cli.mjs --root     # print the detected project root
//   resolve-cli.mjs <key>      # print the resolved command for <key>
//                              # (exit 3 if that key is not defined)
import { loadConfig } from './resolve.mjs';

const args = process.argv.slice(2);
const { root, config, hasExplicit } = loadConfig();

if (args.length === 0 || args[0] === '--json') {
  process.stdout.write(JSON.stringify({ root, hasExplicit, config }, null, 2) + '\n');
  process.exit(0);
}
if (args[0] === '--root') {
  process.stdout.write(root + '\n');
  process.exit(0);
}

const val = config[args[0]];
if (val == null) process.exit(3);
process.stdout.write(String(val) + '\n');
