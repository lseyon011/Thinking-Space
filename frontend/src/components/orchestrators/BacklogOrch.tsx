import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import BacklogListBlock from '@/components/lego_blocks/BacklogListBlock'
import NodeDetailPanelBlock from '@/components/lego_blocks/NodeDetailPanelBlock'
import CascadingFolderPicker from '@/components/lego_blocks/CascadingFolderPickerBlock'
import { Button } from '@/components/lego_blocks/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/ui/card'
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import type { NodeType } from '@/services/lego_blocks/yamlNoteBlock'
import {
  createYamlNode,
  deleteYamlNode,
  getYamlNode,
  listAllYamlNodes,
  listYamlChildren,
  listYamlRootNodes,
  moveYamlNode,
  renameYamlNode,
  updateYamlNode,
} from '@/services/lego_blocks/yamlHierarchyBlock'
import { hierarchyToExcalidrawMd } from '@/services/lego_blocks/hierarchyExcalidrawBlock'
import { getVaultFS } from '@/services/lego_blocks/fsBlock'
import { useMarkdownViewer } from '@/components/orchestrators/MarkdownViewerOrch'
import { defaultNodeKindLabel } from '@/components/lego_blocks/HierarchyTreeBlock'
import { THINKING_ORGANIZER_DIR } from '@/services/lego_blocks/projectStorageBlock'
import {
  STORAGE_KEYS,
  getJsonStorageItem,
  setJsonStorageItem,
} from '@/services/lego_blocks/storageKeyBlock'

function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) return value.message
  if (typeof value === 'string' && value.trim()) return value
  return fallback
}

function allowedChildTypes(parentType: NodeType | null): NodeType[] {
  if (!parentType) return ['program']
  switch (parentType) {
    case 'program': return ['epic']
    case 'epic': return ['idea_bucket', 'idea', 'thought_bucket', 'thought']
    case 'idea_bucket': return ['idea']
    case 'idea': return ['thought_bucket', 'thought']
    case 'thought_bucket': return ['thought']
    case 'thought': return ['thought']
    default: return ['idea']
  }
}

