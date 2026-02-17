import * as path from 'path'
import { randomUUID } from 'crypto'

import {
  ensureHierarchyDbInitializedBlock,
  runSqliteExecBlock,
  runSqliteJsonQueryBlock,
} from './hierarchyDbBlock'
import {
  copyAndArchivePathTransitionBlock,
  ensureNodeMarkdownFileBlock,
  normalizeHierarchyRelativePathBlock,
} from './hierarchyPathBlock'

export type NodeTypeBlock = 'project' | 'epic' | 'idea'

const NODE_TYPES_BLOCK: NodeTypeBlock[] = ['project', 'epic', 'idea']
export const HIERARCHY_CONTENT_PREFIX = '.ltm-pilot/thinking_organizer'
const PARENT_TYPE_RULES_BLOCK: Record<NodeTypeBlock, NodeTypeBlock[] | null> = {
  project: null,
  epic: ['project', 'epic', 'idea'],
  idea: ['project', 'epic', 'idea'],
}

export class HierarchyRepoError extends Error {}
export class HierarchyNotFoundError extends HierarchyRepoError {}
export class HierarchyValidationError extends HierarchyRepoError {}

export interface HierarchyNodeBlock {
  id: string
  type: NodeTypeBlock
  node_kind: string
  title: string
  slug: string
  parent_id: string | null
  file_path: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface HierarchyThoughtBlock {
  id: string
  title: string | null
  slug: string
  file_path: string
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
  link_count: number
}

export interface HierarchyThoughtLinkBlock {
  id: string
  thought_id: string
  node_id: string
  link_kind: string
  created_at: string
}

export interface HierarchyEdgeBlock {
  id: string
  from_node_id: string
  to_node_id: string
  edge_kind: string
  created_at: string
}

export interface PathResolutionBlock {
  requested_path: string
  resolved_path: string
  target_type: 'node' | 'thought'
  target_id: string
  via_alias: boolean
}

function nowIsoBlock(): string {
  return new Date().toISOString()
}

function sqlQuoteBlock(value: string | null): string {
  if (value === null) return 'NULL'
  return `'${value.replace(/'/g, "''")}'`
}

function slugifyBlock(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const truncated = cleaned.slice(0, 80).replace(/^-+|-+$/g, '')
  return truncated || 'item'
}

function ensureNodeTypeBlock(value: string): NodeTypeBlock {
  if (NODE_TYPES_BLOCK.includes(value as NodeTypeBlock)) {
    return value as NodeTypeBlock
  }
  throw new HierarchyValidationError(`Invalid node type: ${value}`)
}

function nodeFromRowBlock(row: Record<string, unknown>): HierarchyNodeBlock {
  const fallbackKind = String(row.type) === 'project' ? 'Project' : String(row.type) === 'epic' ? 'Epic' : 'Idea'
  return {
    id: String(row.id),
    type: ensureNodeTypeBlock(String(row.type)),
    node_kind: row.node_kind == null ? fallbackKind : String(row.node_kind),
    title: String(row.title),
    slug: String(row.slug),
    parent_id: row.parent_id == null ? null : String(row.parent_id),
    file_path: String(row.file_path),
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function thoughtFromRowBlock(row: Record<string, unknown>): HierarchyThoughtBlock {
  return {
    id: String(row.id),
    title: row.title == null ? null : String(row.title),
    slug: String(row.slug),
    file_path: String(row.file_path),
    status: String(row.status) === 'archived' ? 'archived' : 'active',
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    link_count: Number(row.link_count ?? 0),
  }
}

function thoughtLinkFromRowBlock(row: Record<string, unknown>): HierarchyThoughtLinkBlock {
  return {
    id: String(row.id),
    thought_id: String(row.thought_id),
    node_id: String(row.node_id),
    link_kind: String(row.link_kind),
    created_at: String(row.created_at),
  }
}

function edgeFromRowBlock(row: Record<string, unknown>): HierarchyEdgeBlock {
  return {
    id: String(row.id),
    from_node_id: String(row.from_node_id),
    to_node_id: String(row.to_node_id),
    edge_kind: String(row.edge_kind),
    created_at: String(row.created_at),
  }
}

function getNodeRowRequiredBlock(dbPath: string, nodeId: string): Record<string, unknown> {
  const rows = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT * FROM nodes WHERE id = ${sqlQuoteBlock(nodeId)} LIMIT 1;`,
  )
  if (rows.length === 0) throw new HierarchyNotFoundError(`Node not found: ${nodeId}`)
  return rows[0]
}

function validateParentTypeBlock(dbPath: string, nodeType: NodeTypeBlock, parentId: string | null): void {
  const expectedParentTypes = PARENT_TYPE_RULES_BLOCK[nodeType]
  if (expectedParentTypes === null) {
    if (parentId !== null) {
      throw new HierarchyValidationError('Project nodes cannot have a parent')
    }
    return
  }
  if (parentId === null) {
    throw new HierarchyValidationError(`${nodeType} nodes require a parent`)
  }
  const parent = getNodeRowRequiredBlock(dbPath, parentId)
  if (!expectedParentTypes.includes(String(parent.type) as NodeTypeBlock)) {
    throw new HierarchyValidationError(
      `Invalid parent type for ${nodeType}: expected one of [${expectedParentTypes.join(', ')}], got ${String(parent.type)}`,
    )
  }
}

function ensureUniqueNodeSlugBlock(
  dbPath: string,
  nodeType: NodeTypeBlock,
  baseSlug: string,
  excludeNodeId: string | null = null,
): string {
  let candidate = baseSlug
  let suffix = 2
  while (true) {
    const whereExclude = excludeNodeId ? ` AND id <> ${sqlQuoteBlock(excludeNodeId)}` : ''
    const rows = runSqliteJsonQueryBlock<Record<string, unknown>>(
      dbPath,
      `SELECT id FROM nodes WHERE type = ${sqlQuoteBlock(nodeType)} AND slug = ${sqlQuoteBlock(candidate)}${whereExclude} LIMIT 1;`,
    )
    if (rows.length === 0) return candidate
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

function ensureUniqueThoughtSlugBlock(
  dbPath: string,
  baseSlug: string,
  excludeThoughtId: string | null = null,
): string {
  let candidate = baseSlug
  let suffix = 2
  while (true) {
    const whereExclude = excludeThoughtId ? ` AND id <> ${sqlQuoteBlock(excludeThoughtId)}` : ''
    const rows = runSqliteJsonQueryBlock<Record<string, unknown>>(
      dbPath,
      `SELECT id FROM thoughts WHERE slug = ${sqlQuoteBlock(candidate)}${whereExclude} LIMIT 1;`,
    )
    if (rows.length === 0) return candidate
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

function computeNodeFilePathBlock(
  dbPath: string,
  nodeType: NodeTypeBlock,
  slug: string,
  parentId: string | null,
): string {
  if (nodeType === 'project') {
    return `${HIERARCHY_CONTENT_PREFIX}/projects/${slug}/project.md`
  }
  if (!parentId) throw new HierarchyValidationError(`${nodeType} node requires a parent`)
  const parent = getNodeRowRequiredBlock(dbPath, parentId)
  const parentType = String(parent.type)
  if (parentType === 'project') {
    const projectSlug = String(parent.slug)
    if (nodeType === 'epic') return `${HIERARCHY_CONTENT_PREFIX}/projects/${projectSlug}/epics/${slug}/epic.md`
    if (nodeType === 'idea') return `${HIERARCHY_CONTENT_PREFIX}/projects/${projectSlug}/ideas/${slug}.md`
  }
  const parentFilePath = String(parent.file_path)
  const parentDir = parentFilePath.includes('/') ? parentFilePath.slice(0, parentFilePath.lastIndexOf('/')) : ''
  if (nodeType === 'epic') {
    return `${parentDir}/${String(parent.slug)}/epics/${slug}/epic.md`
  }
  if (nodeType === 'idea') {
    if (parentType === 'idea') return `${parentDir}/${String(parent.slug)}/${slug}.md`
    return `${parentDir}/${String(parent.slug)}/ideas/${slug}.md`
  }
  throw new HierarchyValidationError(`Unsupported node type: ${nodeType}`)
}

function isDescendantBlock(dbPath: string, ancestorId: string, candidateDescendantId: string): boolean {
  const rows = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `
WITH RECURSIVE subtree(id) AS (
  SELECT id FROM nodes WHERE id = ${sqlQuoteBlock(ancestorId)}
  UNION ALL
  SELECT n.id FROM nodes n
  JOIN subtree s ON n.parent_id = s.id
)
SELECT 1 AS present FROM subtree WHERE id = ${sqlQuoteBlock(candidateDescendantId)} LIMIT 1;
`.trim(),
  )
  return rows.length > 0
}

function refreshSubtreePathsBlock(dbPath: string, nodeId: string): void {
  const node = nodeFromRowBlock(getNodeRowRequiredBlock(dbPath, nodeId))
  const nextPath = computeNodeFilePathBlock(dbPath, node.type, node.slug, node.parent_id)
  if (nextPath !== node.file_path) {
    runSqliteExecBlock(
      dbPath,
      `UPDATE nodes SET file_path = ${sqlQuoteBlock(nextPath)}, updated_at = ${sqlQuoteBlock(nowIsoBlock())} WHERE id = ${sqlQuoteBlock(node.id)};`,
    )
  }

  const childRows = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT id FROM nodes WHERE parent_id = ${sqlQuoteBlock(node.id)} ORDER BY sort_order, id;`,
  )
  for (const childRow of childRows) {
    refreshSubtreePathsBlock(dbPath, String(childRow.id))
  }
}

function readSubtreeRowsBlock(dbPath: string, nodeId: string): Record<string, unknown>[] {
  return runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `
WITH RECURSIVE subtree(id) AS (
  SELECT id FROM nodes WHERE id = ${sqlQuoteBlock(nodeId)}
  UNION ALL
  SELECT n.id FROM nodes n
  JOIN subtree s ON n.parent_id = s.id
)
SELECT n.*
FROM nodes n
JOIN subtree s ON n.id = s.id
ORDER BY n.id;
`.trim(),
  )
}

function syncSubtreePathTransitionsBlock(params: {
  vaultRoot: string
  dbPath: string
  beforePaths: Record<string, string>
  afterPaths: Record<string, string>
}): void {
  for (const [targetId, oldPath] of Object.entries(params.beforePaths)) {
    const nextPath = params.afterPaths[targetId]
    if (!nextPath || nextPath === oldPath) continue

    const oldRel = normalizeHierarchyRelativePathBlock(oldPath)
    const nextRel = normalizeHierarchyRelativePathBlock(nextPath)
    try {
      copyAndArchivePathTransitionBlock({
        vaultRoot: params.vaultRoot,
        fromRelativePath: oldRel,
        toRelativePath: nextRel,
      })
    } catch (err) {
      throw new HierarchyValidationError(err instanceof Error ? err.message : 'Path transition failed')
    }

    runSqliteExecBlock(
      params.dbPath,
      `
INSERT INTO path_aliases (id, alias_path, target_type, target_id, is_active, created_at)
VALUES (
  ${sqlQuoteBlock(randomUUID())},
  ${sqlQuoteBlock(oldRel)},
  'node',
  ${sqlQuoteBlock(targetId)},
  1,
  ${sqlQuoteBlock(nowIsoBlock())}
)
ON CONFLICT(alias_path) DO UPDATE SET
  target_type = excluded.target_type,
  target_id = excluded.target_id,
  is_active = 1;
`.trim(),
    )
  }
}

export function listNodesBlock(
  vaultRoot: string,
  params: { parent_id: string | null; type?: NodeTypeBlock | null },
): HierarchyNodeBlock[] {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  const whereParts: string[] = []
  if (params.parent_id === null) whereParts.push('parent_id IS NULL')
  else whereParts.push(`parent_id = ${sqlQuoteBlock(params.parent_id)}`)
  if (params.type) whereParts.push(`type = ${sqlQuoteBlock(params.type)}`)
  const whereSql = whereParts.join(' AND ')
  const rows = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT * FROM nodes WHERE ${whereSql} ORDER BY sort_order, created_at, id;`,
  )
  return rows.map(nodeFromRowBlock)
}

export function getNodeBlock(vaultRoot: string, nodeId: string): HierarchyNodeBlock {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  return nodeFromRowBlock(getNodeRowRequiredBlock(dbPath, nodeId))
}

export function createNodeBlock(
  vaultRoot: string,
  params: {
    type: NodeTypeBlock
    node_kind?: string | null
    title: string
    parent_id: string | null
    slug?: string | null
    sort_order: number
  },
): HierarchyNodeBlock {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  const nodeType = ensureNodeTypeBlock(params.type)
  const title = params.title.trim()
  if (!title) throw new HierarchyValidationError('Node title cannot be empty')
  const nodeKind = (params.node_kind ?? '').trim() || (nodeType === 'project' ? 'Project' : nodeType === 'epic' ? 'Epic' : 'Idea')

  validateParentTypeBlock(dbPath, nodeType, params.parent_id)
  const baseSlug = slugifyBlock(params.slug ? params.slug : title)
  const uniqueSlug = ensureUniqueNodeSlugBlock(dbPath, nodeType, baseSlug)
  const filePath = computeNodeFilePathBlock(dbPath, nodeType, uniqueSlug, params.parent_id)
  const now = nowIsoBlock()
  const nodeId = randomUUID()
  const safeSortOrder = Number.isFinite(params.sort_order) ? params.sort_order : 0

  runSqliteExecBlock(
    dbPath,
    `
INSERT INTO nodes (id, type, node_kind, title, slug, parent_id, file_path, sort_order, created_at, updated_at)
VALUES (
  ${sqlQuoteBlock(nodeId)},
  ${sqlQuoteBlock(nodeType)},
  ${sqlQuoteBlock(nodeKind)},
  ${sqlQuoteBlock(title)},
  ${sqlQuoteBlock(uniqueSlug)},
  ${sqlQuoteBlock(params.parent_id)},
  ${sqlQuoteBlock(filePath)},
  ${String(safeSortOrder)},
  ${sqlQuoteBlock(now)},
  ${sqlQuoteBlock(now)}
);
`.trim(),
  )

  try {
    ensureNodeMarkdownFileBlock({
      vaultRoot,
      relativePath: filePath,
      nodeType,
      title,
    })
  } catch (err) {
    runSqliteExecBlock(dbPath, `DELETE FROM nodes WHERE id = ${sqlQuoteBlock(nodeId)};`)
    throw new HierarchyRepoError(err instanceof Error ? err.message : 'Failed to create node file')
  }

  return getNodeBlock(vaultRoot, nodeId)
}

export function updateNodeBlock(
  vaultRoot: string,
  params: {
    node_id: string
    type?: NodeTypeBlock | null
    node_kind?: string | null
    title?: string | null
    slug?: string | null
    sort_order?: number | null
  },
): HierarchyNodeBlock {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  const current = nodeFromRowBlock(getNodeRowRequiredBlock(dbPath, params.node_id))
  const beforePaths = Object.fromEntries(
    readSubtreeRowsBlock(dbPath, current.id).map(row => [String(row.id), String(row.file_path)]),
  )

  const nextType = params.type == null ? current.type : params.type
  if (!(nextType in PARENT_TYPE_RULES_BLOCK)) {
    throw new HierarchyValidationError(`Unsupported node type: ${String(nextType)}`)
  }
  validateParentTypeBlock(dbPath, nextType, current.parent_id)

  const nextTitle = params.title == null ? current.title : params.title.trim()
  if (!nextTitle) throw new HierarchyValidationError('Node title cannot be empty')
  const defaultKind = nextType === 'project' ? 'Project' : nextType === 'epic' ? 'Epic' : 'Idea'
  const nextNodeKind = params.node_kind == null ? current.node_kind : (params.node_kind.trim() || defaultKind)

  let nextSlug = current.slug
  if (params.slug != null || nextType !== current.type) {
    const slugSource = params.slug ?? current.slug
    nextSlug = ensureUniqueNodeSlugBlock(
      dbPath,
      nextType,
      slugifyBlock(slugSource),
      current.id,
    )
  }

  const nextSortOrder = params.sort_order == null ? current.sort_order : params.sort_order
  runSqliteExecBlock(
    dbPath,
    `
UPDATE nodes
SET
  type = ${sqlQuoteBlock(nextType)},
  node_kind = ${sqlQuoteBlock(nextNodeKind)},
  title = ${sqlQuoteBlock(nextTitle)},
  slug = ${sqlQuoteBlock(nextSlug)},
  sort_order = ${String(nextSortOrder)},
  updated_at = ${sqlQuoteBlock(nowIsoBlock())}
WHERE id = ${sqlQuoteBlock(current.id)};
`.trim(),
  )

  if (nextSlug !== current.slug || nextType !== current.type) {
    refreshSubtreePathsBlock(dbPath, current.id)
  } else {
    const nextPath = computeNodeFilePathBlock(dbPath, nextType, nextSlug, current.parent_id)
    if (nextPath !== current.file_path) {
      runSqliteExecBlock(
        dbPath,
        `UPDATE nodes SET file_path = ${sqlQuoteBlock(nextPath)}, updated_at = ${sqlQuoteBlock(nowIsoBlock())} WHERE id = ${sqlQuoteBlock(current.id)};`,
      )
    }
  }
  const afterPaths = Object.fromEntries(
    readSubtreeRowsBlock(dbPath, current.id).map(row => [String(row.id), String(row.file_path)]),
  )
  syncSubtreePathTransitionsBlock({
    vaultRoot,
    dbPath,
    beforePaths,
    afterPaths,
  })

  const updated = getNodeBlock(vaultRoot, current.id)
  ensureNodeMarkdownFileBlock({
    vaultRoot,
    relativePath: updated.file_path,
    nodeType: updated.type,
    title: updated.title,
  })

  return updated
}

export function moveNodeBlock(
  vaultRoot: string,
  params: {
    node_id: string
    new_parent_id: string | null
    sort_order?: number | null
  },
): HierarchyNodeBlock {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  const node = nodeFromRowBlock(getNodeRowRequiredBlock(dbPath, params.node_id))
  const beforePaths = Object.fromEntries(
    readSubtreeRowsBlock(dbPath, node.id).map(row => [String(row.id), String(row.file_path)]),
  )
  if (params.new_parent_id === node.id) {
    throw new HierarchyValidationError('Node cannot be moved under itself')
  }
  if (params.new_parent_id && isDescendantBlock(dbPath, node.id, params.new_parent_id)) {
    throw new HierarchyValidationError('Node cannot be moved under its own descendant')
  }

  validateParentTypeBlock(dbPath, node.type, params.new_parent_id)
  const nextSortOrder = params.sort_order == null ? node.sort_order : params.sort_order
  runSqliteExecBlock(
    dbPath,
    `
UPDATE nodes
SET
  parent_id = ${sqlQuoteBlock(params.new_parent_id)},
  sort_order = ${String(nextSortOrder)},
  updated_at = ${sqlQuoteBlock(nowIsoBlock())}
WHERE id = ${sqlQuoteBlock(node.id)};
`.trim(),
  )

  refreshSubtreePathsBlock(dbPath, node.id)
  const afterPaths = Object.fromEntries(
    readSubtreeRowsBlock(dbPath, node.id).map(row => [String(row.id), String(row.file_path)]),
  )
  syncSubtreePathTransitionsBlock({
    vaultRoot,
    dbPath,
    beforePaths,
    afterPaths,
  })
  const moved = getNodeBlock(vaultRoot, node.id)
  ensureNodeMarkdownFileBlock({
    vaultRoot,
    relativePath: moved.file_path,
    nodeType: moved.type,
    title: moved.title,
  })
  return moved
}

export function deleteNodeBlock(vaultRoot: string, nodeId: string): { success: boolean } {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  getNodeRowRequiredBlock(dbPath, nodeId)
  const children = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT id FROM nodes WHERE parent_id = ${sqlQuoteBlock(nodeId)} LIMIT 1;`,
  )
  if (children.length > 0) throw new HierarchyValidationError('Cannot delete node with children')
  runSqliteExecBlock(dbPath, `DELETE FROM nodes WHERE id = ${sqlQuoteBlock(nodeId)};`)
  return { success: true }
}

