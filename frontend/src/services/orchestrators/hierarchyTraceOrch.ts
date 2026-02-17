import type { HierarchyNodeType } from '../lego_blocks/typesBlock'
import { getHierarchyNode, listHierarchyThoughtLinks, listHierarchyThoughts } from './hierarchyOrch'

const TRACE_THOUGHT_LIMIT = 5000
const MAX_CHAIN_DEPTH = 64

export interface ThoughtTraceNode {
  id: string
  type: HierarchyNodeType
  title: string
  parent_id: string | null
}

export interface ThoughtTraceRoute {
  link_id: string
  link_kind: string
  linked_at: string
  chain: ThoughtTraceNode[]
}

export interface ThoughtTraceResult {
  requested_path: string
  normalized_path: string
  thought_id: string | null
  thought_title: string | null
  routes: ThoughtTraceRoute[]
}

function normalizeVaultPath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

async function loadNodeChain(
  nodeId: string,
  cache: Map<string, ThoughtTraceNode>,
): Promise<ThoughtTraceNode[]> {
  const chain: ThoughtTraceNode[] = []
  let cursorId: string | null = nodeId
  let depth = 0

  while (cursorId && depth < MAX_CHAIN_DEPTH) {
    depth += 1
    let node = cache.get(cursorId)
    if (!node) {
      const fetched = await getHierarchyNode(cursorId)
      node = {
        id: fetched.id,
        type: fetched.type,
        title: fetched.title,
        parent_id: fetched.parent_id,
      }
      cache.set(cursorId, node)
    }
    chain.push(node)
    cursorId = node.parent_id
  }

  return chain.reverse()
}

export async function traceThoughtPath(path: string): Promise<ThoughtTraceResult> {
  const normalizedPath = normalizeVaultPath(path)
  const thoughts = await listHierarchyThoughts(false, TRACE_THOUGHT_LIMIT)
  const normalizedLower = normalizedPath.toLowerCase()
  const thought = thoughts.find(item => normalizeVaultPath(item.file_path).toLowerCase() === normalizedLower)

  if (!thought) {
    return {
      requested_path: path,
      normalized_path: normalizedPath,
      thought_id: null,
      thought_title: null,
      routes: [],
    }
  }

  const links = await listHierarchyThoughtLinks({ thought_id: thought.id })
  const nodeCache = new Map<string, ThoughtTraceNode>()
  const routes: ThoughtTraceRoute[] = []

  for (const link of links) {
    const chain = await loadNodeChain(link.node_id, nodeCache)
    routes.push({
      link_id: link.id,
      link_kind: link.link_kind,
      linked_at: link.created_at,
      chain,
    })
  }

  routes.sort((a, b) => Date.parse(b.linked_at) - Date.parse(a.linked_at))

  return {
    requested_path: path,
    normalized_path: normalizedPath,
    thought_id: thought.id,
    thought_title: thought.title ?? null,
    routes,
  }
}
