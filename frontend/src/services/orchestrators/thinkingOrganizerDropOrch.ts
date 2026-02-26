import { getVaultFS, type VaultFS } from '../lego_blocks/fsBlock'
import { getNodeByKey, getNodeByPath, type NodeRecord } from '../lego_blocks/dbBlock'
import {
  createNote,
  generateKey,
  parseNote,
  stringifyNote,
  NODE_TYPE_LEVEL,
  type NodeStatus,
  type NodeType,
  type YAMLNote,
} from '../lego_blocks/yamlNoteBlock'
import { moveYamlNode } from '../lego_blocks/yamlHierarchyBlock'
import { syncSingleFile } from './vaultSyncOrch'

type PathKind = 'file' | 'folder' | 'missing'

interface DropFailure {
  path: string
  reason: string
}

export interface DropPathToNodeResult {
  mappedCount: number
  skippedCount: number
  failureCount: number
  mappedPaths: string[]
  skippedPaths: string[]
  failures: DropFailure[]
}

const VALID_NODE_TYPES: ReadonlySet<NodeType> = new Set([
  'program',
  'epic',
  'idea_bucket',
  'idea',
  'thought_bucket',
  'thought',
  'task',
  'run',
  'handoff',
])

const VALID_NODE_STATUS: ReadonlySet<NodeStatus> = new Set([
  'active',
  'paused',
  'incomplete',
  'completed',
  'cancelled',
  'archived',
])

