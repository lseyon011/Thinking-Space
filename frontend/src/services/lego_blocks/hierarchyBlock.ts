import type {
  HierarchyEdge,
  HierarchyNode,
  HierarchyNodeType,
  HierarchyPathResolution,
  HierarchyThought,
  HierarchyThoughtLink,
} from './typesBlock'
import { getStoredVaultRoot } from './storageKeyBlock'

function getElectronVaultRootBlock(): string {
  const vaultRoot = getStoredVaultRoot()
  if (!vaultRoot) throw new Error('Vault root not configured')
  return vaultRoot
}

async function parseJsonOrThrowBlock<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>

  const detailToMessage = (detail: unknown): string => {
    if (typeof detail === 'string') return detail
    if (typeof detail === 'number' || typeof detail === 'boolean') return String(detail)
    if (Array.isArray(detail)) {
      const parts = detail
        .map(item => detailToMessage(item))
        .map(part => part.trim())
        .filter(Boolean)
      if (parts.length > 0) return parts.join('; ')
      try {
        return JSON.stringify(detail)
      } catch {
        return String(detail)
      }
    }
    if (detail && typeof detail === 'object') {
      const record = detail as { msg?: unknown; loc?: unknown }
      const msg = typeof record.msg === 'string' ? record.msg : null
      const loc = Array.isArray(record.loc)
        ? record.loc.map(part => String(part)).join('.')
        : null
      if (msg && loc) return `${loc}: ${msg}`
      if (msg) return msg
      try {
        return JSON.stringify(detail)
      } catch {
        return String(detail)
      }
    }
    return ''
  }

  let detail = 'Request failed'
  try {
    const payload = await res.json()
    if (payload?.detail) {
      const parsed = detailToMessage(payload.detail).trim()
      if (parsed) detail = parsed
    } else if (payload?.message) {
      const parsed = detailToMessage(payload.message).trim()
      if (parsed) detail = parsed
    }
  } catch {
    // ignore
  }
  throw new Error(detail)
}

export async function listHierarchyNodesBlock(params: {
  parent_id: string | null
  type?: HierarchyNodeType | null
}): Promise<HierarchyNode[]> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyListNodes(getElectronVaultRootBlock(), params)
  }

  const query = new URLSearchParams()
  if (params.parent_id !== null) query.set('parent_id', params.parent_id)
  if (params.type) query.set('type', params.type)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const res = await fetch(`/api/hierarchy/nodes${suffix}`)
  return parseJsonOrThrowBlock<HierarchyNode[]>(res)
}

export async function getHierarchyNodeBlock(nodeId: string): Promise<HierarchyNode> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyGetNode(getElectronVaultRootBlock(), nodeId)
  }
  const res = await fetch(`/api/hierarchy/nodes/${encodeURIComponent(nodeId)}`)
  return parseJsonOrThrowBlock<HierarchyNode>(res)
}

export async function createHierarchyNodeBlock(params: {
  type: HierarchyNodeType
  node_kind?: string | null
  title: string
  parent_id: string | null
  slug?: string | null
  sort_order: number
}): Promise<HierarchyNode> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyCreateNode(getElectronVaultRootBlock(), params)
  }
  const res = await fetch('/api/hierarchy/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return parseJsonOrThrowBlock<HierarchyNode>(res)
}

export async function updateHierarchyNodeBlock(params: {
  node_id: string
  type?: HierarchyNodeType | null
  node_kind?: string | null
  title?: string | null
  slug?: string | null
  sort_order?: number | null
}): Promise<HierarchyNode> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyUpdateNode(getElectronVaultRootBlock(), params)
  }
  const { node_id, ...payload } = params
  const res = await fetch(`/api/hierarchy/nodes/${encodeURIComponent(node_id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJsonOrThrowBlock<HierarchyNode>(res)
}

export async function moveHierarchyNodeBlock(params: {
  node_id: string
  new_parent_id: string | null
  sort_order?: number | null
}): Promise<HierarchyNode> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyMoveNode(getElectronVaultRootBlock(), params)
  }
  const { node_id, ...payload } = params
  const res = await fetch(`/api/hierarchy/nodes/${encodeURIComponent(node_id)}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJsonOrThrowBlock<HierarchyNode>(res)
}

