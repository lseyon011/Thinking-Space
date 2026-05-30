// Vault sync orchestrator — scans vault .md files, parses YAML frontmatter,
// and populates IndexedDB cache. Handles full and incremental syncs.

import { getPlatformName, getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import type { VaultFS, VaultEntry } from '@/services/lego_blocks/integrations/fsBlock'
import { getCapabilityFeatureFlags } from '@/services/lego_blocks/integrations/capabilityFeatureFlagsBlock'
import {
  parseNote,
  stringifyNote,
  hasFrontmatter,
  type YAMLFrontmatter,
  type YAMLNote,
} from '@/services/lego_blocks/units/yamlNoteBlock'
import { parseOrganizerBodySections } from '@/services/lego_blocks/integrations/organizerBodyBlock'
import {
  upsertNode,
  bulkUpsertNodes,
  bulkDeleteNodesByPaths,
  bulkDeleteLinksForFiles,
  getAllFilePaths,
  getNodeByKey,
  getNodeByPath,
  clearAll,
  clearAllLinks,
  getNodeCount,
  bulkUpsertLinks,
  replaceLinksForFile,
  type NodeRecord,
  type NodeKeyConflictBlock,
  type LinkRecord,
} from '@/services/lego_blocks/integrations/dbBlock'
import { extractLinksFromContentBlock } from '@/services/lego_blocks/units/linkIndexBlock'
import { startActivity } from '@/services/lego_blocks/units/backgroundActivityBlock'
import {
  mergeWikiLinksIntoFrontmatterBlock,
  resolveGeneratedWikiLinksForFrontmatterBlock,
} from '@/services/lego_blocks/units/wikiLinksBlock'

// ── Types ──

export interface SyncResult {
  totalFiles: number
  parsedNodes: number
  skippedFiles: number
  deletedNodes: number
  errors: Array<{ path: string; error: string }>
  durationMs: number
}

export interface VaultSyncOptions {
  maxFileSizeBytes?: number
  // If set, restricts the sync to entries whose vault-relative path begins
  // with this prefix. Saves CLI write commands from re-parsing the entire
  // vault when only one project is being touched. Caller is responsible for
  // not relying on cross-project state in this run.
  rootPath?: string
}

// ── File paths cache ──
// Avoid re-querying all file paths from IndexedDB on every single-file sync.
// Invalidated after full/incremental sync completes.
let _cachedFilePaths: Set<string> | null = null
let _cachedFilePathsAge = 0
const FILE_PATHS_CACHE_TTL_MS = 30_000

function getCachedFilePaths(): Set<string> | null {
  if (_cachedFilePaths && (Date.now() - _cachedFilePathsAge) < FILE_PATHS_CACHE_TTL_MS) {
    return _cachedFilePaths
  }
  _cachedFilePaths = null
  return null
}

function setCachedFilePaths(paths: Set<string>): void {
  _cachedFilePaths = paths
  _cachedFilePathsAge = Date.now()
}

const IOS_MAX_SYNC_FILE_SIZE_BYTES = 2 * 1024 * 1024
const DEFAULT_MAX_SYNC_FILE_SIZE_BYTES = 12 * 1024 * 1024
const MAX_REASONABLE_EPOCH_SECONDS = 10_000_000_000

function resolveMaxSyncFileSizeBytes(options?: VaultSyncOptions): number {
  if (typeof options?.maxFileSizeBytes === 'number' && Number.isFinite(options.maxFileSizeBytes)) {
    return Math.max(1, Math.floor(options.maxFileSizeBytes))
  }
  return getPlatformName() === 'ios'
    ? IOS_MAX_SYNC_FILE_SIZE_BYTES
    : DEFAULT_MAX_SYNC_FILE_SIZE_BYTES
}

function normalizeRootPath(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.replace(/^\/+|\/+$/g, '').trim()
  return trimmed || undefined
}

async function clearNodesAndLinksUnderPath(rootPath: string): Promise<void> {
  const allPaths = await getAllFilePaths()
  const scoped: string[] = []
  for (const p of allPaths) {
    if (p === rootPath || p.startsWith(`${rootPath}/`)) scoped.push(p)
  }
  if (scoped.length > 0) {
    await bulkDeleteNodesByPaths(scoped)
    await bulkDeleteLinksForFiles(scoped)
  }
}

function normalizeEpochSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  // Some adapters can return epoch in milliseconds. Normalize to seconds for sync comparisons.
  return value > MAX_REASONABLE_EPOCH_SECONDS ? (value / 1000) : value
}