export function upsertThoughtBlock(
  vaultRoot: string,
  params: { file_path: string; title?: string | null },
): HierarchyThoughtBlock {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  let filePath: string
  try {
    filePath = normalizeHierarchyRelativePathBlock(params.file_path)
  } catch (err) {
    throw new HierarchyValidationError(err instanceof Error ? err.message : 'Invalid thought path')
  }
  const existing = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT * FROM thoughts WHERE file_path = ${sqlQuoteBlock(filePath)} LIMIT 1;`,
  )

  if (existing.length > 0) {
    const row = existing[0]
    const nextTitle = params.title == null ? row.title : params.title.trim()
    runSqliteExecBlock(
      dbPath,
      `
UPDATE thoughts
SET title = ${sqlQuoteBlock(nextTitle == null ? null : String(nextTitle))}, updated_at = ${sqlQuoteBlock(nowIsoBlock())}
WHERE id = ${sqlQuoteBlock(String(row.id))};
`.trim(),
    )
    const reloaded = runSqliteJsonQueryBlock<Record<string, unknown>>(
      dbPath,
      `SELECT t.*, COUNT(l.id) AS link_count FROM thoughts t LEFT JOIN thought_node_links l ON l.thought_id = t.id WHERE t.id = ${sqlQuoteBlock(String(row.id))} GROUP BY t.id LIMIT 1;`,
    )
    return thoughtFromRowBlock(reloaded[0])
  }

  const stem = path.basename(filePath).replace(/\.(md|markdown|txt)$/i, '')
  const baseSlug = slugifyBlock(stem)
  const uniqueSlug = ensureUniqueThoughtSlugBlock(dbPath, baseSlug)
  const thoughtId = randomUUID()
  const title = params.title != null && params.title.trim() ? params.title.trim() : null
  const now = nowIsoBlock()
  runSqliteExecBlock(
    dbPath,
    `
INSERT INTO thoughts (id, title, slug, file_path, status, created_at, updated_at)
VALUES (
  ${sqlQuoteBlock(thoughtId)},
  ${sqlQuoteBlock(title)},
  ${sqlQuoteBlock(uniqueSlug)},
  ${sqlQuoteBlock(filePath)},
  'active',
  ${sqlQuoteBlock(now)},
  ${sqlQuoteBlock(now)}
);
`.trim(),
  )
  const created = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT t.*, 0 AS link_count FROM thoughts t WHERE t.id = ${sqlQuoteBlock(thoughtId)} LIMIT 1;`,
  )
  return thoughtFromRowBlock(created[0])
}

