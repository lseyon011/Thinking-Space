// Rough per-million-token prices for the models we see in transcripts.
// Numbers are USD and approximate — vendor pricing changes over time. Keep
// the table small and explicit; we surface "~$X.XX est." rather than precise
// billing to set expectations.
//
// Sources (point-in-time, update as needed):
//   - Anthropic Opus 4.5 / 4.6 / 4.7:  $5 input / $25 output / $0.50 cache-read / $6.25 cache-write-5m
//   - Anthropic Opus 4.0–4.4 (legacy): $15 / $75 / $1.50 / $18.75
//   - Anthropic Sonnet 4.x: $3 input / $15 output / cache-read 10% of input
//   - Anthropic Haiku 4.x:  $1 input / $5 output / cache-read 10% of input
//   - OpenAI GPT-5: ~$1.25 input / $10 output
//   - Anthropic cache *creation* has two TTLs priced differently:
//       5m TTL ≈ 1.25x input, 1h TTL ≈ 2.0x input. We split on the parsed
//       `cacheCreation1h` portion; the remainder is treated as 5m.

import type { SessionTokens } from '@/services/lego_blocks/units/aiActivityParserBlock'

interface PricePerMillion {
  /** Fresh input tokens. */
  input: number
  /** Output tokens. */
  output: number
  /** Cache-read input tokens (10% of fresh on Anthropic). */
  cacheRead: number
  /** Cache-creation 5-minute TTL (1.25x input on Anthropic). */
  cacheCreation5m: number
  /** Cache-creation 1-hour TTL (2.0x input on Anthropic). Same as 5m when the
   *  provider doesn't differentiate (OpenAI). */
  cacheCreation1h: number
}

const FALLBACK_PRICE: PricePerMillion = {
  input: 3,
  output: 15,
  cacheRead: 0.3,
  cacheCreation5m: 3.75,
  cacheCreation1h: 6,
}

const PRICES: ReadonlyArray<{ match: RegExp; price: PricePerMillion }> = [
  // Anthropic Opus 4.5 / 4.6 / 4.7 — new pricing: 5 input, 25 output, 0.50
  // cache-read, 6.25 / 10 cache-create (5m / 1h). Must match BEFORE the legacy
  // /opus/ rule so 4.0–4.4 model ids continue to bill at the old rate.
  {
    match: /opus-4-(5|6|7)/i,
    price: { input: 5, output: 25, cacheRead: 0.5, cacheCreation5m: 6.25, cacheCreation1h: 10 },
  },
  // Anthropic Opus 4.0–4.4 (legacy) — 15 input, 75 output, 1.5 cache-read,
  // 18.75 / 30 cache-create.
  {
    match: /opus/i,
    price: { input: 15, output: 75, cacheRead: 1.5, cacheCreation5m: 18.75, cacheCreation1h: 30 },
  },
  // Anthropic Sonnet family.
  {
    match: /sonnet/i,
    price: { input: 3, output: 15, cacheRead: 0.3, cacheCreation5m: 3.75, cacheCreation1h: 6 },
  },
  // Anthropic Haiku family.
  {
    match: /haiku/i,
    price: { input: 1, output: 5, cacheRead: 0.1, cacheCreation5m: 1.25, cacheCreation1h: 2 },
  },
  // OpenAI GPT-5 — no TTL split, both buckets priced as cache-write equivalent.
  {
    match: /^gpt-5/i,
    price: { input: 1.25, output: 10, cacheRead: 0.125, cacheCreation5m: 1.25, cacheCreation1h: 1.25 },
  },
  // OpenAI o-series (rough mid-tier estimate).
  {
    match: /^o3|^o4/i,
    price: { input: 2, output: 8, cacheRead: 0.5, cacheCreation5m: 2, cacheCreation1h: 2 },
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
  const cache1h = Math.min(tokens.cacheCreation1h ?? 0, tokens.cacheCreation)
  const cache5m = Math.max(0, tokens.cacheCreation - cache1h)
  const usd =
    (tokens.input * p.input +
      tokens.output * p.output +
      tokens.cacheRead * p.cacheRead +
      cache5m * p.cacheCreation5m +
      cache1h * p.cacheCreation1h) /
    1_000_000
  return usd
}

/** Sum a list of token bundles. Caller is responsible for grouping by model
 *  if they want per-model cost; we just add the counts. */
export function sumTokens(list: ReadonlyArray<SessionTokens | undefined>): SessionTokens {
  const out: SessionTokens = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheCreation: 0,
    cacheCreation1h: 0,
  }
  for (const t of list) {
    if (!t) continue
    out.input += t.input
    out.output += t.output
    out.cacheRead += t.cacheRead
    out.cacheCreation += t.cacheCreation
    out.cacheCreation1h = (out.cacheCreation1h ?? 0) + (t.cacheCreation1h ?? 0)
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
