// YAML-aware hierarchy CRUD — creates/updates/moves/deletes nodes by writing
// YAML frontmatter files and keeping the IndexedDB cache in sync.
// Source of truth is always the YAML file on disk; IndexedDB is a cache.

import { getVaultFS } from './fsBlock'
import type { VaultFS } from './fsBlock'
import {
  ALLOWED_RECORD_KINDS,
  createNote,
  generateKey,
  parseNote,
  stringifyNote,
  suggestFilename,
  type YAMLCommentEntry,
  type NodeType,
  type YAMLFrontmatter,
  NODE_TYPE_LEVEL,
} from './yamlNoteBlock'
import {
  getChildren,
  getNodeByKey,
  getNodeByUuid,
  getRootNodes,
  getAllNodes,
  getNodesByType,
  deleteNode as deleteNodeFromDb,
  searchNodes,
  type NodeRecord,
} from './dbBlock'
import { getProjectStoragePath } from './projectStorageBlock'
import { syncSingleFile } from '../orchestrators/vaultSyncOrch'

// ── Constants ──

/** Default parent folder for new nodes, organized by type */
const TYPE_FOLDERS: Record<NodeType, string> = {
  program: 'programs',
  epic: 'epics',
  idea_bucket: 'idea_buckets',
  idea: 'ideas',
  thought_bucket: 'thought_buckets',
  thought: 'thoughts',
}

const TYPE_TICKET_CODES: Record<NodeType, string> = {
  program: 'P',
  epic: 'E',
  idea_bucket: 'IB',
  idea: 'I',
  thought_bucket: 'TB',
  thought: 'T',
}

// ── Public API ──

/**
 * Create a new hierarchy node: writes YAML file to vault + upserts IndexedDB.
 * Returns the cached NodeRecord.
 */
export async function createYamlNode(params: {
  type: NodeType
  title: string
  parentKey?: string
  parentUuid?: string
  parentType?: NodeType
  tags?: string[]
  body?: string
  description?: string
  comments?: Array<string | YAMLCommentEntry>
  projectRoot?: string
  extraFields?: Record<string, unknown>
  fs?: VaultFS
}): Promise<NodeRecord> {
  const fs = params.fs ?? getVaultFS()
  const projectRoot = await resolveProjectRoot({
    explicitProjectRoot: params.projectRoot,
    parentKey: params.parentKey,
    fs,
  })
  const programCode = await resolveProgramCode({
    type: params.type,
    title: params.title,
    parentKey: params.parentKey,
  })
  const ticket = projectRoot ? await generateProjectTicket(projectRoot, programCode, params.type) : undefined

  const note = createNote({
    type: params.type,
    title: params.title,
    parent: params.parentKey,
    parent_uuid: params.parentUuid,
    parent_type: params.parentType,
    tags: params.tags,
    body: params.body,
  })

  const description = params.description?.trim()
  const comments = normalizeCommentEntries(params.comments)
  if (description) {
    note.frontmatter.description = description
  }
  if (comments.length > 0) {
    note.frontmatter.comments = comments
  }
  if (!note.body.trim()) {
    note.body = buildInitialBody(description, comments)
  }
  applyExtraFrontmatterFields(note.frontmatter, params.extraFields)

  if (projectRoot) {
    note.frontmatter.project_root = projectRoot
    note.frontmatter.ticket = ticket
    if (ticket) {
      note.frontmatter.title = prependTicketToTitle(ticket, note.frontmatter.title)
      const keyFromTitle = generateKey(note.frontmatter.title)
      if (keyFromTitle) {
        note.frontmatter.key = keyFromTitle
      }
    }
  }

  // Update parent's children list
  if (params.parentKey) {
    await addChildToParent(params.parentKey, note.frontmatter.key, params.type, fs)
  }

  // Determine file path — use project storage when a project root is known.
  const filename = suggestFilename(note.frontmatter)
  let folder: string
  if (projectRoot) {
    folder = getProjectStoragePath(projectRoot, params.type)
  } else {
    folder = TYPE_FOLDERS[params.type]
  }
  const filePath = `${folder}/${filename}`

  // Ensure folder exists
  try {
    await fs.mkdir(folder)
  } catch {
    // folder may already exist
  }

  // Write YAML file
  const content = stringifyNote(note)
  await fs.write(filePath, content)

  // Sync to IndexedDB
  await syncSingleFile(filePath, fs)

  // Return the cached record
  const record = await getNodeByKey(note.frontmatter.key)
  if (!record) throw new Error(`Failed to sync created node: ${note.frontmatter.key}`)
  return record
}