export async function dropPathToYamlNodeOrch(params: {
  targetNode: NodeRecord
  droppedPath: string
  fs?: VaultFS
}): Promise<DropPathToNodeResult> {
  const fs = params.fs ?? getVaultFS()
  const targetNode = params.targetNode
  const droppedPath = normalizeRelPath(params.droppedPath)
  if (!droppedPath) throw new Error('Invalid dropped path.')

  const pathKind = await getPathKind(fs, droppedPath)
  if (pathKind === 'missing') throw new Error(`Path not found: ${droppedPath}`)

  const candidateFiles = pathKind === 'folder'
    ? await listFolderFiles(fs, droppedPath)
    : [droppedPath]
  const uniqueCandidates = [...new Set(candidateFiles.map(normalizeRelPath).filter(Boolean))]
  if (uniqueCandidates.length === 0) throw new Error('No files found for the dropped path.')

  const mappedPaths: string[] = []
  const skippedPaths: string[] = []
  const failures: DropFailure[] = []

  for (const filePath of uniqueCandidates) {
    if (!isMarkdownPath(filePath)) {
      skippedPaths.push(filePath)
      continue
    }

    try {
      const mapped = await mapMarkdownFileToNode({
        fs,
        targetNode,
        filePath,
      })
      if (mapped) mappedPaths.push(filePath)
      else skippedPaths.push(filePath)
    } catch (err) {
      failures.push({
        path: filePath,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    mappedCount: mappedPaths.length,
    skippedCount: skippedPaths.length,
    failureCount: failures.length,
    mappedPaths,
    skippedPaths,
    failures,
  }
}

async function mapMarkdownFileToNode(params: {
  fs: VaultFS
  targetNode: NodeRecord
  filePath: string
}): Promise<boolean> {
  const { fs, targetNode, filePath } = params
  const record = await ensureYamlNodeForMarkdownFile(fs, filePath)
  if (record.uuid === targetNode.uuid) return false
  if (record.parent === targetNode.key) return false

  await moveYamlNode(record.uuid, targetNode.key, fs)
  return true
}

async function ensureYamlNodeForMarkdownFile(fs: VaultFS, filePath: string): Promise<NodeRecord> {
  const existing = await getNodeByPath(filePath)
  if (existing) return existing

  const syncedExisting = await syncSingleFile(filePath, fs)
  if (syncedExisting) {
    const syncedRecord = await getNodeByPath(filePath)
    if (syncedRecord) return syncedRecord
  }

  const rawContent = await fs.read(filePath)
  const normalized = await normalizeFileToHierarchyNote(rawContent, filePath)
  await fs.write(filePath, stringifyNote(normalized))

  const synced = await syncSingleFile(filePath, fs)
  if (!synced) {
    throw new Error('Failed to sync YAML note into IndexedDB cache')
  }

  const record = await getNodeByPath(filePath)
  if (!record) throw new Error('Failed to load cached node after drop conversion')
  return record
}

async function normalizeFileToHierarchyNote(content: string, filePath: string): Promise<YAMLNote> {
  const parsed = parseNote(content)
  if (!parsed) {
    const title = titleFromBodyOrPath(content, filePath)
    return createNote({
      type: 'thought',
      title,
      body: content,
    })
  }

  const note = parsed
  const now = new Date().toISOString()
  const title = titleFromBodyOrPath(note.body, filePath, note.frontmatter.title)
  const type = normalizeNodeType(note.frontmatter.type)
  const key = await ensureUniqueKeyForPath(filePath, note.frontmatter.key, title)

  note.frontmatter.uuid = readNonEmpty(note.frontmatter.uuid) || createNote({ type, title }).frontmatter.uuid
  note.frontmatter.key = key
  note.frontmatter.title = title
  note.frontmatter.type = type
  note.frontmatter.level = NODE_TYPE_LEVEL[type]
  note.frontmatter.status = normalizeStatus(note.frontmatter.status)
  note.frontmatter.created_at = readNonEmpty(note.frontmatter.created_at) || now
  note.frontmatter.updated_at = now

  return note
}

function normalizeNodeType(value: unknown): NodeType {
  if (typeof value === 'string' && VALID_NODE_TYPES.has(value as NodeType)) {
    return value as NodeType
  }
  return 'thought'
}

function normalizeStatus(value: unknown): NodeStatus {
  if (typeof value === 'string' && VALID_NODE_STATUS.has(value as NodeStatus)) {
    return value as NodeStatus
  }
  return 'active'
}

function titleFromBodyOrPath(body: string, filePath: string, preferredTitle?: unknown): string {
  const explicit = readNonEmpty(preferredTitle)
  if (explicit) return explicit

  const heading = firstMarkdownHeading(body)
  if (heading) return heading

  return titleFromFilePath(filePath)
}

function firstMarkdownHeading(body: string): string | null {
  const lines = body.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    const match = /^#\s+(.+?)\s*$/.exec(line)
    if (!match) return null
    const heading = match[1].trim()
    return heading || null
  }
  return null
}

function titleFromFilePath(path: string): string {
  const baseName = fileName(path).replace(/\.[^/.]+$/, '')
  const normalized = baseName.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized || 'Untitled Thought'
}

function fileName(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

async function ensureUniqueKeyForPath(filePath: string, existingKey: unknown, title: string): Promise<string> {
  const rawKey = readNonEmpty(existingKey) || generateKey(title) || generateKey(fileName(filePath)) || 'thought'
  let next = rawKey
  let suffix = 2

  while (suffix < 1000) {
    const conflict = await getNodeByKey(next)
    if (!conflict || conflict.filePath === filePath) return next
    next = `${rawKey}-${suffix}`
    suffix += 1
  }

  throw new Error(`Could not generate a unique key for ${filePath}`)
}

function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith('.md')
}

function readNonEmpty(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizeRelPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+|\/+$/g, '')
}

function splitParent(path: string): { parent: string; name: string } {
  const normalized = normalizeRelPath(path)
  const idx = normalized.lastIndexOf('/')
  if (idx < 0) return { parent: '', name: normalized }
  return {
    parent: normalized.slice(0, idx),
    name: normalized.slice(idx + 1),
  }
}

function joinRel(parent: string, child: string): string {
  const normalizedParent = normalizeRelPath(parent)
  return normalizedParent ? `${normalizedParent}/${child}` : child
}

async function listFolderFiles(fs: VaultFS, folderPath: string): Promise<string[]> {
  const root = normalizeRelPath(folderPath)
  if (!root) return []

  const files: string[] = []
  const queue = [root]
  const seen = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (seen.has(current)) continue
    seen.add(current)

    const listed = await fs.list(current)
    for (const file of listed.files) files.push(joinRel(current, file))
    for (const folder of listed.folders) queue.push(joinRel(current, folder))
  }

  return files
}

async function getPathKind(fs: VaultFS, path: string): Promise<PathKind> {
  const normalized = normalizeRelPath(path)
  if (!normalized) return 'folder'

  try {
    const stat = await fs.stat(normalized)
    if (stat.isDirectory === true) return 'folder'
    if (stat.isDirectory === false) return 'file'
  } catch {
    // Ignore and use directory listing fallback.
  }

  const { parent, name } = splitParent(normalized)
  try {
    const listed = await fs.list(parent)
    if (listed.folders.includes(name)) return 'folder'
    if (listed.files.includes(name)) return 'file'
    return 'missing'
  } catch {
    return 'missing'
  }
}