export function listThoughtsBlock(
  vaultRoot: string,
  params: { unlinked_only: boolean; limit: number },
): HierarchyThoughtBlock[] {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  const safeLimit = Math.max(1, Math.min(params.limit, 1000))
  const sql = params.unlinked_only
    ? `
SELECT t.*, 0 AS link_count
FROM thoughts t
LEFT JOIN thought_node_links l ON l.thought_id = t.id
WHERE t.status = 'active' AND l.id IS NULL
ORDER BY t.updated_at DESC
LIMIT ${safeLimit};
`.trim()
    : `
SELECT t.*, COUNT(l.id) AS link_count
FROM thoughts t
LEFT JOIN thought_node_links l ON l.thought_id = t.id
WHERE t.status = 'active'
GROUP BY t.id
ORDER BY t.updated_at DESC
LIMIT ${safeLimit};
`.trim()
  const rows = runSqliteJsonQueryBlock<Record<string, unknown>>(dbPath, sql)
  return rows.map(thoughtFromRowBlock)
}

export function listThoughtLinksBlock(
  vaultRoot: string,
  params: { thought_id?: string | null; node_id?: string | null },
): HierarchyThoughtLinkBlock[] {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  const where: string[] = []
  if (params.thought_id) where.push(`thought_id = ${sqlQuoteBlock(params.thought_id)}`)
  if (params.node_id) where.push(`node_id = ${sqlQuoteBlock(params.node_id)}`)
  const whereSql = where.length ? where.join(' AND ') : '1=1'
  const rows = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT * FROM thought_node_links WHERE ${whereSql} ORDER BY created_at DESC, id DESC;`,
  )
  return rows.map(thoughtLinkFromRowBlock)
}

export function createThoughtLinkBlock(
  vaultRoot: string,
  params: { thought_id: string; node_id: string; link_kind?: string | null },
): HierarchyThoughtLinkBlock {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  const thought = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT id FROM thoughts WHERE id = ${sqlQuoteBlock(params.thought_id)} LIMIT 1;`,
  )
  if (thought.length === 0) throw new HierarchyNotFoundError(`Thought not found: ${params.thought_id}`)
  getNodeRowRequiredBlock(dbPath, params.node_id)

  const linkKind = params.link_kind && params.link_kind.trim() ? params.link_kind.trim() : 'context'
  const existing = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `
SELECT * FROM thought_node_links
WHERE thought_id = ${sqlQuoteBlock(params.thought_id)}
  AND node_id = ${sqlQuoteBlock(params.node_id)}
  AND link_kind = ${sqlQuoteBlock(linkKind)}
LIMIT 1;
`.trim(),
  )
  if (existing.length > 0) return thoughtLinkFromRowBlock(existing[0])

  const linkId = randomUUID()
  runSqliteExecBlock(
    dbPath,
    `
INSERT INTO thought_node_links (id, thought_id, node_id, link_kind, created_at)
VALUES (
  ${sqlQuoteBlock(linkId)},
  ${sqlQuoteBlock(params.thought_id)},
  ${sqlQuoteBlock(params.node_id)},
  ${sqlQuoteBlock(linkKind)},
  ${sqlQuoteBlock(nowIsoBlock())}
);
`.trim(),
  )
  const created = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT * FROM thought_node_links WHERE id = ${sqlQuoteBlock(linkId)} LIMIT 1;`,
  )
  return thoughtLinkFromRowBlock(created[0])
}

export function deleteThoughtLinkBlock(vaultRoot: string, linkId: string): { success: boolean } {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  const existing = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT id FROM thought_node_links WHERE id = ${sqlQuoteBlock(linkId)} LIMIT 1;`,
  )
  if (existing.length === 0) return { success: false }
  runSqliteExecBlock(dbPath, `DELETE FROM thought_node_links WHERE id = ${sqlQuoteBlock(linkId)};`)
  return { success: true }
}