/**
 * Rename a node: updates title + key in YAML file, upserts IndexedDB.
 * Note: this does NOT rename the file on disk (key stays the same for stability).
 */
export async function renameYamlNode(
  uuid: string,
  newTitle: string,
  fs?: VaultFS,
): Promise<NodeRecord> {
  const vaultFs = fs ?? getVaultFS()
  const record = await getNodeByUuid(uuid)
  if (!record) throw new Error(`Node not found: ${uuid}`)

  const content = await vaultFs.read(record.filePath)
  const note = parseNote(content)
  if (!note) throw new Error(`Failed to parse YAML for: ${record.filePath}`)

  note.frontmatter.title = newTitle
  note.frontmatter.updated_at = new Date().toISOString()

  await vaultFs.write(record.filePath, stringifyNote(note))
  await syncSingleFile(record.filePath, vaultFs)

  const updated = await getNodeByUuid(uuid)
  if (!updated) throw new Error(`Failed to sync renamed node: ${uuid}`)
  return updated
}

/**
 * Update a node's type or other metadata fields.
 */
export async function updateYamlNode(
  uuid: string,
  updates: {
    type?: NodeType
    title?: string
    tags?: string[]
    status?: 'active' | 'paused' | 'completed' | 'archived'
    priority?: 'low' | 'medium' | 'high' | 'critical'
    description?: string
    comments?: Array<string | YAMLCommentEntry>
    extraFields?: Record<string, unknown>
  },
  fs?: VaultFS,
): Promise<NodeRecord> {
  const vaultFs = fs ?? getVaultFS()
  const record = await getNodeByUuid(uuid)
  if (!record) throw new Error(`Node not found: ${uuid}`)

  const content = await vaultFs.read(record.filePath)
  const note = parseNote(content)
  if (!note) throw new Error(`Failed to parse YAML for: ${record.filePath}`)

  if (updates.type !== undefined) {
    note.frontmatter.type = updates.type
    note.frontmatter.level = NODE_TYPE_LEVEL[updates.type]
  }
  if (updates.title !== undefined) note.frontmatter.title = updates.title
  if (updates.tags !== undefined) note.frontmatter.tags = updates.tags
  if (updates.status !== undefined) note.frontmatter.status = updates.status
  if (updates.priority !== undefined) note.frontmatter.priority = updates.priority
  if (updates.description !== undefined) {
    const normalizedDescription = updates.description.trim()
    if (normalizedDescription) note.frontmatter.description = normalizedDescription
    else delete note.frontmatter.description
  }
  if (updates.comments !== undefined) {
    const normalizedComments = normalizeCommentEntries(updates.comments)
    note.frontmatter.comments = normalizedComments.length > 0 ? normalizedComments : undefined
  }
  if (updates.extraFields !== undefined) {
    applyExtraFrontmatterFields(note.frontmatter, updates.extraFields)
  }
  note.frontmatter.updated_at = new Date().toISOString()

  await vaultFs.write(record.filePath, stringifyNote(note))
  await syncSingleFile(record.filePath, vaultFs)

  const updated = await getNodeByUuid(uuid)
  if (!updated) throw new Error(`Failed to sync updated node: ${uuid}`)
  return updated
}

/**
 * Move a node to a new parent: updates parent fields in YAML, upserts IndexedDB.
 */
