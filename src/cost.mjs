/**
 * Compute the USD cost of a single model call.
 *
 * @param {{ model: string, tokens_in?: number|null, tokens_out?: number|null }} usage
 * @param {Record<string, { in: number, out: number }>} pricing
 *   model id → USD per million input / output tokens.
 * @returns {number|null} cost in USD, or null when the model is absent from pricing.
 */
export function costUsd(usage, pricing) {
  const rate = pricing[usage.model];
  if (!rate) return null;
  const tokensIn = usage.tokens_in ?? 0;
  const tokensOut = usage.tokens_out ?? 0;
  return (tokensIn * rate.in + tokensOut * rate.out) / 1_000_000;
}
