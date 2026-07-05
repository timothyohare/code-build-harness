import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costUsd } from '../src/cost.mjs';

test('costUsd charges input-only usage at the pricing rate', () => {
  const cost = costUsd({ model: 'm1', tokens_in: 1_000_000, tokens_out: 0 }, { m1: { in: 5, out: 25 } });
  assert.equal(cost, 5);
});

test('costUsd sums input and output cost', () => {
  const cost = costUsd({ model: 'm1', tokens_in: 500_000, tokens_out: 200_000 }, { m1: { in: 5, out: 25 } });
  assert.equal(cost, 7.5);
});

test('costUsd returns null when the model is absent from pricing', () => {
  const cost = costUsd({ model: 'unknown', tokens_in: 10, tokens_out: 10 }, { m1: { in: 5, out: 25 } });
  assert.equal(cost, null);
});

test('costUsd treats missing token counts as zero', () => {
  const cost = costUsd({ model: 'm1' }, { m1: { in: 5, out: 25 } });
  assert.equal(cost, 0);
});