// ── Public API ──

/**
 * Full vault sync — clears IndexedDB and rebuilds from all .md files.
 * Use on first load or when cache is suspected corrupt.
 */
export async function fullSync(fs?: VaultFS, options?: VaultSyncOptions): Promise<SyncResult> {
  const vaultFs = fs ?? getVaultFS()
  const start = Date.now()
  const autoHealEnabled = getCapabilityFeatureFlags().yaml_fields_auto_heal_enabled

  const activity = startActivity({
    kind: 'sync',
    label: 'Syncing vault…',
    detail: 'Full scan',
  })
  try {
    const rootPath = normalizeRootPath(options?.rootPath)
    if (!rootPath) {
      await clearAll()
      await clearAllLinks()
    } else {
      // Scoped sync: only wipe nodes under the scope so unrelated projects
      // already in the DB stay intact (useful when persistent cache is on).
      await clearNodesAndLinksUnderPath(rootPath)
    }

    const allEntries = await vaultFs.walkVault(['.md'])
    const entries = rootPath
      ? allEntries.filter(e => e.path === rootPath || e.path.startsWith(`${rootPath}/`))
      : allEntries
    activity.update({
      total: entries.length,
      completed: 0,
      detail: rootPath
        ? `Scoped to ${rootPath} — ${entries.length} of ${allEntries.length} files`
        : `Full scan — ${entries.length} files`,
    })
    const candidatePaths = entries.map(e => e.path)
    setCachedFilePaths(new Set(candidatePaths))
    const parentKeyToPath = autoHealEnabled
      ? await buildParentKeyToPathIndex(vaultFs, entries, resolveMaxSyncFileSizeBytes(options))
      : undefined
    const result = await syncEntries(
      vaultFs,
      entries,
      options,
      candidatePaths,
      parentKeyToPath,
      autoHealEnabled,
      (completed) => activity.update({ completed }),
    )

    result.durationMs = Date.now() - start
    return result
  } finally {
    activity.end()
  }
}

/**
 * Incremental sync — only process files modified after the given timestamp.
 * Also detects and removes deleted files from cache.
 */
export async function incrementalSync(
  sinceTimestamp: number,
  fs?: VaultFS,
  options?: VaultSyncOptions,
): Promise<SyncResult> {
  const vaultFs = fs ?? getVaultFS()
  const start = Date.now()
  const autoHealEnabled = getCapabilityFeatureFlags().yaml_fields_auto_heal_enabled

  const activity = startActivity({
    kind: 'sync',
    label: 'Syncing vault…',
    detail: 'Checking for changes',
  })
  try {
  const allEntries = await vaultFs.walkVault(['.md'])

  // Find files modified since last sync
  const sinceSeconds = normalizeEpochSeconds(sinceTimestamp)
  const updatedEntries = allEntries.filter(e => normalizeEpochSeconds(e.mtime) > sinceSeconds)

  // Detect deleted files — batch delete instead of N individual queries
  const currentPaths = new Set(allEntries.map(e => e.path))
  const cachedPaths = await getAllFilePaths()
  const deletedPaths: string[] = []
  for (const cachedPath of cachedPaths) {
    if (!currentPaths.has(cachedPath)) {
      deletedPaths.push(cachedPath)
    }
  }
  if (deletedPaths.length > 0) {
    await bulkDeleteNodesByPaths(deletedPaths)
    await bulkDeleteLinksForFiles(deletedPaths)
  }
  const deletedCount = deletedPaths.length

  const candidatePaths = allEntries.map(e => e.path)
  setCachedFilePaths(new Set(candidatePaths))

  // Build a path -> cached updated_at map so syncEntries can skip files whose
  // content is unchanged even though the OS bumped their mtime (typical on
  // iCloud-backed vaults). Per-path lookups parallelize cheaply via Dexie.
  const cachedUpdatedAtByPath = new Map<string, string>()
  await Promise.all(
    updatedEntries.map(async (entry) => {
      const node = await getNodeByPath(entry.path)
      if (node?.updatedAt) cachedUpdatedAtByPath.set(entry.path, node.updatedAt)
    }),
  )

  activity.update({
    total: updatedEntries.length,
    completed: 0,
    detail: updatedEntries.length === 0
      ? 'Up to date'
      : `${updatedEntries.length} changed${deletedCount ? `, ${deletedCount} removed` : ''}`,
  })
  // Incremental sync: skip the full-vault prepass and rely on getNodeByKey lookups
  // against IndexedDB for parent path resolution. Scanning every file here would
  // defeat the purpose of incremental sync.
  const result = await syncEntries(
    vaultFs,
    updatedEntries,
    options,
    candidatePaths,
    undefined,
    autoHealEnabled,
    (completed) => activity.update({ completed }),
    cachedUpdatedAtByPath,
  )
  result.deletedNodes = deletedCount
  result.totalFiles = allEntries.length
  result.durationMs = Date.now() - start

  return result
  } finally {
    activity.end()
  }
}

