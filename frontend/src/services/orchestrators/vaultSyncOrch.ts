// Vault sync orchestrator — scans vault .md files, parses YAML frontmatter,
// and populates IndexedDB cache. Handles full and incremental syncs.

import { getVaultFS } from '../lego_blocks/fsBlock'
import type { VaultFS, VaultEntry } from '../lego_blocks/fsBlock'
import {
  parseNote,
  hasFrontmatter,
  type YAMLFrontmatter,
} from '../lego_blocks/yamlNoteBlock'
import {
  upsertNode,
  deleteNodeByPath,
  getAllFilePaths,
  clearAll,
  getNodeCount,
  type NodeRecord,
} from '../lego_blocks/dbBlock'

// ── Types ──

export interface SyncResult {
  totalFiles: number
  parsedNodes: number
  skippedFiles: number
  deletedNodes: number
  errors: Array<{ path: string; error: string }>
  durationMs: number
}

// ── Public API ──

/**
 * Full vault sync — clears IndexedDB and rebuilds from all .md files.
 * Use on first load or when cache is suspected corrupt.
 */
export async function fullSync(fs?: VaultFS): Promise<SyncResult> {
  const vaultFs = fs ?? getVaultFS()
  const start = Date.now()

  await clearAll()

  const entries = await vaultFs.walkVault(['.md'])
  const result = await syncEntries(vaultFs, entries)

  result.durationMs = Date.now() - start
  return result
}

/**
 * Incremental sync — only process files modified after the given timestamp.
 * Also detects and removes deleted files from cache.
 */
export async function incrementalSync(
  sinceTimestamp: number,
  fs?: VaultFS,
): Promise<SyncResult> {
  const vaultFs = fs ?? getVaultFS()
  const start = Date.now()

  const allEntries = await vaultFs.walkVault(['.md'])

  // Find files modified since last sync
  const updatedEntries = allEntries.filter(e => e.mtime > sinceTimestamp)

  // Detect deleted files
  const currentPaths = new Set(allEntries.map(e => e.path))
  const cachedPaths = await getAllFilePaths()
  let deletedCount = 0
  for (const cachedPath of cachedPaths) {
    if (!currentPaths.has(cachedPath)) {
      await deleteNodeByPath(cachedPath)
      deletedCount++
    }
  }

  const result = await syncEntries(vaultFs, updatedEntries)
  result.deletedNodes = deletedCount
  result.totalFiles = allEntries.length
  result.durationMs = Date.now() - start

  return result
}

/**
 * Sync a single file — read, parse, and upsert into cache.
 * Useful when a file is saved/created.
 */
export async function syncSingleFile(
  filePath: string,
  fs?: VaultFS,
): Promise<boolean> {
  const vaultFs = fs ?? getVaultFS()

  try {
    const content = await vaultFs.read(filePath)
    if (!hasFrontmatter(content)) return false

    const note = parseNote(content)
    if (!note) return false

    const record = frontmatterToRecord(note.frontmatter, filePath, note.body)
    await upsertNode(record)
    return true
  } catch {
    return false
  }
}

/**
 * Get the last sync timestamp. Returns 0 if never synced.
 */
export function getLastSyncTimestamp(): number {
  try {
    const stored = localStorage.getItem('thinkingspace:lastSyncTimestamp')
    return stored ? Number(stored) : 0
  } catch {
    return 0
  }
}

/**
 * Save the last sync timestamp.
 */
export function setLastSyncTimestamp(ts?: number): void {
  try {
    localStorage.setItem(
      'thinkingspace:lastSyncTimestamp',
      String(ts ?? Math.floor(Date.now() / 1000)),
    )
  } catch {
    // localStorage may not be available in some contexts
  }
}

/**
 * Smart sync — does incremental if we have a previous timestamp,
 * full sync otherwise.
 */
export async function smartSync(fs?: VaultFS): Promise<SyncResult> {
  const lastSync = getLastSyncTimestamp()
  const nodeCount = await getNodeCount()

  let result: SyncResult
  if (lastSync === 0 || nodeCount === 0) {
    result = await fullSync(fs)
  } else {
    result = await incrementalSync(lastSync, fs)
  }

  setLastSyncTimestamp()
  return result
}

// ── Internals ──

async function syncEntries(
  fs: VaultFS,
  entries: VaultEntry[],
): Promise<SyncResult> {
  const result: SyncResult = {
    totalFiles: entries.length,
    parsedNodes: 0,
    skippedFiles: 0,
    deletedNodes: 0,
    errors: [],
    durationMs: 0,
  }

  for (const entry of entries) {
    try {
      const content = await fs.read(entry.path)

      if (!hasFrontmatter(content)) {
        result.skippedFiles++
        continue
      }

      const note = parseNote(content)
      if (!note) {
        result.skippedFiles++
        continue
      }

      const record = frontmatterToRecord(note.frontmatter, entry.path, note.body)
      await upsertNode(record)
      result.parsedNodes++
    } catch (err) {
      result.errors.push({
        path: entry.path,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}

function frontmatterToRecord(
  fm: YAMLFrontmatter,
  filePath: string,
  body: string,
): Omit<NodeRecord, 'id'> {
  return {
    uuid: fm.uuid,
    key: fm.key,
    title: fm.title,
    type: fm.type,
    level: fm.level,
    parent: fm.parent,
    parentUuid: fm.parent_uuid,
    parentType: fm.parent_type,
    filePath,
    projectRoot: fm.project_root,
    ticket: typeof fm.ticket === 'string' ? fm.ticket : undefined,
    description: typeof fm.description === 'string' ? fm.description : undefined,
    comments: Array.isArray(fm.comments)
      ? fm.comments.map(comment => ({
        text: comment.text,
        added_at: comment.added_at,
        added_by: comment.added_by,
      }))
      : undefined,
    tags: fm.tags ?? [],
    status: fm.status,
    priority: fm.priority,
    progress: fm.progress,
    createdAt: fm.created_at,
    updatedAt: fm.updated_at,
    aiSummary: fm.ai_summary,
    bodyExcerpt: body.slice(0, 200).trim() || undefined,
  }
}