export function createEdgeBlock(
  vaultRoot: string,
  params: { from_node_id: string; to_node_id: string; edge_kind?: string | null },
): HierarchyEdgeBlock {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  if (params.from_node_id === params.to_node_id) {
    throw new HierarchyValidationError('Cannot link a node to itself')
  }
  getNodeRowRequiredBlock(dbPath, params.from_node_id)
  getNodeRowRequiredBlock(dbPath, params.to_node_id)
  const edgeKind = (params.edge_kind ?? '').trim() || 'related'
  const existing = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `
SELECT * FROM edges
WHERE from_node_id = ${sqlQuoteBlock(params.from_node_id)}
  AND to_node_id = ${sqlQuoteBlock(params.to_node_id)}
  AND edge_kind = ${sqlQuoteBlock(edgeKind)}
LIMIT 1;
`.trim(),
  )
  if (existing.length > 0) return edgeFromRowBlock(existing[0])

  const edgeId = randomUUID()
  runSqliteExecBlock(
    dbPath,
    `
INSERT INTO edges (id, from_node_id, to_node_id, edge_kind, created_at)
VALUES (
  ${sqlQuoteBlock(edgeId)},
  ${sqlQuoteBlock(params.from_node_id)},
  ${sqlQuoteBlock(params.to_node_id)},
  ${sqlQuoteBlock(edgeKind)},
  ${sqlQuoteBlock(nowIsoBlock())}
);
`.trim(),
  )
  const rows = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT * FROM edges WHERE id = ${sqlQuoteBlock(edgeId)} LIMIT 1;`,
  )
  return edgeFromRowBlock(rows[0])
}

export function listEdgesBlock(
  vaultRoot: string,
  params: { from_node_id?: string | null; to_node_id?: string | null },
): HierarchyEdgeBlock[] {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  const whereParts: string[] = []
  if (params.from_node_id) whereParts.push(`from_node_id = ${sqlQuoteBlock(params.from_node_id)}`)
  if (params.to_node_id) whereParts.push(`to_node_id = ${sqlQuoteBlock(params.to_node_id)}`)
  const whereSql = whereParts.length > 0 ? whereParts.join(' AND ') : '1=1'
  const rows = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT * FROM edges WHERE ${whereSql} ORDER BY created_at DESC, id DESC;`,
  )
  return rows.map(edgeFromRowBlock)
}