/**
 * Sync a single file — read, parse, and upsert into cache.
 * Useful when a file is saved/created.
 */
export async function syncSingleFile(
  filePath: string,
  fs?: VaultFS,
  options?: VaultSyncOptions,
): Promise<boolean> {
  const vaultFs = fs ?? getVaultFS()
  const maxFileSizeBytes = resolveMaxSyncFileSizeBytes(options)

  try {
    const stat = await vaultFs.stat(filePath)
    if (stat.size > maxFileSizeBytes) return false

    let content = await vaultFs.read(filePath)
    if (!hasFrontmatter(content)) return false

    const note = parseNote(content)
    if (!note) return false

    if (getCapabilityFeatureFlags().yaml_fields_auto_heal_enabled) {
      const healed = await healWikiLinksForNote(vaultFs, filePath, note)
      if (healed) content = healed
    }

    const record = frontmatterToRecord(note.frontmatter, filePath, note.body)
    await upsertNode(record)

    // Update link index for this file — use cached paths if available
    const candidatePaths = getCachedFilePaths() ?? await getAllFilePaths()
    const links = extractLinksFromContentBlock(content, filePath, [...candidatePaths])
    const linkRecords: Omit<LinkRecord, 'id'>[] = links.map(l => ({
      sourceFilePath: filePath,
      targetFilePath: l.targetFilePath,
      linkType: l.linkType,
      rawText: l.rawText,
    }))
    await replaceLinksForFile(filePath, linkRecords)

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
    return stored ? normalizeEpochSeconds(Number(stored)) : 0
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
      String(normalizeEpochSeconds(ts ?? Math.floor(Date.now() / 1000))),
    )
  } catch {
    // localStorage may not be available in some contexts
  }
}

/**
 * Smart sync — does incremental if we have a previous timestamp,
 * full sync otherwise.
 */
export async function smartSync(fs?: VaultFS, options?: VaultSyncOptions): Promise<SyncResult> {
  const lastSync = getLastSyncTimestamp()
  const nodeCount = await getNodeCount()
  const usedFullSync = lastSync === 0 || nodeCount === 0

  let result: SyncResult
  if (usedFullSync) {
    result = await fullSync(fs, options)
  } else {
    result = await incrementalSync(lastSync, fs, options)
  }

  // Keep retry surface intact on partial failures.
  // For failed full-sync runs, force next run to full sync again.
  if (result.errors.length > 0) {
    if (usedFullSync) {
      setLastSyncTimestamp(0)
    }
    return result
  }

  setLastSyncTimestamp()

  // Fire-and-forget cross-device Home snapshot refresh. No-ops on
  // non-Electron platforms, where the snapshot is read-only.
  void regenerateHomeSnapshotAfterSync()

  return result
}

async function regenerateHomeSnapshotAfterSync(): Promise<void> {
  try {
    const { regenerateHomeSnapshot } = await import(
      '@/services/lego_blocks/integrations/homeSnapshotBlock'
    )
    await regenerateHomeSnapshot()
  } catch (err) {
    console.warn('[vaultSyncOrch] home snapshot regenerate failed', err)
  }
}

// ── Internals ──

const LINK_BATCH_SIZE = 500

