import {
  STORAGE_KEYS,
  getJsonStorageItem,
  setJsonStorageItem,
} from '@/services/lego_blocks/units/storageKeyBlock'
import {
  buildWebSitePartitionBlock,
  domainLabelWebSiteBlock,
  generateWebSiteGroupIdBlock,
  generateWebSiteIdBlock,
  normalizeWebSitePreferencesBlock,
  type WebSiteBlock,
  type WebSiteGroupBlock,
  type WebSitePreferencesBlock,
} from '@/services/lego_blocks/units/webSiteBlock'
import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'

// ---------------------------------------------------------------------------
// Vault persistence — .thinking-space/preferences/web-sites.json
// ---------------------------------------------------------------------------

const WEB_DIR = '.thinking-space/preferences'
const WEB_FILE = `${WEB_DIR}/web-sites.json`

async function ensureWebDirOrch(): Promise<void> {
  const fs = getVaultFS()
  try { await fs.mkdir('.thinking-space') } catch { /* exists */ }
  try { await fs.mkdir(WEB_DIR) } catch { /* exists */ }
}

export async function readWebSitePreferencesOrch(): Promise<WebSitePreferencesBlock> {
  const fs = getVaultFS()
  try {
    const raw = await fs.read(WEB_FILE)
    return normalizeWebSitePreferencesBlock(JSON.parse(raw))
  } catch {
    // File missing — check localStorage for one-time migration.
    const legacy = getJsonStorageItem<unknown>(STORAGE_KEYS.webSites, null)
    if (legacy !== null) {
      const prefs = normalizeWebSitePreferencesBlock(legacy)
      try {
        await ensureWebDirOrch()
        await fs.write(WEB_FILE, JSON.stringify(prefs, null, 2))
        setJsonStorageItem(STORAGE_KEYS.webSites, null)
      } catch {
        // Migration write failed — return localStorage data anyway.
      }
      return prefs
    }
    return normalizeWebSitePreferencesBlock(null)
  }
}

async function savePrefsOrch(prefs: WebSitePreferencesBlock): Promise<void> {
  const fs = getVaultFS()
  await ensureWebDirOrch()
  await fs.write(WEB_FILE, JSON.stringify(prefs, null, 2))
}

export async function addWebSiteOrch(name: string, url: string, groupId: string | null): Promise<WebSiteBlock> {
  const prefs = await readWebSitePreferencesOrch()
  const id = generateWebSiteIdBlock()
  const entry: WebSiteBlock = {
    id,
    name: name.trim() || domainLabelWebSiteBlock(url),
    url: url.trim(),
    partition: buildWebSitePartitionBlock(id),
    groupId,
  }
  prefs.bookmarks.push(entry)
  await savePrefsOrch(prefs)
  return entry
}

export async function removeWebSiteOrch(id: string): Promise<void> {
  const prefs = await readWebSitePreferencesOrch()
  prefs.bookmarks = prefs.bookmarks.filter(b => b.id !== id)
  await savePrefsOrch(prefs)
}

export async function updateWebSiteOrch(id: string, patch: Partial<Pick<WebSiteBlock, 'name' | 'url' | 'groupId'>>): Promise<void> {
  const prefs = await readWebSitePreferencesOrch()
  prefs.bookmarks = prefs.bookmarks.map(b => b.id === id ? { ...b, ...patch } : b)
  await savePrefsOrch(prefs)
}

export async function addWebSiteGroupOrch(name: string, parentGroupId: string | null = null): Promise<WebSiteGroupBlock> {
  const prefs = await readWebSitePreferencesOrch()
  const group: WebSiteGroupBlock = { id: generateWebSiteGroupIdBlock(), name: name.trim(), parentGroupId }
  prefs.groups.push(group)
  await savePrefsOrch(prefs)
  return group
}

export async function removeWebSiteGroupOrch(groupId: string): Promise<void> {
  const prefs = await readWebSitePreferencesOrch()
  // Cascade: collect group + all descendants
  const idsToRemove = new Set<string>()
  function collect(id: string) {
    idsToRemove.add(id)
    for (const g of prefs.groups) if (g.parentGroupId === id) collect(g.id)
  }
  collect(groupId)
  prefs.groups = prefs.groups.filter(g => !idsToRemove.has(g.id))
  prefs.bookmarks = prefs.bookmarks.map(b => b.groupId && idsToRemove.has(b.groupId) ? { ...b, groupId: null } : b)
  await savePrefsOrch(prefs)
}

export async function updateWebSiteGroupOrch(groupId: string, name: string): Promise<void> {
  const prefs = await readWebSitePreferencesOrch()
  prefs.groups = prefs.groups.map(g => g.id === groupId ? { ...g, name: name.trim() } : g)
  await savePrefsOrch(prefs)
}
