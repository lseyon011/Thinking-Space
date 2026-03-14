import {
  STORAGE_KEYS,
  getJsonStorageItem,
  setJsonStorageItem,
} from '@/services/lego_blocks/units/storageKeyBlock'
import {
  buildAiWebsitePartitionBlock,
  generateAiWebsiteIdBlock,
  normalizeAiWebsitesBlock,
  type AiWebsiteBlock,
} from '@/services/lego_blocks/units/aiWebsiteBlock'
import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'

// ---------------------------------------------------------------------------
// Vault persistence — .thinking-space/preferences/ai-websites.json
// ---------------------------------------------------------------------------

const AI_WEB_DIR = '.thinking-space/preferences'
const AI_WEB_FILE = `${AI_WEB_DIR}/ai-websites.json`

async function ensureAiWebDirOrch(): Promise<void> {
  const fs = getVaultFS()
  try { await fs.mkdir('.thinking-space') } catch { /* exists */ }
  try { await fs.mkdir(AI_WEB_DIR) } catch { /* exists */ }
}

export async function readAiWebsitesOrch(): Promise<AiWebsiteBlock[]> {
  const fs = getVaultFS()
  try {
    const raw = await fs.read(AI_WEB_FILE)
    return normalizeAiWebsitesBlock(JSON.parse(raw))
  } catch {
    // File missing — check localStorage for one-time migration.
    const legacy = getJsonStorageItem<unknown[]>(STORAGE_KEYS.aiWebsites, [])
    if (legacy.length > 0) {
      const sites = normalizeAiWebsitesBlock(legacy)
      try {
        await ensureAiWebDirOrch()
        await fs.write(AI_WEB_FILE, JSON.stringify(sites, null, 2))
        setJsonStorageItem(STORAGE_KEYS.aiWebsites, [])
      } catch {
        // Migration write failed — return localStorage data anyway.
      }
      return sites
    }
    return []
  }
}

async function saveSitesOrch(sites: AiWebsiteBlock[]): Promise<void> {
  const fs = getVaultFS()
  await ensureAiWebDirOrch()
  await fs.write(AI_WEB_FILE, JSON.stringify(sites, null, 2))
}

export async function addAiWebsiteOrch(name: string, url: string): Promise<AiWebsiteBlock> {
  const id = generateAiWebsiteIdBlock()
  const entry: AiWebsiteBlock = {
    id,
    name: name.trim() || domainLabelBlock(url),
    url: url.trim(),
    partition: buildAiWebsitePartitionBlock(id),
  }
  const sites = await readAiWebsitesOrch()
  sites.push(entry)
  await saveSitesOrch(sites)
  return entry
}

export async function removeAiWebsiteOrch(id: string): Promise<void> {
  const sites = (await readAiWebsitesOrch()).filter(s => s.id !== id)
  await saveSitesOrch(sites)
}

export async function updateAiWebsiteOrch(id: string, patch: Partial<Pick<AiWebsiteBlock, 'name' | 'url'>>): Promise<void> {
  const sites = (await readAiWebsitesOrch()).map(s =>
    s.id === id ? { ...s, ...patch } : s,
  )
  await saveSitesOrch(sites)
}

function domainLabelBlock(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return 'AI Website' }
}
