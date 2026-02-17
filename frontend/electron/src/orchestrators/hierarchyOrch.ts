import {
  createEdgeBlock,
  createNodeBlock,
  createThoughtLinkBlock,
  deleteEdgeBlock,
  deleteNodeBlock,
  deleteThoughtLinkBlock,
  getNodeBlock,
  listEdgesBlock,
  listNodesBlock,
  listThoughtLinksBlock,
  listThoughtsBlock,
  moveNodeBlock,
  resolveHierarchyPathBlock,
  upsertThoughtBlock,
  updateNodeBlock,
  type NodeTypeBlock,
} from '../lego_blocks/hierarchyRepoBlock'

export function listHierarchyNodesOrch(
  vaultRoot: string,
  params: { parent_id: string | null; type?: NodeTypeBlock | null },
) {
  return listNodesBlock(vaultRoot, params)
}

export function getHierarchyNodeOrch(vaultRoot: string, nodeId: string) {
  return getNodeBlock(vaultRoot, nodeId)
}

export function createHierarchyNodeOrch(
  vaultRoot: string,
  params: { type: NodeTypeBlock; node_kind?: string | null; title: string; parent_id: string | null; slug?: string | null; sort_order: number },
) {
  return createNodeBlock(vaultRoot, params)
}

export function updateHierarchyNodeOrch(
  vaultRoot: string,
  params: { node_id: string; type?: NodeTypeBlock | null; node_kind?: string | null; title?: string | null; slug?: string | null; sort_order?: number | null },
) {
  return updateNodeBlock(vaultRoot, params)
}

export function moveHierarchyNodeOrch(
  vaultRoot: string,
  params: { node_id: string; new_parent_id: string | null; sort_order?: number | null },
) {
  return moveNodeBlock(vaultRoot, params)
}

export function deleteHierarchyNodeOrch(vaultRoot: string, nodeId: string) {
  return deleteNodeBlock(vaultRoot, nodeId)
}

export function upsertHierarchyThoughtOrch(
  vaultRoot: string,
  params: { file_path: string; title?: string | null },
) {
  return upsertThoughtBlock(vaultRoot, params)
}

export function listHierarchyThoughtsOrch(
  vaultRoot: string,
  params: { unlinked_only: boolean; limit: number },
) {
  return listThoughtsBlock(vaultRoot, params)
}

export function listHierarchyThoughtLinksOrch(
  vaultRoot: string,
  params: { thought_id?: string | null; node_id?: string | null },
) {
  return listThoughtLinksBlock(vaultRoot, params)
}

export function createHierarchyThoughtLinkOrch(
  vaultRoot: string,
  params: { thought_id: string; node_id: string; link_kind?: string | null },
) {
  return createThoughtLinkBlock(vaultRoot, params)
}

export function deleteHierarchyThoughtLinkOrch(vaultRoot: string, linkId: string) {
  return deleteThoughtLinkBlock(vaultRoot, linkId)
}

export function createHierarchyEdgeOrch(
  vaultRoot: string,
  params: { from_node_id: string; to_node_id: string; edge_kind?: string | null },
) {
  return createEdgeBlock(vaultRoot, params)
}

export function listHierarchyEdgesOrch(
  vaultRoot: string,
  params: { from_node_id?: string | null; to_node_id?: string | null },
) {
  return listEdgesBlock(vaultRoot, params)
}

export function deleteHierarchyEdgeOrch(vaultRoot: string, edgeId: string) {
  return deleteEdgeBlock(vaultRoot, edgeId)
}

export function resolveHierarchyPathOrch(vaultRoot: string, requestedPath: string) {
  return resolveHierarchyPathBlock(vaultRoot, requestedPath)
}