export async function deleteHierarchyNodeBlock(nodeId: string): Promise<{ success: boolean }> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyDeleteNode(getElectronVaultRootBlock(), nodeId)
  }
  const res = await fetch(`/api/hierarchy/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'DELETE',
  })
  return parseJsonOrThrowBlock<{ success: boolean }>(res)
}

export async function upsertHierarchyThoughtBlock(params: {
  file_path: string
  title?: string | null
}): Promise<HierarchyThought> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyUpsertThought(getElectronVaultRootBlock(), params)
  }
  const res = await fetch('/api/hierarchy/thoughts/upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return parseJsonOrThrowBlock<HierarchyThought>(res)
}

export async function listHierarchyThoughtsBlock(params: {
  unlinked_only: boolean
  limit: number
}): Promise<HierarchyThought[]> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyListThoughts(getElectronVaultRootBlock(), params)
  }
  const query = new URLSearchParams()
  query.set('unlinked_only', String(params.unlinked_only))
  query.set('limit', String(params.limit))
  const res = await fetch(`/api/hierarchy/thoughts?${query.toString()}`)
  return parseJsonOrThrowBlock<HierarchyThought[]>(res)
}

export async function listHierarchyThoughtLinksBlock(params: {
  thought_id?: string | null
  node_id?: string | null
}): Promise<HierarchyThoughtLink[]> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyListThoughtLinks(getElectronVaultRootBlock(), params)
  }
  const query = new URLSearchParams()
  if (params.thought_id) query.set('thought_id', params.thought_id)
  if (params.node_id) query.set('node_id', params.node_id)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const res = await fetch(`/api/hierarchy/thought-links${suffix}`)
  return parseJsonOrThrowBlock<HierarchyThoughtLink[]>(res)
}

export async function createHierarchyThoughtLinkBlock(params: {
  thought_id: string
  node_id: string
  link_kind?: string | null
}): Promise<HierarchyThoughtLink> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyCreateThoughtLink(getElectronVaultRootBlock(), params)
  }
  const res = await fetch('/api/hierarchy/thought-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return parseJsonOrThrowBlock<HierarchyThoughtLink>(res)
}

export async function deleteHierarchyThoughtLinkBlock(linkId: string): Promise<{ success: boolean }> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyDeleteThoughtLink(getElectronVaultRootBlock(), linkId)
  }
  const res = await fetch(`/api/hierarchy/thought-links/${encodeURIComponent(linkId)}`, {
    method: 'DELETE',
  })
  return parseJsonOrThrowBlock<{ success: boolean }>(res)
}

export async function listHierarchyEdgesBlock(params: {
  from_node_id?: string | null
  to_node_id?: string | null
}): Promise<HierarchyEdge[]> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyListEdges(getElectronVaultRootBlock(), params)
  }
  const query = new URLSearchParams()
  if (params.from_node_id) query.set('from_node_id', params.from_node_id)
  if (params.to_node_id) query.set('to_node_id', params.to_node_id)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const res = await fetch(`/api/hierarchy/edges${suffix}`)
  return parseJsonOrThrowBlock<HierarchyEdge[]>(res)
}

export async function createHierarchyEdgeBlock(params: {
  from_node_id: string
  to_node_id: string
  edge_kind?: string | null
}): Promise<HierarchyEdge> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyCreateEdge(getElectronVaultRootBlock(), params)
  }
  const res = await fetch('/api/hierarchy/edges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return parseJsonOrThrowBlock<HierarchyEdge>(res)
}

export async function deleteHierarchyEdgeBlock(edgeId: string): Promise<{ success: boolean }> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyDeleteEdge(getElectronVaultRootBlock(), edgeId)
  }
  const res = await fetch(`/api/hierarchy/edges/${encodeURIComponent(edgeId)}`, {
    method: 'DELETE',
  })
  return parseJsonOrThrowBlock<{ success: boolean }>(res)
}

export async function resolveHierarchyPathBlock(requestedPath: string): Promise<HierarchyPathResolution> {
  if (window.electronAPI?.isElectron) {
    return window.electronAPI.hierarchyResolvePath(getElectronVaultRootBlock(), requestedPath)
  }
  const query = new URLSearchParams()
  query.set('path', requestedPath)
  const res = await fetch(`/api/hierarchy/path/resolve?${query.toString()}`)
  return parseJsonOrThrowBlock<HierarchyPathResolution>(res)
}
