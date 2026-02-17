// IndexedDB cache layer for fast hierarchy queries.
// Uses Dexie.js. This is a PURE CACHE — source of truth is YAML frontmatter.
// Can be rebuilt from vault files at any time.

import Dexie, { type Table } from 'dexie'
import type { NodeType, NodeStatus, NodePriority, YAMLCommentEntry } from './yamlNoteBlock'

// ── Types ──

export interface NodeRecord {
  id?: number              // auto-increment PK (Dexie internal)
  uuid: string             // from YAML frontmatter
  key: string              // stable slug
  title: string
  type: NodeType
  level: number
  parent?: string          // parent key
  parentUuid?: string
  parentType?: NodeType
  filePath: string         // vault-relative path
  projectRoot?: string
  ticket?: string
  description?: string
  comments?: YAMLCommentEntry[]
  tags: string[]
  status: NodeStatus
  priority?: NodePriority
  progress?: number
  createdAt: string        // ISO string
  updatedAt: string        // ISO string
  aiSummary?: string
  bodyExcerpt?: string     // first ~200 chars of body for search
}

// ── Database ──

class ThinkingSpaceDB extends Dexie {
  nodes!: Table<NodeRecord>

  constructor() {
    super('ThinkingSpaceDB')
    this.version(1).stores({
      nodes: '++id, &uuid, &key, type, parent, parentUuid, filePath, updatedAt, status, *tags',
    })
  }
}

let _db: ThinkingSpaceDB | null = null

function getDb(): ThinkingSpaceDB {
  if (!_db) _db = new ThinkingSpaceDB()
  return _db
}

// ── Public API ──

/**
 * Upsert a node from parsed YAML frontmatter.
 * Uses uuid as the unique identity — updates if exists, inserts if new.
 */
export async function upsertNode(
  record: Omit<NodeRecord, 'id'>,
): Promise<void> {
  const db = getDb()
  const existing = await db.nodes.where('uuid').equals(record.uuid).first()
  if (existing) {
    await db.nodes.update(existing.id!, record)
  } else {
    await db.nodes.add(record)
  }
}

/**
 * Get all children of a parent (by parent key).
 */
export async function getChildren(parentKey: string): Promise<NodeRecord[]> {
  const db = getDb()
  return db.nodes.where('parent').equals(parentKey).sortBy('title')
}

/**
 * Get a single node by key.
 */
export async function getNodeByKey(key: string): Promise<NodeRecord | undefined> {
  const db = getDb()
  return db.nodes.where('key').equals(key).first()
}

/**
 * Get a single node by uuid.
 */
export async function getNodeByUuid(uuid: string): Promise<NodeRecord | undefined> {
  const db = getDb()
  return db.nodes.where('uuid').equals(uuid).first()
}

/**
 * Get a node by its vault-relative file path.
 */
export async function getNodeByPath(filePath: string): Promise<NodeRecord | undefined> {
  const db = getDb()
  return db.nodes.where('filePath').equals(filePath).first()
}

/**
 * Get all root nodes (no parent).
 */
export async function getRootNodes(): Promise<NodeRecord[]> {
  const db = getDb()
  // Nodes without a parent field — filter manually since Dexie can't index undefined
  return (await db.nodes.toArray()).filter(n => !n.parent)
}

/**
 * Build a full tree from the database.
 * Returns a flat array; callers can use `parent` to construct tree structure.
 */
export async function getAllNodes(): Promise<NodeRecord[]> {
  const db = getDb()
  return db.nodes.orderBy('type').toArray()
}

/**
 * Get nodes by type.
 */
export async function getNodesByType(type: NodeType): Promise<NodeRecord[]> {
  const db = getDb()
  return db.nodes.where('type').equals(type).toArray()
}

/**
 * Simple text search across title, key, tags, bodyExcerpt, and aiSummary.
 * Returns nodes matching any search term.
 */
export async function searchNodes(query: string, limit: number = 20): Promise<NodeRecord[]> {
  const db = getDb()
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  const all = await db.nodes.toArray()
  const scored: Array<{ node: NodeRecord; score: number }> = []

  for (const node of all) {
    let score = 0
    const searchable = [
      node.title,
      node.key,
      ...(node.tags || []),
      node.bodyExcerpt || '',
      node.aiSummary || '',
    ].join(' ').toLowerCase()

    for (const term of terms) {
      if (searchable.includes(term)) score++
    }

    if (score > 0) scored.push({ node, score })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.node)
}

/**
 * Delete a node by uuid.
 */
export async function deleteNode(uuid: string): Promise<void> {
  const db = getDb()
  await db.nodes.where('uuid').equals(uuid).delete()
}

/**
 * Delete a node by file path (for when files are removed from vault).
 */
export async function deleteNodeByPath(filePath: string): Promise<void> {
  const db = getDb()
  await db.nodes.where('filePath').equals(filePath).delete()
}

/**
 * Clear all cached data. Used when rebuilding from vault.
 */
export async function clearAll(): Promise<void> {
  const db = getDb()
  await db.nodes.clear()
}

/**
 * Get total node count.
 */
export async function getNodeCount(): Promise<number> {
  const db = getDb()
  return db.nodes.count()
}

/**
 * Get all file paths currently in the cache.
 * Useful for detecting deleted files during sync.
 */
export async function getAllFilePaths(): Promise<Set<string>> {
  const db = getDb()
  const paths = await db.nodes.orderBy('filePath').keys()
  return new Set(paths as string[])
}

/**
 * Close the database connection. Useful for testing cleanup.
 */
export async function closeDb(): Promise<void> {
  if (_db) {
    _db.close()
    _db = null
  }
}

/**
 * Delete the entire database. Useful for testing or full reset.
 */
export async function deleteDb(): Promise<void> {
  if (_db) {
    _db.close()
    _db = null
  }
  await Dexie.delete('ThinkingSpaceDB')
}
