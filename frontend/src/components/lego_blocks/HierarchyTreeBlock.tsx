import { useCallback, useMemo, useState } from 'react'
import { BookOpen, ChevronRight, File, FileText, Folder, FolderOpen, FolderTree, Handshake, Layers, Lightbulb, ListChecks, Loader2, MessageSquare, Pencil, Play, Plus, Trash2, Unlink } from 'lucide-react'
import { Button } from '@/components/lego_blocks/ui/button'
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import type { NodeType } from '@/services/lego_blocks/yamlNoteBlock'
import { cn } from '@/lib/utils'

export interface HierarchyMappedItem {
  linkId: string
  path: string
  title: string | null
}

interface ChildState {
  loading: boolean
  loaded: boolean
  nodes: NodeRecord[]
  error: string | null
}

interface HierarchyTreeBlockProps {
  rootNodes: NodeRecord[]
  selectedNodeId?: string | null
  className?: string
  loadChildren: (parent: NodeRecord) => Promise<NodeRecord[]>
  onSelectNode: (node: NodeRecord) => void
  onNodeExpanded?: (node: NodeRecord) => void
  onCreateChild: (parent: NodeRecord | null, title: string) => Promise<NodeRecord>
  onRenameNode?: (node: NodeRecord, nextTitle: string) => Promise<NodeRecord>
  onDeleteNode: (node: NodeRecord) => Promise<void>
  onDropPathToNode?: (node: NodeRecord, path: string) => Promise<void>
  onDropNodeToNode?: (sourceNodeId: string, targetNode: NodeRecord) => Promise<void>
  canDropOnNode?: (node: NodeRecord) => boolean
  mappedByNode?: Record<string, HierarchyMappedItem[]>
  mappedFolderRootsByNode?: Record<string, string[]>
  getNodeKindLabel?: (node: NodeRecord) => string
  onChangeNodeKind?: (node: NodeRecord, nextLabel: string | null) => Promise<void>
  onUnmapItem?: (node: NodeRecord, item: HierarchyMappedItem) => Promise<void>
  onOpenPath?: (path: string) => void
  allowRootInlineCreate?: boolean
}

interface MappedFolderNode {
  path: string
  children: MappedFolderNode[]
}

const ROOT_INPUT_KEY = '__root__'

function iconForNodeType(type: NodeType) {
  if (type === 'program') return FolderTree
  if (type === 'epic') return Layers
  if (type === 'idea_bucket') return BookOpen
  if (type === 'idea') return Lightbulb
  if (type === 'thought_bucket') return Folder
  if (type === 'thought') return MessageSquare
  if (type === 'task') return ListChecks
  if (type === 'run') return Play
  if (type === 'handoff') return Handshake
  return Lightbulb
}

export function defaultNodeKindLabel(type: NodeType): string {
  if (type === 'program') return 'Program'
  if (type === 'epic') return 'Epic'
  if (type === 'idea_bucket') return 'Idea Bucket'
  if (type === 'idea') return 'Idea'
  if (type === 'thought_bucket') return 'Thought Bucket'
  if (type === 'thought') return 'Thought'
  if (type === 'task') return 'Task'
  if (type === 'run') return 'Run'
  if (type === 'handoff') return 'Handoff'
  return 'Node'
}

function sortNodes(nodes: NodeRecord[]): NodeRecord[] {
  return [...nodes].sort((a, b) => a.title.localeCompare(b.title))
}

function normalizeDroppedPath(event: React.DragEvent): string | null {
  const candidates = [
    event.dataTransfer.getData('application/x-ltm-path'),
    event.dataTransfer.getData('text/ltm-file-path'),
    event.dataTransfer.getData('text/plain'),
    event.dataTransfer.getData('text/uri-list'),
  ]

  for (const candidate of candidates) {
    const firstLine = candidate.split(/\r?\n/).map(part => part.trim()).find(Boolean)
    if (!firstLine) continue

    let value = firstLine.replace(/^ltm-path:/i, '').replace(/\\/g, '/')
    if (value.startsWith('file://')) {
      continue
    }
    value = value.replace(/^\.\/+/, '').replace(/^\/+|\/+$/g, '')
    if (!value) continue
    if (value.startsWith('/') || value.includes('://')) continue
    if (value.includes('..')) continue
    return value
  }

  return null
}