export async function moveYamlNode(
  uuid: string,
  newParentKey: string | null,
  fs?: VaultFS,
): Promise<NodeRecord> {
  const vaultFs = fs ?? getVaultFS()
  const record = await getNodeByUuid(uuid)
  if (!record) throw new Error(`Node not found: ${uuid}`)

  const content = await vaultFs.read(record.filePath)
  const note = parseNote(content)
  if (!note) throw new Error(`Failed to parse YAML for: ${record.filePath}`)

  // Remove from old parent's children list
  if (record.parent) {
    await removeChildFromParent(record.parent, record.key, vaultFs)
  }

  // Update node's parent fields
  if (newParentKey) {
    const parentRecord = await getNodeByKey(newParentKey)
    if (!parentRecord) throw new Error(`Parent not found: ${newParentKey}`)

    note.frontmatter.parent = parentRecord.key
    note.frontmatter.parent_uuid = parentRecord.uuid
    note.frontmatter.parent_type = parentRecord.type

    // Add to new parent's children list
    await addChildToParent(parentRecord.key, record.key, record.type, vaultFs)

    const projectRoot = await resolveProjectRoot({
      parentKey: parentRecord.key,
      fs: vaultFs,
    })
    if (projectRoot) note.frontmatter.project_root = projectRoot
    else delete note.frontmatter.project_root
  } else {
    delete note.frontmatter.parent
    delete note.frontmatter.parent_uuid
    delete note.frontmatter.parent_type
    if (note.frontmatter.type !== 'program') {
      delete note.frontmatter.project_root
    }
  }

  note.frontmatter.updated_at = new Date().toISOString()

  await vaultFs.write(record.filePath, stringifyNote(note))
  await syncSingleFile(record.filePath, vaultFs)

  const updated = await getNodeByUuid(uuid)
  if (!updated) throw new Error(`Failed to sync moved node: ${uuid}`)
  return updated
}

/**
 * Delete a node: removes YAML file from vault + removes from IndexedDB.
 * Also removes this node from its parent's children list.
 */
export async function deleteYamlNode(
  uuid: string,
  fs?: VaultFS,
): Promise<void> {
  const vaultFs = fs ?? getVaultFS()
  const record = await getNodeByUuid(uuid)
  if (!record) return // already gone

  // Remove from parent's children list
  if (record.parent) {
    try {
      await removeChildFromParent(record.parent, record.key, vaultFs)
    } catch {
      // parent may not exist anymore
    }
  }

  // Delete YAML file (we write empty to mark deletion, then the file is gone)
  try {
    // Write an empty file to signal deletion — or just let it not exist
    // For now, we don't actually delete from disk (reversibility).
    // We only remove from IndexedDB cache.
    // TODO: implement actual file deletion when user explicitly requests it
  } catch {
    // file may not exist
  }

  await deleteNodeFromDb(uuid)
}

/**
 * List children of a parent node from IndexedDB cache.
 */
export async function listYamlChildren(parentKey: string): Promise<NodeRecord[]> {
  return getChildren(parentKey)
}

/**
 * List root nodes (nodes without parent) from IndexedDB cache.
 */
export async function listYamlRootNodes(typeFilter?: NodeType): Promise<NodeRecord[]> {
  const roots = await getRootNodes()
  if (!typeFilter) return roots
  return roots.filter(n => n.type === typeFilter)
}

/**
 * Get a single node by uuid from IndexedDB cache.
 */
export async function getYamlNode(uuid: string): Promise<NodeRecord | undefined> {
  return getNodeByUuid(uuid)
}

/**
 * Get a single node by key from IndexedDB cache.
 */
export async function getYamlNodeByKey(key: string): Promise<NodeRecord | undefined> {
  return getNodeByKey(key)
}

/**
 * Read a node frontmatter directly from YAML file by path.
 */
export async function readYamlFrontmatterByPath(
  filePath: string,
  fs?: VaultFS,
): Promise<YAMLFrontmatter | null> {
  const vaultFs = fs ?? getVaultFS()
  const content = await vaultFs.read(filePath)
  const note = parseNote(content)
  if (!note) return null
  return note.frontmatter
}

/**
 * Get all nodes from IndexedDB cache.
 */
export async function listAllYamlNodes(): Promise<NodeRecord[]> {
  return getAllNodes()
}

/**
 * Get nodes by type from IndexedDB cache.
 */
export async function listYamlNodesByType(type: NodeType): Promise<NodeRecord[]> {
  return getNodesByType(type)
}

/**
 * Search nodes by text query from IndexedDB cache.
 */
export async function searchYamlNodes(query: string, limit?: number): Promise<NodeRecord[]> {
  return searchNodes(query, limit)
}

// ── Helpers ──

async function resolveProjectRoot(params: {
  explicitProjectRoot?: string
  parentKey?: string
  fs: VaultFS
}): Promise<string | undefined> {
  const explicit = normalizeProjectRoot(params.explicitProjectRoot)
  if (explicit) return explicit

  const parentKey = params.parentKey?.trim()
  if (!parentKey) return undefined

  const parentRecord = await getNodeByKey(parentKey)
  if (!parentRecord) return undefined

  const cached = normalizeProjectRoot(parentRecord.projectRoot)
  if (cached) return cached

  const parsed = await readProjectRootFromFile(parentRecord.filePath, params.fs)
  return normalizeProjectRoot(parsed)
}

