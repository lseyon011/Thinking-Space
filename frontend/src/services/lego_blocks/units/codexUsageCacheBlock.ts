import type { CodexUsageProbeResultBlock } from './codexUsageProbeBlock'
import { getVaultFS } from '../integrations/fsBlock'

const PROBE_CACHE_STALE_MS = 5 * 60 * 1000 // 5 minutes
const VAULT_CACHE_PATH = '.thinking-space/codex-usage-cache.json'
const VAULT_SAVE_DEBOUNCE_MS = 3000

// Module-level in-session cache — survives tab switches in the same Electron session.
let inMemoryCache: Record<string, CodexUsageProbeResultBlock> = {}
let vaultSaveTimerId: ReturnType<typeof setTimeout> | null = null

export function getInMemoryProbeCache(): Record<string, CodexUsageProbeResultBlock> {
  return inMemoryCache
}

export function updateInMemoryProbeCache(result: CodexUsageProbeResultBlock): void {
  inMemoryCache = { ...inMemoryCache, [result.siteId]: result }
  scheduleVaultSave()
}

export function isProbeResultFreshBlock(
  result: CodexUsageProbeResultBlock | null | undefined,
): boolean {
  if (!result?.detectedAt) return false
  return Date.now() - new Date(result.detectedAt).getTime() < PROBE_CACHE_STALE_MS
}

function scheduleVaultSave(): void {
  if (vaultSaveTimerId !== null) clearTimeout(vaultSaveTimerId)
  vaultSaveTimerId = setTimeout(() => {
    vaultSaveTimerId = null
    void flushProbeResultsToVaultBlock()
  }, VAULT_SAVE_DEBOUNCE_MS)
}

export async function flushProbeResultsToVaultBlock(): Promise<void> {
  try {
    await getVaultFS().write(VAULT_CACHE_PATH, JSON.stringify(inMemoryCache, null, 2))
  } catch {
    // Non-critical — cache write failures don't break the UI
  }
}

export async function loadProbeResultsFromVaultBlock(): Promise<
  Record<string, CodexUsageProbeResultBlock>
> {
  try {
    const text = await getVaultFS().read(VAULT_CACHE_PATH)
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, CodexUsageProbeResultBlock>
    }
  } catch {
    // File doesn't exist or parse error — return empty
  }
  return {}
}

export function seedInMemoryProbeCache(
  vaultData: Record<string, CodexUsageProbeResultBlock>,
): void {
  // Merge vault data into the in-memory cache without overwriting fresher in-memory entries
  const merged: Record<string, CodexUsageProbeResultBlock> = { ...vaultData }
  for (const [siteId, result] of Object.entries(inMemoryCache)) {
    merged[siteId] = result
  }
  inMemoryCache = merged
}