export default function BacklogOrch() {
  const { openFile } = useMarkdownViewer()
  const [programs, setPrograms] = useState<NodeRecord[]>([])
  const [selectedNode, setSelectedNode] = useState<NodeRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [projectRootSegments, setProjectRootSegments] = useState<string[]>(
    () => getJsonStorageItem<string[]>(
      STORAGE_KEYS.thinkingOrganizerSelectedProjectRoot,
      [],
    ),
  )

  const projectRoot = projectRootSegments.join('/')

  const loadPrograms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const roots = await listYamlRootNodes('program')
      setPrograms(roots.sort((a, b) => a.title.localeCompare(b.title)))
    } catch (err) {
      setError(errorMessage(err, 'Failed to load programs'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPrograms()
  }, [loadPrograms])

  const handleProjectRootChange = useCallback((segments: string[]) => {
    setProjectRootSegments(segments)
    setJsonStorageItem(STORAGE_KEYS.thinkingOrganizerSelectedProjectRoot, segments)
  }, [])

  // ── CRUD callbacks ──

  const createChildNode = useCallback(async (
    parent: NodeRecord | null,
    title: string,
    requestedType?: NodeType,
  ) => {
    const allowedTypes = allowedChildTypes(parent?.type ?? null)
    const nextType = requestedType && allowedTypes.includes(requestedType)
      ? requestedType
      : allowedTypes[0]
    if (!parent && !projectRoot) {
      throw new Error('Select a project folder before creating a program.')
    }

    const created = await createYamlNode({
      type: nextType,
      title,
      parentKey: parent?.key,
      parentUuid: parent?.uuid,
      parentType: parent?.type,
      projectRoot: parent ? undefined : projectRoot,
    })
    if (!parent) {
      setPrograms(prev => [...prev, created].sort((a, b) => a.title.localeCompare(b.title)))
    }
    setMessage(`Created ${defaultNodeKindLabel(created.type)}: ${created.title}`)
    return created
  }, [projectRoot])

  const deleteNodeRecursive = useCallback(async (node: NodeRecord, removedIds: Set<string>): Promise<void> => {
    const children = await listYamlChildren(node.key)
    for (const child of children) {
      await deleteNodeRecursive(child, removedIds)
    }
    await deleteYamlNode(node.uuid)
    removedIds.add(node.uuid)
  }, [])

  const deleteAnyNode = useCallback(async (node: NodeRecord) => {
    setWorking(true)
    setError(null)
    setMessage(null)
    try {
      const removed = new Set<string>()
      await deleteNodeRecursive(node, removed)
      await loadPrograms()
      if (selectedNode && removed.has(selectedNode.uuid)) setSelectedNode(null)
      setMessage(`Deleted: ${node.title}`)
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete node'))
    } finally {
      setWorking(false)
    }
  }, [deleteNodeRecursive, loadPrograms, selectedNode])

  const renameNode = useCallback(async (newTitle: string) => {
    if (!selectedNode) return
    setWorking(true)
    setError(null)
    try {
      const updated = await renameYamlNode(selectedNode.uuid, newTitle)
      if (updated.type === 'program') {
        setPrograms(prev => prev.map(p => p.uuid === updated.uuid ? updated : p).sort((a, b) => a.title.localeCompare(b.title)))
      }
      setSelectedNode(updated)
      setMessage(`Renamed to: ${updated.title}`)
    } catch (err) {
      setError(errorMessage(err, 'Failed to rename'))
    } finally {
      setWorking(false)
    }
  }, [selectedNode])

  const updateStatus = useCallback(async (status: string) => {
    if (!selectedNode) return
    setWorking(true)
    try {
      const updated = await updateYamlNode(selectedNode.uuid, { status: status as 'active' | 'paused' | 'completed' | 'archived' })
      setSelectedNode(updated)
    } catch (err) {
      setError(errorMessage(err, 'Failed to update status'))
    } finally {
      setWorking(false)
    }
  }, [selectedNode])

  const updatePriority = useCallback(async (priority: string) => {
    if (!selectedNode) return
    setWorking(true)
    try {
      const updated = await updateYamlNode(selectedNode.uuid, { priority: priority as 'low' | 'medium' | 'high' | 'critical' })
      setSelectedNode(updated)
    } catch (err) {
      setError(errorMessage(err, 'Failed to update priority'))
    } finally {
      setWorking(false)
    }
  }, [selectedNode])

  const dropNodeToNode = useCallback(async (sourceUuid: string, targetNode: NodeRecord) => {
    setWorking(true)
    setError(null)
    setMessage(null)
    try {
      const sourceNode = await getYamlNode(sourceUuid)
      if (!sourceNode) throw new Error('Source node not found')
      if (sourceNode.uuid === targetNode.uuid) throw new Error('Cannot move a node onto itself.')
      await moveYamlNode(sourceNode.uuid, targetNode.key)
      await loadPrograms()
      setMessage(`Moved ${sourceNode.title} under ${targetNode.title}`)
    } catch (err) {
      setError(errorMessage(err, 'Failed to move node'))
    } finally {
      setWorking(false)
    }
  }, [loadPrograms])

  const exportToExcalidraw = useCallback(async () => {
    setWorking(true)
    setError(null)
    setMessage(null)
    try {
      const allNodes = await listAllYamlNodes()
      if (allNodes.length === 0) { setError('No nodes to export.'); return }
      const mdContent = hierarchyToExcalidrawMd(allNodes)
      const fs = getVaultFS()
      const filePath = 'hierarchy-mindmap.excalidraw.md'
      await fs.write(filePath, mdContent)
      setMessage(`Exported hierarchy to ${filePath}`)
      openFile(filePath)
    } catch (err) {
      setError(errorMessage(err, 'Failed to export'))
    } finally {
      setWorking(false)
    }
  }, [openFile])

  return (
    <div>
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Project Folder</CardTitle>
          <CardDescription>
            New program trees are stored under each project&apos;s <code>{THINKING_ORGANIZER_DIR}</code> folder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <CascadingFolderPicker
            defaultPath={projectRootSegments}
            onChange={segments => handleProjectRootChange(segments)}
            storageKey={STORAGE_KEYS.thinkingOrganizerProjectRoots}
            maxRecents={12}
          />
          <div className="text-xs text-muted-foreground">
            Storage target:{' '}
            <span className="font-mono text-foreground">
              {projectRoot ? `${projectRoot}/${THINKING_ORGANIZER_DIR}` : '(select a project folder)'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      {(message || error) && (
        <div className="mb-4 space-y-2">
          {message && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => { void exportToExcalidraw() }} disabled={working}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export Excalidraw
        </Button>
        {working && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Backlog list */}
      {loading ? (
        <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading hierarchy...
        </div>
      ) : (
        <BacklogListBlock
          programs={programs}
          loadEpics={program => listYamlChildren(program.key)}
          loadChildren={node => listYamlChildren(node.key)}
          selectedNodeId={selectedNode?.uuid ?? null}
          onSelectNode={setSelectedNode}
          onCreateChild={createChildNode}
          onDropNodeToNode={dropNodeToNode}
        />
      )}

      {/* Detail panel */}
      {selectedNode && (
        <NodeDetailPanelBlock
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onRename={renameNode}
          onUpdateStatus={updateStatus}
          onUpdatePriority={updatePriority}
          onOpenFile={() => openFile(selectedNode.filePath)}
          onDelete={() => deleteAnyNode(selectedNode)}
        />
      )}
    </div>
  )
}