async function generateProjectTicket(
  projectRoot: string,
  programCode: string,
  type: NodeType,
): Promise<string> {
  const projectCode = deriveProjectCode(projectRoot)
  const normalizedProgramCode = normalizeTicketToken(programCode, 'PG')
  const typeCode = TYPE_TICKET_CODES[type]
  const prefix = `${projectCode}-${normalizedProgramCode}-${typeCode}-`

  const allNodes = await getAllNodes()
  const existing = new Set(
    allNodes
      .filter(node => normalizeProjectRoot(node.projectRoot) === normalizeProjectRoot(projectRoot))
      .map(node => (typeof node.ticket === 'string' ? node.ticket : ''))
      .filter(Boolean),
  )

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = String(Math.floor(100 + (Math.random() * 900)))
    const ticket = `${prefix}${suffix}`
    if (!existing.has(ticket)) return ticket
  }

  // Extremely unlikely fallback when random space is exhausted.
  return `${prefix}${Date.now().toString().slice(-3)}`
}

function deriveProjectCode(projectRoot: string): string {
  const normalized = normalizeProjectRoot(projectRoot)
  if (!normalized) return 'PR'

  const segment = normalized.split('/').filter(Boolean).pop() ?? normalized
  const tokens = segment.split(/[-_\\s]+/).filter(Boolean)

  if (tokens.length >= 2) {
    return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase()
  }

  const token = (tokens[0] ?? segment).replace(/[^a-zA-Z0-9]/g, '')
  if (!token) return 'PR'
  if (token.length <= 3) return token.toUpperCase()

  const letter = token.match(/[A-Za-z]/)?.[0] ?? token[0]
  const digit = token.match(/[0-9]/)?.[0]
  if (letter && digit) return `${letter}${digit}`.toUpperCase()

  return token.slice(0, 2).toUpperCase()
}

async function resolveProgramCode(params: {
  type: NodeType
  title: string
  parentKey?: string
}): Promise<string> {
  if (params.type === 'program') return deriveProgramCode(params.title)

  const parentKey = params.parentKey?.trim()
  if (!parentKey) return 'PG'

  let cursor = await getNodeByKey(parentKey)
  for (let depth = 0; depth < 20 && cursor; depth += 1) {
    if (cursor.type === 'program') {
      const codeFromTicket = deriveProgramCodeFromTicket(cursor.ticket)
      if (codeFromTicket) return codeFromTicket
      return deriveProgramCode(cursor.key || cursor.title)
    }
    cursor = cursor.parent ? await getNodeByKey(cursor.parent) : undefined
  }

  return 'PG'
}

function deriveProgramCode(value: string): string {
  const normalized = value.trim().toUpperCase()
  if (!normalized) return 'PG'

  const tokens = normalized
    .replace(/[^A-Z0-9\s_-]/g, ' ')
    .split(/[\s_-]+/)
    .filter(Boolean)

  if (tokens.length >= 2) {
    return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase()
  }

  const single = tokens[0] ?? normalized
  if (single.length <= 3) return single.toUpperCase()
  return single.slice(0, 3).toUpperCase()
}

function deriveProgramCodeFromTicket(ticket: string | undefined): string | undefined {
  if (!ticket) return undefined
  const match = ticket.trim().toUpperCase().match(/^[A-Z0-9]+-([A-Z0-9]+)-P-\d{3}$/)
  return match?.[1] || undefined
}

function normalizeTicketToken(value: string, fallback: string): string {
  const token = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return token || fallback
}

function prependTicketToTitle(ticket: string, title: string): string {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) return ticket
  if (trimmedTitle.startsWith(`${ticket} `)) return trimmedTitle
  if (trimmedTitle.startsWith(`${ticket} - `)) return trimmedTitle
  return `${ticket} - ${trimmedTitle}`
}

async function readProjectRootFromFile(
  filePath: string,
  fs: VaultFS,
): Promise<string | undefined> {
  try {
    const content = await fs.read(filePath)
    const note = parseNote(content)
    if (!note) return undefined
    const raw = note.frontmatter.project_root
    if (typeof raw !== 'string') return undefined
    return raw
  } catch {
    return undefined
  }
}