export function deleteEdgeBlock(vaultRoot: string, edgeId: string): { success: boolean } {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  runSqliteExecBlock(dbPath, `DELETE FROM edges WHERE id = ${sqlQuoteBlock(edgeId)};`)
  return { success: true }
}

export function resolveHierarchyPathBlock(vaultRoot: string, requestedPath: string): PathResolutionBlock | null {
  const dbPath = ensureHierarchyDbInitializedBlock(vaultRoot)
  let cleanPath: string
  try {
    cleanPath = normalizeHierarchyRelativePathBlock(requestedPath)
  } catch (err) {
    throw new HierarchyValidationError(err instanceof Error ? err.message : 'Invalid path')
  }

  const node = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT id, file_path FROM nodes WHERE file_path = ${sqlQuoteBlock(cleanPath)} LIMIT 1;`,
  )
  if (node.length > 0) {
    return {
      requested_path: cleanPath,
      resolved_path: String(node[0].file_path),
      target_type: 'node',
      target_id: String(node[0].id),
      via_alias: false,
    }
  }

  const thought = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `SELECT id, file_path FROM thoughts WHERE file_path = ${sqlQuoteBlock(cleanPath)} LIMIT 1;`,
  )
  if (thought.length > 0) {
    return {
      requested_path: cleanPath,
      resolved_path: String(thought[0].file_path),
      target_type: 'thought',
      target_id: String(thought[0].id),
      via_alias: false,
    }
  }

  const alias = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    `
SELECT target_type, target_id
FROM path_aliases
WHERE alias_path = ${sqlQuoteBlock(cleanPath)}
  AND is_active = 1
LIMIT 1;
`.trim(),
  )
  if (alias.length === 0) return null

  const targetType = String(alias[0].target_type) === 'thought' ? 'thought' : 'node'
  const targetId = String(alias[0].target_id)
  const targetRows = runSqliteJsonQueryBlock<Record<string, unknown>>(
    dbPath,
    targetType === 'node'
      ? `SELECT file_path FROM nodes WHERE id = ${sqlQuoteBlock(targetId)} LIMIT 1;`
      : `SELECT file_path FROM thoughts WHERE id = ${sqlQuoteBlock(targetId)} LIMIT 1;`,
  )
  if (targetRows.length === 0) return null

  return {
    requested_path: cleanPath,
    resolved_path: String(targetRows[0].file_path),
    target_type: targetType,
    target_id: targetId,
    via_alias: true,
  }
}
