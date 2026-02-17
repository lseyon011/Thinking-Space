import type {
  HierarchyEdge,
  HierarchyNode,
  HierarchyNodeType,
  HierarchyPathResolution,
  HierarchyThought,
  HierarchyThoughtLink,
} from '../lego_blocks/typesBlock'
import {
  createHierarchyEdgeBlock,
  createHierarchyNodeBlock,
  createHierarchyThoughtLinkBlock,
  deleteHierarchyEdgeBlock,
  deleteHierarchyNodeBlock,
  deleteHierarchyThoughtLinkBlock,
  getHierarchyNodeBlock,
  listHierarchyEdgesBlock,
  listHierarchyNodesBlock,
  listHierarchyThoughtLinksBlock,
  listHierarchyThoughtsBlock,
  moveHierarchyNodeBlock,
  resolveHierarchyPathBlock,
  upsertHierarchyThoughtBlock,
  updateHierarchyNodeBlock,
} from '../lego_blocks/hierarchyBlock'

export async function listHierarchyNodes(
  parentId: string | null,
  nodeType?: HierarchyNodeType | null,
): Promise<HierarchyNode[]> {
  return listHierarchyNodesBlock({ parent_id: parentId, type: nodeType ?? null })
}

export async function getHierarchyNode(nodeId: string): Promise<HierarchyNode> {
  return getHierarchyNodeBlock(nodeId)
}

export async function createHierarchyNode(params: {
  type: HierarchyNodeType
  node_kind?: string | null
  title: string
  parent_id: string | null
  slug?: string | null
  sort_order?: number
}): Promise<HierarchyNode> {
  return createHierarchyNodeBlock({
    ...params,
    sort_order: params.sort_order ?? 0,
  })
}

export async function updateHierarchyNode(params: {
  node_id: string
  type?: HierarchyNodeType | null
  node_kind?: string | null
  title?: string | null
  slug?: string | null
  sort_order?: number | null
}): Promise<HierarchyNode> {
  return updateHierarchyNodeBlock(params)
}

export async function moveHierarchyNode(params: {
  node_id: string
  new_parent_id: string | null
  sort_order?: number | null
}): Promise<HierarchyNode> {
  return moveHierarchyNodeBlock(params)
}

export async function deleteHierarchyNode(nodeId: string): Promise<{ success: boolean }> {
  return deleteHierarchyNodeBlock(nodeId)
}

export async function upsertHierarchyThought(params: {
  file_path: string
  title?: string | null
}): Promise<HierarchyThought> {
  return upsertHierarchyThoughtBlock(params)
}

export async function listHierarchyThoughts(
  unlinkedOnly = false,
  limit = 200,
): Promise<HierarchyThought[]> {
  return listHierarchyThoughtsBlock({ unlinked_only: unlinkedOnly, limit })
}

export async function listHierarchyThoughtLinks(params: {
  thought_id?: string | null
  node_id?: string | null
}): Promise<HierarchyThoughtLink[]> {
  return listHierarchyThoughtLinksBlock(params)
}

export async function createHierarchyThoughtLink(params: {
  thought_id: string
  node_id: string
  link_kind?: string | null
}): Promise<HierarchyThoughtLink> {
  return createHierarchyThoughtLinkBlock(params)
}

export async function deleteHierarchyThoughtLink(linkId: string): Promise<{ success: boolean }> {
  return deleteHierarchyThoughtLinkBlock(linkId)
}

export async function listHierarchyEdges(params: {
  from_node_id?: string | null
  to_node_id?: string | null
}): Promise<HierarchyEdge[]> {
  return listHierarchyEdgesBlock(params)
}

export async function createHierarchyEdge(params: {
  from_node_id: string
  to_node_id: string
  edge_kind?: string | null
}): Promise<HierarchyEdge> {
  return createHierarchyEdgeBlock(params)
}

export async function deleteHierarchyEdge(edgeId: string): Promise<{ success: boolean }> {
  return deleteHierarchyEdgeBlock(edgeId)
}

export async function resolveHierarchyPath(requestedPath: string): Promise<HierarchyPathResolution> {
  return resolveHierarchyPathBlock(requestedPath)
}