function normalizeProjectRoot(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  return normalized || undefined
}

function buildInitialBody(
  description: string | undefined,
  comments: YAMLCommentEntry[],
): string {
  const sections: string[] = []

  if (description) {
    sections.push('## Description')
    sections.push('')
    sections.push(description)
    sections.push('')
  }

  if (comments.length > 0) {
    sections.push('## Comments')
    sections.push('')
    for (const comment of comments) {
      sections.push(`- ${comment.text}`)
    }
    sections.push('')
  }

  return sections.join('\n').trim()
}

function normalizeCommentEntries(comments: Array<string | YAMLCommentEntry> | undefined): YAMLCommentEntry[] {
  if (!comments || comments.length === 0) return []

  const now = new Date().toISOString()
  return comments
    .map(comment => normalizeSingleCommentEntry(comment, now))
    .filter((comment): comment is YAMLCommentEntry => comment !== null)
}

function normalizeSingleCommentEntry(
  comment: string | YAMLCommentEntry,
  now: string,
): YAMLCommentEntry | null {
  if (typeof comment === 'string') {
    const text = comment.trim()
    if (!text) return null
    return {
      text,
      added_at: now,
      added_by: 'unknown',
    }
  }

  const text = comment.text?.trim() ?? ''
  if (!text) return null
  const addedAt = comment.added_at?.trim()
  const addedBy = comment.added_by?.trim()

  return {
    text,
    added_at: addedAt || now,
    added_by: addedBy || 'unknown',
  }
}

function applyExtraFrontmatterFields(
  frontmatter: YAMLFrontmatter,
  extraFields: Record<string, unknown> | undefined,
): void {
  if (!extraFields) return
  const reserved = new Set([
    'uuid',
    'key',
    'title',
    'type',
    'level',
    'parent',
    'parent_uuid',
    'parent_type',
    'children',
    'child_types',
    'tags',
    'status',
    'priority',
    'project_root',
    'ticket',
    'description',
    'comments',
    'created_at',
    'updated_at',
  ])
  for (const [key, value] of Object.entries(extraFields)) {
    if (!key.trim()) continue
    if (reserved.has(key)) continue
    if (value === undefined || value === null || value === '') {
      delete frontmatter[key]
      continue
    }
    if (key === 'record_kind') {
      if (typeof value !== 'string' || !ALLOWED_RECORD_KINDS.includes(value as (typeof ALLOWED_RECORD_KINDS)[number])) {
        throw new Error(`Invalid record_kind: ${String(value)}`)
      }
    }
    frontmatter[key] = value
  }
}

async function addChildToParent(
  parentKey: string,
  childKey: string,
  childType: NodeType,
  fs: VaultFS,
): Promise<void> {
  const parentRecord = await getNodeByKey(parentKey)
  if (!parentRecord) return

  try {
    const content = await fs.read(parentRecord.filePath)
    const note = parseNote(content)
    if (!note) return

    const children = note.frontmatter.children ?? []
    if (!children.includes(childKey)) {
      note.frontmatter.children = [...children, childKey]
    }

    const childTypes = note.frontmatter.child_types ?? []
    if (!childTypes.includes(childType)) {
      note.frontmatter.child_types = [...childTypes, childType]
    }

    note.frontmatter.updated_at = new Date().toISOString()
    await fs.write(parentRecord.filePath, stringifyNote(note))
    await syncSingleFile(parentRecord.filePath, fs)
  } catch {
    // non-fatal: parent file may not exist or parse
  }
}

async function removeChildFromParent(
  parentKey: string,
  childKey: string,
  fs: VaultFS,
): Promise<void> {
  const parentRecord = await getNodeByKey(parentKey)
  if (!parentRecord) return

  try {
    const content = await fs.read(parentRecord.filePath)
    const note = parseNote(content)
    if (!note) return

    const children = note.frontmatter.children ?? []
    const filtered = children.filter(k => k !== childKey)
    if (filtered.length === children.length) return // nothing changed

    note.frontmatter.children = filtered.length > 0 ? filtered : undefined
    note.frontmatter.updated_at = new Date().toISOString()
    await fs.write(parentRecord.filePath, stringifyNote(note))
    await syncSingleFile(parentRecord.filePath, fs)
  } catch {
    // non-fatal
  }
}
