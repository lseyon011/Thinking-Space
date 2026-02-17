// YAML-aware hierarchy CRUD — creates/updates/moves/deletes nodes by writing
// YAML frontmatter files and keeping the IndexedDB cache in sync.
// Source of truth is always the YAML file on disk; IndexedDB is a cache.

import { getVaultFS } from './fsBlock'
import type { VaultFS } from './fsBlock'
import {
  createNote,
  parseNote,
  stringifyNote,
  suggestFilename,
  type NodeType,
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
  projectRoot?: string
  fs?: VaultFS
}): Promise<NodeRecord> {
  const fs = params.fs ?? getVaultFS()
  const projectRoot = await resolveProjectRoot({
    explicitProjectRoot: params.projectRoot,
    parentKey: params.parentKey,
    fs,
  })

  const note = createNote({
    type: params.type,
    title: params.title,
    parent: params.parentKey,
    parent_uuid: params.parentUuid,
    parent_type: params.parentType,
    tags: params.tags,
    body: params.body,
  })

  if (projectRoot) {
    note.frontmatter.project_root = projectRoot
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
