// Auto-detect the loaded model id from any OpenAI-compatible local server
// (LM Studio, MLX `mlx_lm.server`, llama.cpp, vLLM…) by probing `/v1/models`.
// Lets users configure just a base URL in AI Settings and have the rest of
// the app pick up whatever model is currently loaded.
//
// Cached per base URL with a short TTL so swapping the loaded model in LM
// Studio is picked up within ~1 min without re-probing on every call.

import { DEFAULT_OPENSOURCE_AI_BASE_URL } from '@/services/lego_blocks/integrations/aiCredentialStoreBlock'

export function normalizeOpenSourceAiBaseUrlBlock(raw: string | null | undefined): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  const normalized = (trimmed || DEFAULT_OPENSOURCE_AI_BASE_URL).replace(/\/+$/, '')
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`
}

interface CacheEntry {
  at: number
  model: string | null
}

const CACHE_TTL_MS = 60_000
const PROBE_TIMEOUT_MS = 5_000
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<string | null>>()

export function invalidateOpenSourceAiModelCacheBlock(baseUrl?: string): void {
  if (!baseUrl) {
    cache.clear()
    return
  }
  cache.delete(normalizeOpenSourceAiBaseUrlBlock(baseUrl))
}

export async function discoverOpenSourceAiModelBlock(
  baseUrlRaw: string | null | undefined,
  apiKey?: string,
  force = false,
): Promise<string | null> {
  const baseUrl = normalizeOpenSourceAiBaseUrlBlock(baseUrlRaw)
  if (!force) {
    const cached = cache.get(baseUrl)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.model
    const pending = inflight.get(baseUrl)
    if (pending) return pending
  }

  const probe = (async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: controller.signal,
      })
      if (!res.ok) {
        cache.set(baseUrl, { at: Date.now(), model: null })
        return null
      }
      const body = (await res.json()) as { data?: Array<{ id?: string }> }
      const first = body?.data?.find(m => typeof m.id === 'string' && m.id.trim())?.id ?? null
      cache.set(baseUrl, { at: Date.now(), model: first })
      return first
    } catch {
      cache.set(baseUrl, { at: Date.now(), model: null })
      return null
    } finally {
      clearTimeout(timeout)
      inflight.delete(baseUrl)
    }
  })()

  inflight.set(baseUrl, probe)
  return probe
}
