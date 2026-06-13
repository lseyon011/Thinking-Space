// Renderer-side access to GoodNotes reading activity.
//
// On Electron: trigger a harvest of the ephemeral Amplitude queue into the
// durable vault JSONL (which also arms the background watcher), then read the
// log back over IPC. On non-Electron clients (iPhone/web) the IPC isn't
// present, but the durable log lives in the vault and syncs — so we read and
// parse `ai_raw/raw/goodnotes/reading.jsonl` straight through VaultFS. Either
// way the caller gets the same ParsedSession[] tagged source:'goodnotes'.

import type { VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import type { ParsedSession } from '@/services/lego_blocks/units/aiActivityParserBlock'
import {
  parseGoodnotesReadingLog,
  type GoodnotesReadingRecord,
} from '@/services/lego_blocks/units/goodnotesReadingParserBlock'
import { getStoredVaultRoot } from '@/services/lego_blocks/units/storageKeyBlock'

const READING_LOG_PATH = 'ai_raw/raw/goodnotes/reading.jsonl'

interface GoodnotesApi {
  goodnotesHarvest?: (
    vaultRoot: string,
  ) => Promise<{ added: number; total: number; unavailable?: boolean }>
  goodnotesReadLog?: (vaultRoot: string) => Promise<GoodnotesReadingRecord[]>
}

function getApi(): GoodnotesApi | null {
  if (typeof window === 'undefined') return null
  const api = (window as unknown as { electronAPI?: GoodnotesApi }).electronAPI
  if (!api?.goodnotesHarvest || !api.goodnotesReadLog) return null
  return api
}

function parseLogText(text: string): GoodnotesReadingRecord[] {
  const out: GoodnotesReadingRecord[] = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      out.push(JSON.parse(t) as GoodnotesReadingRecord)
    } catch {
      // Skip a corrupt line rather than dropping the whole log.
    }
  }
  return out
}

/**
 * Load GoodNotes reading sessions. Electron harvests fresh first (best-effort —
 * a harvest failure still returns whatever's already logged); other platforms
 * read the synced vault log. Returns [] when GoodNotes/the log isn't present.
 */
export async function loadGoodnotesReadingSessions(fs: VaultFS): Promise<ParsedSession[]> {
  const api = getApi()
  if (api) {
    const vaultRoot = getStoredVaultRoot() ?? ''
    try {
      await api.goodnotesHarvest!(vaultRoot)
    } catch {
      // Harvest failed (no GoodNotes, sqlite missing, etc.) — fall through and
      // return whatever the durable log already holds.
    }
    try {
      const records = (await api.goodnotesReadLog!(vaultRoot)) ?? []
      return parseGoodnotesReadingLog(records)
    } catch {
      return []
    }
  }

  // Non-Electron: read the synced durable log directly from the vault.
  try {
    if (!(await fs.exists(READING_LOG_PATH))) return []
    const text = await fs.read(READING_LOG_PATH)
    return parseGoodnotesReadingLog(parseLogText(text))
  } catch {
    return []
  }
}