async function syncEntries(
  fs: VaultFS,
  entries: VaultEntry[],
  options?: VaultSyncOptions,
  candidatePaths?: string[],
  parentKeyToPath?: Map<string, string>,
  autoHealEnabled?: boolean,
  onProgress?: (completed: number) => void,
  skipIfUpdatedAtMatches?: Map<string, string>,
): Promise<SyncResult> {
  const maxFileSizeBytes = resolveMaxSyncFileSizeBytes(options)
  const result: SyncResult = {
    totalFiles: entries.length,
    parsedNodes: 0,
    skippedFiles: 0,
    deletedNodes: 0,
    errors: [],
    durationMs: 0,
  }

  const allCandidatePaths = candidatePaths ?? entries.map(e => e.path)
  const pendingLinks: Omit<LinkRecord, 'id'>[] = []
  const pendingNodes: Omit<NodeRecord, 'id'>[] = []
  const isFullSync = candidatePaths !== undefined

  const NODE_BATCH_SIZE = 200

  async function flushNodes() {
    if (pendingNodes.length === 0) return
    const batch = pendingNodes.splice(0)
    const { conflicts } = await bulkUpsertNodes(batch)
    if (conflicts.length > 0) {
      result.errors.push(...conflicts.map(conflict => ({
        path: conflict.filePath,
        error: formatNodeKeyConflictError(conflict),
      })))
    }
  }

  async function flushLinks() {
    if (pendingLinks.length === 0) return
    if (isFullSync) {
      await bulkUpsertLinks(pendingLinks.splice(0))
    } else {
      // For incremental sync, replace per-file
      const bySource = new Map<string, Omit<LinkRecord, 'id'>[]>()
      for (const link of pendingLinks.splice(0)) {
        const existing = bySource.get(link.sourceFilePath)
        if (existing) existing.push(link)
        else bySource.set(link.sourceFilePath, [link])
      }
      for (const [source, links] of bySource) {
        await replaceLinksForFile(source, links)
      }
    }
  }

  let progressCount = 0
  let nextProgressReport = 0
  for (const entry of entries) {
    progressCount++
    if (onProgress && progressCount >= nextProgressReport) {
      onProgress(progressCount)
      // Report every ~2% of work, min every 5 files, to avoid bus churn.
      nextProgressReport = progressCount + Math.max(5, Math.floor(entries.length / 50))
    }
    try {
      if (entry.size > maxFileSizeBytes) {
        result.skippedFiles++
        continue
      }

      let content = await fs.read(entry.path)
      if (!hasFrontmatter(content)) {
        result.skippedFiles++
        continue
      }

      // iCloud-aware fast path: if the file's frontmatter `updated_at` matches
      // what we already cached for this path, skip the full parse + upsert.
      // iCloud frequently bumps mtimes when it re-materializes files in the
      // background, which would otherwise force a redundant reparse on every
      // focus event.
      if (skipIfUpdatedAtMatches && skipIfUpdatedAtMatches.size > 0) {
        const cachedUpdatedAt = skipIfUpdatedAtMatches.get(entry.path)
        if (cachedUpdatedAt) {
          const fileUpdatedAt = peekFrontmatterUpdatedAt(content)
          if (fileUpdatedAt && fileUpdatedAt === cachedUpdatedAt) {
            result.skippedFiles++
            continue
          }
        }
      }

      const note = parseNote(content)
      if (!note) {
        result.skippedFiles++
        continue
      }

      if (autoHealEnabled) {
        const healed = await healWikiLinksForNote(fs, entry.path, note, parentKeyToPath)
        if (healed) content = healed
      }

      const record = frontmatterToRecord(note.frontmatter, entry.path, note.body)
      pendingNodes.push(record)
      result.parsedNodes++

      // Extract links for the index
      const extracted = extractLinksFromContentBlock(content, entry.path, allCandidatePaths)
      for (const link of extracted) {
        pendingLinks.push({
          sourceFilePath: entry.path,
          targetFilePath: link.targetFilePath,
          linkType: link.linkType,
          rawText: link.rawText,
        })
      }

      if (pendingNodes.length >= NODE_BATCH_SIZE) {
        await flushNodes()
      }
      if (pendingLinks.length >= LINK_BATCH_SIZE) {
        await flushLinks()
      }
    } catch (err) {
      result.errors.push({
        path: entry.path,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Flush remaining batches
  await flushNodes()
  await flushLinks()

  return result
}

// Fast key extractor for the full-sync prepass: avoids a full YAML parse.
// Matches a top-level `key: <value>` line inside the leading frontmatter block.
const FRONTMATTER_KEY_RE = /^key:\s*["']?([^"'\n]+?)["']?\s*$/m

// Fast `updated_at` peek used by incremental sync to skip work on files whose
// content is unchanged despite a new mtime (common on iCloud-backed vaults
// where iCloud re-materializes files in the background).
const FRONTMATTER_UPDATED_AT_RE = /^updated_at:\s*["']?([^"'\n]+?)["']?\s*$/m

function peekFrontmatterUpdatedAt(content: string): string | null {
  if (!hasFrontmatter(content)) return null
  const match = FRONTMATTER_UPDATED_AT_RE.exec(content)
  return match?.[1]?.trim() ?? null
}

async function buildParentKeyToPathIndex(
  fs: VaultFS,
  entries: VaultEntry[],
  maxFileSizeBytes: number,
): Promise<Map<string, string>> {
  const keyToPath = new Map<string, string>()
  for (const entry of entries) {
    if (entry.size > maxFileSizeBytes) continue
    try {
      const content = await fs.read(entry.path)
      if (!hasFrontmatter(content)) continue
      const match = FRONTMATTER_KEY_RE.exec(content)
      const key = match?.[1]?.trim()
      if (!key) continue
      keyToPath.set(key, entry.path)
    } catch {
      // Ignore index misses; sync will report file-level issues separately.
    }
  }
  return keyToPath
}

/**
 * Heal generated wiki_links on an already-parsed note. Mutates note.frontmatter
 * in place and writes the file when something changed. Returns the rewritten
 * content if a write occurred, otherwise undefined (caller keeps original).
 */
async function healWikiLinksForNote(
  fs: VaultFS,
  filePath: string,
  note: YAMLNote,
  parentKeyToPath?: Map<string, string>,
): Promise<string | undefined> {
  const parentKey = typeof note.frontmatter.parent === 'string'
    ? note.frontmatter.parent.trim()
    : ''
  const parentFilePath = parentKey
    ? (parentKeyToPath?.get(parentKey) ?? (await getNodeByKey(parentKey))?.filePath)
    : undefined
  const { frontmatter: nextFrontmatter, changed } = mergeWikiLinksIntoFrontmatterBlock(
    note.frontmatter as Record<string, unknown>,
    {
      generatedLinks: resolveGeneratedWikiLinksForFrontmatterBlock(
        note.frontmatter as Record<string, unknown>,
        { parentFilePath },
      ),
    },
  )
  if (!changed) return undefined

  note.frontmatter = nextFrontmatter as YAMLFrontmatter
  const rewritten = stringifyNote(note)
  await fs.write(filePath, rewritten)
  return rewritten
}

function formatNodeKeyConflictError(conflict: NodeKeyConflictBlock): string {
  return `Duplicate YAML key "${conflict.key}" conflicts with "${conflict.conflictingFilePath}". Node keys must be unique.`
}

function frontmatterToRecord(
  fm: YAMLFrontmatter,
  filePath: string,
  body: string,
): Omit<NodeRecord, 'id'> {
  const { metadata, metadataKeys, metadataText } = extractGenericMetadata(fm)
  const bodySections = parseOrganizerBodySections(body)
  const yamlComments = Array.isArray(fm.comments)
    ? fm.comments.map(comment => ({
      text: comment.text,
      added_at: comment.added_at,
      added_by: comment.added_by,
    }))
    : []
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
    description: bodySections.description
      ?? (typeof fm.description === 'string' ? fm.description : undefined),
    comments: bodySections.comments.length > 0 ? bodySections.comments : (yamlComments.length > 0 ? yamlComments : undefined),
    epicCompletedAt: typeof fm.epic_completed_at === 'string' ? fm.epic_completed_at : undefined,
    sortOrder: typeof fm.sort_order === 'number' && Number.isFinite(fm.sort_order) ? fm.sort_order : undefined,
    taskId: typeof fm.task_id === 'string' ? fm.task_id : undefined,
    taskStatus: typeof fm.task_status === 'string' ? fm.task_status : undefined,
    dependsOn: Array.isArray(fm.depends_on) ? fm.depends_on.filter(Boolean) : undefined,
    blockedBy: Array.isArray(fm.blocked_by) ? fm.blocked_by.filter(Boolean) : undefined,
    acceptanceCriteria: Array.isArray(fm.acceptance_criteria) ? fm.acceptance_criteria.filter(Boolean) : undefined,
    owner: typeof fm.owner === 'string' ? fm.owner : undefined,
    runId: typeof fm.run_id === 'string' ? fm.run_id : undefined,
    sessionId: typeof fm.session_id === 'string' ? fm.session_id : undefined,
    agentName: typeof fm.agent_name === 'string' ? fm.agent_name : undefined,
    model: typeof fm.model === 'string' ? fm.model : undefined,
    startedAt: typeof fm.started_at === 'string' ? fm.started_at : undefined,
    endedAt: typeof fm.ended_at === 'string' ? fm.ended_at : undefined,
    result: typeof fm.result === 'string' ? fm.result : undefined,
    sourceRepo: typeof fm.source_repo === 'string' ? fm.source_repo : undefined,
    branch: typeof fm.branch === 'string' ? fm.branch : undefined,
    commit: typeof fm.commit === 'string' ? fm.commit : undefined,
    artifacts: Array.isArray(fm.artifacts) ? fm.artifacts.filter(Boolean) : undefined,
    relatedNodes: Array.isArray(fm.related_nodes) ? fm.related_nodes.filter(Boolean) : undefined,
    schemaVersion: fm.schema_version != null ? String(fm.schema_version) : undefined,
    recordKind: typeof fm.record_kind === 'string' ? fm.record_kind : undefined,
    stateHistory: Array.isArray(fm.state_history)
      ? fm.state_history.map(entry => ({ ...entry }))
      : undefined,
    metadata,
    metadataKeys,
    metadataText,
    tags: fm.tags ?? [],
    projectPresetTags: fm.project_preset_tags ?? [],
    status: fm.status,
    priority: fm.priority,
    progress: fm.progress,
    createdAt: fm.created_at,
    updatedAt: fm.updated_at,
    aiSummary: fm.ai_summary,
    bodyExcerpt: body.slice(0, 200).trim() || undefined,
  }
}

const KNOWN_FRONTMATTER_KEYS = new Set<string>([
  'uuid',
  'key',
  'title',
  'type',
  'level',
  'parent',
  'parent_uuid',
  'parent_type',
  'tags',
  'project_preset_tags',
  'categories',
  'progress',
  'status',
  'priority',
  'created_at',
  'updated_at',
  'ai_summary',
  'ai_generated',
  'last_ai_update',
  'ai_suggestions',
  'excalidraw',
  'project_root',
  'ticket',
  'description',
  'comments',
  'epic_completed_at',
  'sort_order',
  'task_id',
  'task_status',
  'depends_on',
  'blocked_by',
  'acceptance_criteria',
  'owner',
  'run_id',
  'session_id',
  'agent_name',
  'model',
  'started_at',
  'ended_at',
  'result',
  'source_repo',
  'branch',
  'commit',
  'artifacts',
  'related_nodes',
  'schema_version',
  'record_kind',
  'state_history',
])

function extractGenericMetadata(frontmatter: YAMLFrontmatter): {
  metadata?: Record<string, unknown>
  metadataKeys?: string[]
  metadataText?: string
} {
  const metadata: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(frontmatter)) {
    if (KNOWN_FRONTMATTER_KEYS.has(key)) continue
    if (value === undefined || value === null || value === '') continue
    metadata[key] = value
  }

  const keys = Object.keys(metadata)
  if (keys.length === 0) return {}

  const metadataKeys = collectMetadataKeys(metadata)
  const metadataText = buildMetadataText(metadata)
  return {
    metadata,
    metadataKeys,
    metadataText,
  }
}

function collectMetadataKeys(metadata: Record<string, unknown>): string[] {
  const out = new Set<string>()
  walkMetadata('', metadata, (path) => out.add(path))
  return [...out]
}

function buildMetadataText(metadata: Record<string, unknown>): string {
  const out: string[] = []
  walkMetadata('', metadata, (path, value) => {
    out.push(path)
    if (value !== null && value !== undefined && typeof value !== 'object') {
      out.push(String(value))
    }
  })
  return out.join(' ').toLowerCase()
}

function walkMetadata(
  prefix: string,
  value: unknown,
  visitor: (path: string, value: unknown) => void,
): void {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const path = prefix ? `${prefix}[${i}]` : `[${i}]`
      visitor(path, value[i])
      walkMetadata(path, value[i], visitor)
    }
    return
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const [key, inner] of Object.entries(record)) {
      const path = prefix ? `${prefix}.${key}` : key
      visitor(path, inner)
      walkMetadata(path, inner, visitor)
    }
  }
}