function hasDataTransferType(event: React.DragEvent, mime: string): boolean {
  const types = event.dataTransfer.types as unknown
  if (Array.isArray(types)) return types.includes(mime)
  if (types && typeof (types as { contains?: (value: string) => boolean }).contains === 'function') {
    return Boolean((types as { contains: (value: string) => boolean }).contains(mime))
  }
  try {
    return Array.from(event.dataTransfer.types).includes(mime)
  } catch {
    return false
  }
}

function readDroppedNodeId(event: React.DragEvent): string | null {
  const explicit = event.dataTransfer.getData('application/x-ltm-node-id').trim()
  if (explicit) return explicit
  const explicitText = event.dataTransfer.getData('text/ltm-node-id').trim()
  if (explicitText) return explicitText
  const fallback = event.dataTransfer.getData('text/plain').trim()
  if (fallback.startsWith('ltm-node:')) {
    const nodeId = fallback.slice('ltm-node:'.length).trim()
    return nodeId || null
  }
  return null
}

function fileName(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

function parentPath(path: string): string | null {
  const idx = path.lastIndexOf('/')
  if (idx < 0) return null
  return path.slice(0, idx)
}

function hasFileExtension(path: string): boolean {
  return /\.[^/.]+$/.test(fileName(path))
}

function splitMappedItems(items: HierarchyMappedItem[]): {
  folders: HierarchyMappedItem[]
  files: HierarchyMappedItem[]
} {
  if (items.length === 0) return { folders: [], files: [] }

  const allPaths = items.map(item => item.path)
  const folders: HierarchyMappedItem[] = []
  const files: HierarchyMappedItem[] = []

  for (const item of items) {
    const hasDescendants = allPaths.some(path => path !== item.path && path.startsWith(`${item.path}/`))
    if (hasDescendants || !hasFileExtension(item.path)) folders.push(item)
    else files.push(item)
  }

  return { folders, files }
}

function buildFolderForest(folderItems: HierarchyMappedItem[]): MappedFolderNode[] {
  if (folderItems.length === 0) return []

  const byPath = new Map<string, MappedFolderNode>()
  const roots: MappedFolderNode[] = []

  for (const item of folderItems) {
    byPath.set(item.path, { path: item.path, children: [] })
  }

  for (const node of byPath.values()) {
    let parent = parentPath(node.path)
    while (parent && !byPath.has(parent)) {
      parent = parentPath(parent)
    }
    if (!parent) {
      roots.push(node)
      continue
    }
    byPath.get(parent)!.children.push(node)
  }

  const sortTree = (nodes: MappedFolderNode[]) => {
    nodes.sort((a, b) => a.path.localeCompare(b.path))
    for (const node of nodes) sortTree(node.children)
  }
  sortTree(roots)
  return roots
}

function buildFilesByParent(files: HierarchyMappedItem[]): Record<string, HierarchyMappedItem[]> {
  const byParent: Record<string, HierarchyMappedItem[]> = {}
  for (const item of files) {
    const parent = parentPath(item.path) ?? ''
    byParent[parent] = [...(byParent[parent] ?? []), item]
  }
  for (const parent of Object.keys(byParent)) {
    byParent[parent].sort((a, b) => a.path.localeCompare(b.path))
  }
  return byParent
}

function buildSyntheticFolderItemsFromFiles(
  files: HierarchyMappedItem[],
  scopedRoots: string[] = [],
): HierarchyMappedItem[] {
  const folderSet = new Set<string>()
  const normalizedRoots = [...new Set(
    scopedRoots
      .map(root => root.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
      .filter(Boolean),
  )]

  const findScopedRoot = (path: string): string | null => {
    let match: string | null = null
    for (const root of normalizedRoots) {
      if (path === root || path.startsWith(`${root}/`)) {
        if (!match || root.length > match.length) match = root
      }
    }
    return match
  }

  for (const file of files) {
    let cursor = parentPath(file.path)
    const scopedRoot = findScopedRoot(file.path)
    while (cursor) {
      folderSet.add(cursor)
      if (scopedRoot && cursor === scopedRoot) break
      cursor = parentPath(cursor)
    }
  }
  return [...folderSet]
    .sort((a, b) => a.localeCompare(b))
    .map(path => ({
      linkId: `synthetic:${path}`,
      path,
      title: null,
    }))
}

export default function HierarchyTreeBlock({
  rootNodes,
  selectedNodeId = null,
  className,
  loadChildren,
  onSelectNode,
  onNodeExpanded,
  onCreateChild,
  onRenameNode,
  onDeleteNode,
  onDropPathToNode,
  onDropNodeToNode,
  canDropOnNode,
  mappedByNode = {},
  mappedFolderRootsByNode = {},
  getNodeKindLabel,
  onChangeNodeKind,
  onUnmapItem,
  onOpenPath,
  allowRootInlineCreate = true,
}: HierarchyTreeBlockProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [childrenByParent, setChildrenByParent] = useState<Record<string, ChildState>>({})
  const [draftByParent, setDraftByParent] = useState<Record<string, string>>({ [ROOT_INPUT_KEY]: '' })
  const [busyCreateByParent, setBusyCreateByParent] = useState<Record<string, boolean>>({})
  const [busyRenameByNode, setBusyRenameByNode] = useState<Record<string, boolean>>({})
  const [busyDeleteByNode, setBusyDeleteByNode] = useState<Record<string, boolean>>({})
  const [busyDropByNode, setBusyDropByNode] = useState<Record<string, boolean>>({})
  const [busyKindByNode, setBusyKindByNode] = useState<Record<string, boolean>>({})
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [expandedMapped, setExpandedMapped] = useState<Record<string, boolean>>({})
  const [busyRemoveByMappedPath, setBusyRemoveByMappedPath] = useState<Record<string, boolean>>({})
  const [localError, setLocalError] = useState<string | null>(null)

  const sortedRoots = useMemo(() => sortNodes(rootNodes), [rootNodes])

  const ensureChildrenLoaded = useCallback(async (parent: NodeRecord) => {
    const existing = childrenByParent[parent.uuid]
    if (existing?.loading || existing?.loaded) return

    setChildrenByParent(prev => ({
      ...prev,
      [parent.uuid]: { loading: true, loaded: false, nodes: [], error: null },
    }))

    try {
      const rows = await loadChildren(parent)
      const sorted = sortNodes(rows)
      setChildrenByParent(prev => ({
        ...prev,
        [parent.uuid]: { loading: false, loaded: true, nodes: sorted, error: null },
      }))
      onNodeExpanded?.(parent)
    } catch (err) {
      setChildrenByParent(prev => ({
        ...prev,
        [parent.uuid]: {
          loading: false,
          loaded: false,
          nodes: [],
          error: err instanceof Error ? err.message : 'Failed to load children',
        },
      }))
    }
  }, [childrenByParent, loadChildren, onNodeExpanded])

  const toggleExpanded = useCallback((node: NodeRecord) => {
    setExpanded(prev => {
      const willExpand = !prev[node.uuid]
      if (willExpand) {
        void ensureChildrenLoaded(node)
      }
      return { ...prev, [node.uuid]: willExpand }
    })
  }, [ensureChildrenLoaded])

  const setDraft = useCallback((parentKey: string, value: string) => {
    setDraftByParent(prev => ({ ...prev, [parentKey]: value }))
  }, [])

  const createUnderParent = useCallback(async (parent: NodeRecord | null) => {
    const key = parent?.uuid ?? ROOT_INPUT_KEY
    const title = (draftByParent[key] ?? '').trim()
    if (!title) return

    setLocalError(null)
    setBusyCreateByParent(prev => ({ ...prev, [key]: true }))
    try {
      const created = await onCreateChild(parent, title)
      setDraftByParent(prev => ({ ...prev, [key]: '' }))

      if (parent) {
        setExpanded(prev => ({ ...prev, [parent.uuid]: true }))
        setChildrenByParent(prev => {
          const existing = prev[parent.uuid]
          if (!existing?.loaded) {
            return {
              ...prev,
              [parent.uuid]: {
                loading: false,
                loaded: true,
                nodes: sortNodes([created]),
                error: null,
              },
            }
          }
          return {
            ...prev,
            [parent.uuid]: {
              ...existing,
              nodes: sortNodes([...existing.nodes, created]),
            },
          }
        })
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create node')
    } finally {
      setBusyCreateByParent(prev => ({ ...prev, [key]: false }))
    }
  }, [draftByParent, onCreateChild])

  const deleteNode = useCallback(async (node: NodeRecord) => {
    setLocalError(null)
    setBusyDeleteByNode(prev => ({ ...prev, [node.uuid]: true }))
    try {
      await onDeleteNode(node)
      setExpanded(prev => {
        const next = { ...prev }
        delete next[node.uuid]
        return next
      })
      setChildrenByParent(prev => {
        const next = { ...prev }
        delete next[node.uuid]
        for (const [parentId, state] of Object.entries(next)) {
          next[parentId] = {
            ...state,
            nodes: state.nodes.filter(child => child.uuid !== node.uuid),
          }
        }
        return next
      })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to delete node')
    } finally {
      setBusyDeleteByNode(prev => ({ ...prev, [node.uuid]: false }))
    }
  }, [onDeleteNode])

  const renameNode = useCallback(async (node: NodeRecord) => {
    if (!onRenameNode) return

    const nextInput = window.prompt('Rename node', node.title)
    if (nextInput === null) return
    const nextTitle = nextInput.trim()
    if (!nextTitle || nextTitle === node.title) return

    setLocalError(null)
    setBusyRenameByNode(prev => ({ ...prev, [node.uuid]: true }))
    try {
      const updated = await onRenameNode(node, nextTitle)
      setChildrenByParent(prev => {
        const next = { ...prev }
        for (const [parentId, state] of Object.entries(next)) {
          next[parentId] = {
            ...state,
            nodes: state.nodes.map(child => (child.uuid === updated.uuid ? updated : child)),
          }
        }
        return next
      })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to rename node')
    } finally {
      setBusyRenameByNode(prev => ({ ...prev, [node.uuid]: false }))
    }
  }, [onRenameNode])

  const dropOnNode = useCallback(async (node: NodeRecord, path: string) => {
    if (!onDropPathToNode) return
    setLocalError(null)
    setBusyDropByNode(prev => ({ ...prev, [node.uuid]: true }))
    try {
      await onDropPathToNode(node, path)
      onNodeExpanded?.(node)
      setExpanded(prev => ({ ...prev, [node.uuid]: true }))
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to map dropped path')
    } finally {
      setBusyDropByNode(prev => ({ ...prev, [node.uuid]: false }))
    }
  }, [onDropPathToNode, onNodeExpanded])

  const changeNodeKind = useCallback(async (node: NodeRecord) => {
    if (!onChangeNodeKind) return

    const currentLabel = getNodeKindLabel?.(node) ?? defaultNodeKindLabel(node.type)
    const nextInput = window.prompt(
      'Set node type (Program, Epic, Idea Bucket, Idea, Thought Bucket, Thought):',
      currentLabel,
    )
    if (nextInput === null) return

    const nextLabel = nextInput.trim()
    setLocalError(null)
    setBusyKindByNode(prev => ({ ...prev, [node.uuid]: true }))
    try {
      await onChangeNodeKind(node, nextLabel || null)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to change node kind')
    } finally {
      setBusyKindByNode(prev => ({ ...prev, [node.uuid]: false }))
    }
  }, [getNodeKindLabel, onChangeNodeKind])

  const toggleMappedExpanded = useCallback((nodeId: string, path: string) => {
    const key = `${nodeId}::folder::${path}`
    setExpandedMapped(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }, [])

  const removeMappedFolderSubtree = useCallback(async (hostNode: NodeRecord, folderPath: string) => {
    if (!onUnmapItem) return
    const busyKey = `${hostNode.uuid}::${folderPath}`
    setBusyRemoveByMappedPath(prev => ({ ...prev, [busyKey]: true }))
    setLocalError(null)
    try {
      const mappedItems = mappedByNode[hostNode.uuid] ?? []
      const matches = mappedItems.filter(
        item => item.path === folderPath || item.path.startsWith(`${folderPath}/`),
      )
      for (const item of matches) {
        await onUnmapItem(hostNode, item)
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to remove folder from this tree')
    } finally {
      setBusyRemoveByMappedPath(prev => ({ ...prev, [busyKey]: false }))
    }
  }, [mappedByNode, onUnmapItem])

  const renderMappedFolderNode = useCallback((
    hostNode: NodeRecord,
    folderNode: MappedFolderNode,
    filesByParent: Record<string, HierarchyMappedItem[]>,
    depth: number,
  ): JSX.Element => {
    const hasChildren = folderNode.children.length > 0
    const hasFiles = (filesByParent[folderNode.path]?.length ?? 0) > 0
    const hasExpandableContent = hasChildren || hasFiles
    const stateKey = `${hostNode.uuid}::folder::${folderNode.path}`
    const isExpanded = expandedMapped[stateKey] ?? depth === 0
    const busyKey = `${hostNode.uuid}::${folderNode.path}`
    const isRemoving = !!busyRemoveByMappedPath[busyKey]
    const folderLabel = fileName(folderNode.path)

    return (
      <div key={`${hostNode.uuid}::folder::${folderNode.path}`}>
        <div
          className={cn(
            'group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground/90 transition-colors hover:bg-muted/70',
            isExpanded && 'bg-muted/50',
          )}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          {hasExpandableContent ? (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              onClick={() => toggleMappedExpanded(hostNode.uuid, folderNode.path)}
            >
              <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-90')} />
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {isExpanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          )}

          <button
            type="button"
            onClick={() => toggleMappedExpanded(hostNode.uuid, folderNode.path)}
            className="min-w-0 flex-1 truncate text-left"
            title={folderNode.path}
          >
            {folderLabel}
          </button>

          {onUnmapItem && (
            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-destructive"
              onClick={() => {
                void removeMappedFolderSubtree(hostNode, folderNode.path)
              }}
              title="Remove folder and descendants from this tree"
              disabled={isRemoving}
            >
              {isRemoving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Remove from this tree'
              )}
            </button>
          )}
        </div>

        {isExpanded && (
          <div className="mt-1 space-y-1">
            {(filesByParent[folderNode.path] ?? []).map(item => {
              const name = item.title || fileName(item.path)
              const Icon = item.path.toLowerCase().endsWith('.md') ? FileText : File
              return (
                <div
                  key={`${hostNode.uuid}::file-inline::${item.linkId}`}
                  className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/10 px-2 py-1.5 text-xs"
                  style={{ marginLeft: `${26 + depth * 14}px` }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => onOpenPath?.(item.path)}
                    className="min-w-0 flex-1 truncate text-left text-muted-foreground hover:text-foreground hover:underline"
                    title={item.path}
                  >
                    {name}
                  </button>
                  {onUnmapItem && (
                    <button
                      type="button"
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      onClick={() => {
                        void onUnmapItem(hostNode, item)
                      }}
                      title="Remove tag from this file"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
            {folderNode.children.map(child => renderMappedFolderNode(hostNode, child, filesByParent, depth + 1))}
          </div>
        )}
      </div>
    )
  }, [busyRemoveByMappedPath, expandedMapped, onOpenPath, onUnmapItem, removeMappedFolderSubtree, toggleMappedExpanded])

  const renderLinkedTree = useCallback((node: NodeRecord): JSX.Element[] => {
    const items = mappedByNode[node.uuid] ?? []
    if (items.length === 0) return []

    const { folders, files } = splitMappedItems(items)
    const filesByParent = buildFilesByParent(files)
    const foldersForTree = folders.length > 0
      ? folders
      : buildSyntheticFolderItemsFromFiles(files, mappedFolderRootsByNode[node.uuid] ?? [])

    if (foldersForTree.length === 0) {
      return (filesByParent[''] ?? []).map(item => {
        const name = item.title || fileName(item.path)
        const Icon = item.path.toLowerCase().endsWith('.md') ? FileText : File
        return (
          <div
            key={`${node.uuid}::file-root::${item.linkId}`}
            className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/10 px-2 py-1.5 text-xs"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <button
              type="button"
              onClick={() => onOpenPath?.(item.path)}
              className="min-w-0 flex-1 truncate text-left text-muted-foreground hover:text-foreground hover:underline"
              title={item.path}
            >
              {name}
            </button>
            {onUnmapItem && (
              <button
                type="button"
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                onClick={() => {
                  void onUnmapItem(node, item)
                }}
                title="Remove tag from this file"
              >
                <Unlink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      })
    }

    const forest = buildFolderForest(foldersForTree)
    return forest.map(folderNode => renderMappedFolderNode(node, folderNode, filesByParent, 0))
  }, [mappedByNode, mappedFolderRootsByNode, onOpenPath, onUnmapItem, renderMappedFolderNode])

  const renderNodeRows = useCallback((nodes: NodeRecord[], depth: number): JSX.Element[] => {
    const rows: JSX.Element[] = []

    for (const node of nodes) {
      const Icon = iconForNodeType(node.type)
      const isExpanded = !!expanded[node.uuid]
      const childState = childrenByParent[node.uuid]
      const canDrop = canDropOnNode ? canDropOnNode(node) : true
      const parentKey = node.uuid
      const nodeKindLabel = getNodeKindLabel?.(node) ?? defaultNodeKindLabel(node.type)

      rows.push(
        <div
          key={`row-${node.uuid}`}
          draggable
          className={cn(
            'rounded-lg border bg-card/40 p-2 shadow-sm transition-colors',
            selectedNodeId === node.uuid ? 'border-primary/60' : 'border-border/70',
            dragOverNodeId === node.uuid && 'border-primary ring-2 ring-primary/40 bg-primary/5',
          )}
          onDragStart={event => {
            setDraggingNodeId(node.uuid)
            event.dataTransfer.setData('application/x-ltm-node-id', node.uuid)
            event.dataTransfer.setData('text/ltm-node-id', node.uuid)
            event.dataTransfer.setData('text/plain', `ltm-node:${node.uuid}`)
            event.dataTransfer.effectAllowed = 'move'
          }}
          onDragEnd={() => {
            setDraggingNodeId(null)
          }}
          style={{ marginLeft: `${8 + depth * 14}px` }}
          onDragOver={event => {
            event.preventDefault()
            event.stopPropagation()
            const isNodeDrag = !!draggingNodeId
              || hasDataTransferType(event, 'application/x-ltm-node-id')
              || hasDataTransferType(event, 'text/ltm-node-id')
              || event.dataTransfer.getData('text/plain').startsWith('ltm-node:')
            if (isNodeDrag) {
              event.dataTransfer.dropEffect = 'move'
              setDragOverNodeId(node.uuid)
              return
            }

            event.dataTransfer.dropEffect = canDrop ? 'copy' : 'none'
            if (canDrop) setDragOverNodeId(node.uuid)
          }}
          onDragLeave={() => {
            if (dragOverNodeId === node.uuid) setDragOverNodeId(null)
          }}
          onDrop={event => {
            event.preventDefault()
            event.stopPropagation()
            setDragOverNodeId(null)
            const droppedNodeId = readDroppedNodeId(event) ?? draggingNodeId
            if (droppedNodeId) {
              if (!onDropNodeToNode) return
              if (droppedNodeId === node.uuid) {
                setLocalError('Cannot drop a node onto itself.')
                return
              }
              void (async () => {
                setBusyDropByNode(prev => ({ ...prev, [node.uuid]: true }))
                setLocalError(null)
                try {
                  await onDropNodeToNode(droppedNodeId, node)
                  onNodeExpanded?.(node)
                  setExpanded(prev => ({ ...prev, [node.uuid]: true }))
                } catch (err) {
                  setLocalError(err instanceof Error ? err.message : 'Failed to move node')
                } finally {
                  setBusyDropByNode(prev => ({ ...prev, [node.uuid]: false }))
                  setDraggingNodeId(null)
                }
              })()
              return
            }
            if (!canDrop) {
              setLocalError('Drop files/folders on any non-program node.')
              return
            }
            const path = normalizeDroppedPath(event)
            if (!path) {
              setLocalError('Could not read dropped path. Drag directly from Thinking Space Explorer.')
              return
            }
            void dropOnNode(node, path)
          }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleExpanded(node)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            >
              <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
            </button>

            <button
              type="button"
              onClick={() => {
                void changeNodeKind(node)
              }}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              title={`Change node kind (${nodeKindLabel})`}
              disabled={!onChangeNodeKind || busyKindByNode[node.uuid]}
            >
              {busyKindByNode[node.uuid] ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4 shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectNode(node)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted/60"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{node.title}</div>
                <div className="truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {nodeKindLabel}
                </div>
              </div>
            </button>

            {busyDropByNode[node.uuid] && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              title="Rename node"
              disabled={!onRenameNode || busyRenameByNode[node.uuid]}
              onClick={() => {
                void renameNode(node)
              }}
            >
              {busyRenameByNode[node.uuid] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              title="Delete node"
              disabled={busyDeleteByNode[node.uuid]}
              onClick={() => {
                void deleteNode(node)
              }}
            >
              {busyDeleteByNode[node.uuid] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <div className="mt-2 flex items-center gap-2 border-t border-border/50 pt-2">
            <input
              value={draftByParent[parentKey] ?? ''}
              onChange={event => setDraft(parentKey, event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void createUnderParent(node)
                }
              }}
              placeholder="Type and press Enter to add child"
              className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={busyCreateByParent[parentKey]}
              onClick={() => {
                void createUnderParent(node)
              }}
            >
              {busyCreateByParent[parentKey] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {(mappedByNode[node.uuid]?.length ?? 0) > 0 && (
            <div className="mt-2 space-y-2 rounded-md border border-border/50 bg-background/50 p-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Linked Folder Tree
                </div>
                <div className="space-y-0.5">
                  {renderLinkedTree(node)}
                </div>
              </div>
            </div>
          )}

          {isExpanded && (
            <div className="mt-2 space-y-2">
              {childState?.loading && (
                <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </div>
              )}
              {childState?.error && (
                <div className="px-2 py-1 text-xs text-destructive">
                  {childState.error}
                </div>
              )}
              {childState?.loaded && childState.nodes.length > 0 && renderNodeRows(childState.nodes, depth + 1)}
              {childState?.loaded && childState.nodes.length === 0 && (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  No children yet.
                </div>
              )}
            </div>
          )}
        </div>,
      )
    }

    return rows
  }, [
    busyCreateByParent,
    busyDeleteByNode,
    busyDropByNode,
    canDropOnNode,
    childrenByParent,
    createUnderParent,
    changeNodeKind,
    renameNode,
    deleteNode,
    dragOverNodeId,
    draftByParent,
    dropOnNode,
    expanded,
    mappedByNode,
    getNodeKindLabel,
    onSelectNode,
    onChangeNodeKind,
    onRenameNode,
    renderLinkedTree,
    selectedNodeId,
    setDraft,
    toggleExpanded,
    busyRenameByNode,
    busyKindByNode,
  ])

  return (
    <div className={cn('flex flex-col', className)}>
      {allowRootInlineCreate && (
        <div className="border-b border-border/60 px-3 py-2">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Thinking Tree
          </div>

          <div className="flex items-center gap-2">
            <input
              value={draftByParent[ROOT_INPUT_KEY] ?? ''}
              onChange={event => setDraft(ROOT_INPUT_KEY, event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void createUnderParent(null)
                }
              }}
              placeholder="Type and press Enter to add program"
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs"
              disabled={busyCreateByParent[ROOT_INPUT_KEY]}
              onClick={() => {
                void createUnderParent(null)
              }}
            >
              {busyCreateByParent[ROOT_INPUT_KEY] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2 px-1.5 py-2">
        {renderNodeRows(sortedRoots, 0)}

        {sortedRoots.length === 0 && (
          <div className="px-2 py-4 text-sm text-muted-foreground">
            No programs yet.
          </div>
        )}
      </div>

      {localError && (
        <div className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {localError}
        </div>
      )}
    </div>
  )
}
