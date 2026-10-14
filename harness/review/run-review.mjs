#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCodexExecutor } from '../controller/executors/codex-cli.mjs';
import { createReviewRunner } from './runner.mjs';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const root = process.cwd();
const here = path.dirname(fileURLToPath(import.meta.url));
const executor = createCodexExecutor({ cwd: root, outputSchema: path.join(here, 'review.schema.json') });
const runReview = createReviewRunner({ executor });

try {
  const evidence = JSON.parse(await readStdin());
  const result = await runReview(evidence);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.review.blocking || result.routed.builder.length || result.routed['test-writer'].length ? 2 : 0);
} catch (error) {
  process.stderr.write(`review failed closed: ${error.message}\n`);
  process.exit(2);
}
