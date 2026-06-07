// Rough per-million-token prices for the models we see in transcripts.
// Numbers are USD and approximate — vendor pricing changes over time. Keep
// the table small and explicit; we surface "~$X.XX est." rather than precise
// billing to set expectations.
//
// Sources (point-in-time, update as needed):
//   - Anthropic Opus 4.x:  $15 input / $75 output / cache-read ~10% of input
//   - Anthropic Sonnet 4.x: $3 input / $15 output / cache-read ~10% of input
//   - Anthropic Haiku 4.x:  $1 input / $5 output / cache-read ~10% of input
//   - OpenAI GPT-5: ~$1.25 input / $10 output
//   - Cache *creation* tokens cost slightly more than fresh input (5m ~125%, 1h ~200%)
//     — averaged here.

import type { SessionTokens } from '@/services/lego_blocks/units/aiActivityParserBlock'

interface PricePerMillion {
  /** Fresh input tokens. */
  input: number
  /** Output tokens. */
  output: number
  /** Cache-read input tokens (usually ~10% of fresh). */
  cacheRead: number
  /** Cache-creation tokens (usually ~125% of fresh; averaging short+long TTL). */
  cacheCreation: number
}

const FALLBACK_PRICE: PricePerMillion = {
  input: 3,
  output: 15,
  cacheRead: 0.3,
  cacheCreation: 3.75,
}

const PRICES: ReadonlyArray<{ match: RegExp; price: PricePerMillion }> = [
  // Anthropic Opus family
  {
    match: /opus/i,
    price: { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 },
  },
  // Anthropic Sonnet family
  {
    match: /sonnet/i,
    price: { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 },
  },
  // Anthropic Haiku family
  {
    match: /haiku/i,
    price: { input: 1, output: 5, cacheRead: 0.1, cacheCreation: 1.25 },
  },
  // OpenAI GPT-5
  {
    match: /^gpt-5/i,
    price: { input: 1.25, output: 10, cacheRead: 0.125, cacheCreation: 1.25 },
  },
  // OpenAI o-series (rough mid-tier estimate)
  {
    match: /^o3|^o4/i,
    price: { input: 2, output: 8, cacheRead: 0.5, cacheCreation: 2 },
  },
]

export function priceForModel(model: string | undefined): PricePerMillion {
  if (!model) return FALLBACK_PRICE
  for (const { match, price } of PRICES) {
    if (match.test(model)) return price
  }
  return FALLBACK_PRICE
}

/**
 * Convert token counts to a dollar estimate. `model` decides the price tier.
 * Returns the dollar amount (e.g. 0.42) — formatters live in the UI.
 */
export function estimateCostUsd(tokens: SessionTokens, model: string | undefined): number {
  const p = priceForModel(model)
  const usd =
    (tokens.input * p.input +
      tokens.output * p.output +
      tokens.cacheRead * p.cacheRead +
      tokens.cacheCreation * p.cacheCreation) /
    1_000_000
  return usd
}

/** Sum a list of token bundles. Caller is responsible for grouping by model
 *  if they want per-model cost; we just add the counts. */
export function sumTokens(list: ReadonlyArray<SessionTokens | undefined>): SessionTokens {
  const out: SessionTokens = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }
  for (const t of list) {
    if (!t) continue
    out.input += t.input
    out.output += t.output
    out.cacheRead += t.cacheRead
    out.cacheCreation += t.cacheCreation
  }
  return out
}

/** Compact "1.2M" / "850K" / "342" formatter. */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

/** "$0.42" / "$12.30" / "<$0.01" formatter. */
export function formatUsd(n: number): string {
  if (n < 0.01) return '<$0.01'
  if (n < 1) return `$${n.toFixed(2)}`
  if (n < 100) return `$${n.toFixed(2)}`
  return `$${n.toFixed(0)}`
}
