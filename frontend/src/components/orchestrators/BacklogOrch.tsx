import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Loader2, Plus, X } from 'lucide-react'
import BacklogListBlock from '@/components/lego_blocks/BacklogListBlock'
import NodeDetailPanelBlock from '@/components/lego_blocks/NodeDetailPanelBlock'
import CascadingFolderPicker, { addRecent } from '@/components/lego_blocks/CascadingFolderPickerBlock'
import { Button } from '@/components/lego_blocks/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/ui/card'
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import { generateKey, type NodeType, type YAMLCommentEntry, type YAMLFrontmatter } from '@/services/lego_blocks/yamlNoteBlock'
import { hierarchyToExcalidrawMd } from '@/services/lego_blocks/hierarchyExcalidrawBlock'
import { getVaultFS } from '@/services/lego_blocks/fsBlock'
import { useMarkdownViewer } from '@/components/orchestrators/MarkdownViewerOrch'
import { defaultNodeKindLabel } from '@/components/lego_blocks/HierarchyTreeBlock'
import { THINKING_ORGANIZER_DIR } from '@/services/lego_blocks/projectStorageBlock'
import {
  invokeCapabilityOrThrow,
} from '@/services/orchestrators/capabilityRouterOrch'
import { getLastSyncTimestamp, smartSync } from '@/services/orchestrators/vaultSyncOrch'
import type { CapabilityActor } from '@/services/lego_blocks/capabilityRegistryBlock'
import {
  STORAGE_KEYS,
  getJsonStorageItem,
  setJsonStorageItem,
} from '@/services/lego_blocks/storageKeyBlock'

interface ProjectEntry {
  name: string
  root: string
}

const BACKLOG_ACTOR: CapabilityActor = {
  kind: 'human',
  id: 'ui.backlog',
}

function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) return value.message
  if (typeof value === 'string' && value.trim()) return value
  return fallback
}

function formatSyncTime(timestampSeconds: number): string {
  if (!timestampSeconds) return 'never'
  const date = new Date(timestampSeconds * 1000)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return date.toLocaleString()
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function humanizeKey(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || 'Project'
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
  const [selectedFrontmatter, setSelectedFrontmatter] = useState<YAMLFrontmatter | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(() => getLastSyncTimestamp())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [projectEntries, setProjectEntries] = useState<ProjectEntry[]>(
    () => getJsonStorageItem<ProjectEntry[]>(STORAGE_KEYS.thinkingOrganizerProjects, []),
  )
  const [activeProjectRoot, setActiveProjectRoot] = useState<string>(() => {
    const saved = getJsonStorageItem<string[]>(STORAGE_KEYS.thinkingOrganizerSelectedProjectRoot, [])
    return normalizePath(saved.join('/'))
  })

  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [destinationSegments, setDestinationSegments] = useState<string[]>(
    () => getJsonStorageItem<string[]>(STORAGE_KEYS.thinkingOrganizerProjectCreateDestination, []),
  )
  const [destinationPath, setDestinationPath] = useState(() => destinationSegments.join('/'))
  const [creatingProject, setCreatingProject] = useState(false)

  const loadPrograms = useCallback(async (syncVault = false): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      if (syncVault) {
        setSyncing(true)
        await smartSync()
        setLastSyncedAt(getLastSyncTimestamp())
      }
      const { nodes: roots } = await invokeCapabilityOrThrow({
        capability: 'organizer.nodes.list_roots',
        input: { typeFilter: 'program' },
        actor: BACKLOG_ACTOR,
      })
      setPrograms(roots.sort((a, b) => a.title.localeCompare(b.title)))
      return true
    } catch (err) {
      setError(errorMessage(err, 'Failed to load programs'))
      return false
    } finally {
      setSyncing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPrograms(true)
  }, [loadPrograms])

  useEffect(() => {
    const onFocus = () => { void loadPrograms(false) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadPrograms])

  const syncVaultNow = useCallback(async () => {
    setMessage(null)
    setError(null)
    const ok = await loadPrograms(true)
    if (ok) setMessage('Vault synced and organizer cache refreshed.')
  }, [loadPrograms])

  useEffect(() => {
    if (!selectedNode) {
      setSelectedFrontmatter(null)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const { frontmatter } = await invokeCapabilityOrThrow({
          capability: 'organizer.node.read_frontmatter',
          input: { filePath: selectedNode.filePath },
          actor: BACKLOG_ACTOR,
        })
        if (!cancelled) setSelectedFrontmatter(frontmatter)
      } catch {
        if (!cancelled) setSelectedFrontmatter(null)
      }
    })()

    return () => { cancelled = true }
  }, [selectedNode])

  const availableProjects = useMemo(() => {
    const byRoot = new Map<string, ProjectEntry>()

    for (const project of projectEntries) {
      const root = normalizePath(project.root)
      if (!root) continue
      byRoot.set(root, {
        name: project.name?.trim() || humanizeKey(root.split('/')[root.split('/').length - 1] || ''),
        root,
      })
    }

    for (const program of programs) {
      const root = normalizePath(program.projectRoot ?? '')
      if (!root) continue
      if (!byRoot.has(root)) {
        byRoot.set(root, {
          name: humanizeKey(root.split('/')[root.split('/').length - 1] || ''),
          root,
        })
      }
    }

    return [...byRoot.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [projectEntries, programs])

  useEffect(() => {
    if (availableProjects.length === 0) {
      if (activeProjectRoot) {
        setActiveProjectRoot('')
        setJsonStorageItem(STORAGE_KEYS.thinkingOrganizerSelectedProjectRoot, [])
      }
      return
    }

    const exists = availableProjects.some(project => project.root === activeProjectRoot)
    if (exists) return

    const fallback = availableProjects[0].root
    setActiveProjectRoot(fallback)
    setJsonStorageItem(STORAGE_KEYS.thinkingOrganizerSelectedProjectRoot, fallback.split('/'))
  }, [activeProjectRoot, availableProjects])

  const visiblePrograms = useMemo(() => {
    if (!activeProjectRoot) return programs
    return programs.filter(program => normalizePath(program.projectRoot ?? '') === activeProjectRoot)
  }, [activeProjectRoot, programs])

  const selectProject = useCallback((root: string) => {
    const normalized = normalizePath(root)
    setActiveProjectRoot(normalized)
    setJsonStorageItem(STORAGE_KEYS.thinkingOrganizerSelectedProjectRoot, normalized.split('/'))
  }, [])

  const handleDestinationChange = useCallback((segments: string[], fullPath: string) => {
    setDestinationSegments(segments)
    setDestinationPath(fullPath)
    setJsonStorageItem(STORAGE_KEYS.thinkingOrganizerProjectCreateDestination, segments)
  }, [])

  const createProject = useCallback(async () => {
    const trimmedName = newProjectName.trim()
    const normalizedDestination = normalizePath(destinationPath)

    if (!trimmedName) {
      setError('Project name is required.')
      return
    }
    if (!normalizedDestination) {
      setError('Project destination is required.')
      return
    }

    const projectKey = generateKey(trimmedName) || 'project'
    const projectRoot = normalizePath(`${normalizedDestination}/${projectKey}`)

    setCreatingProject(true)
    setError(null)
    setMessage(null)

    try {
      const fs = getVaultFS()
      await fs.mkdir(projectRoot)
      await fs.mkdir(`${projectRoot}/${THINKING_ORGANIZER_DIR}`)

      const nextEntries = [...projectEntries]
      const existingIdx = nextEntries.findIndex(project => normalizePath(project.root) === projectRoot)
      if (existingIdx >= 0) {
        nextEntries[existingIdx] = { name: trimmedName, root: projectRoot }
      } else {
        nextEntries.push({ name: trimmedName, root: projectRoot })
      }
      nextEntries.sort((a, b) => a.name.localeCompare(b.name))

      setProjectEntries(nextEntries)
      setJsonStorageItem(STORAGE_KEYS.thinkingOrganizerProjects, nextEntries)
      selectProject(projectRoot)
      addRecent(STORAGE_KEYS.thinkingOrganizerProjectRoots, destinationSegments)

      setProjectModalOpen(false)
      setNewProjectName('')
      setMessage(`Created project: ${trimmedName}`)
    } catch (err) {
      setError(errorMessage(err, 'Failed to create project'))
    } finally {
      setCreatingProject(false)
    }
  }, [destinationPath, destinationSegments, newProjectName, projectEntries, selectProject])

  const createChildNode = useCallback(async (
    parent: NodeRecord | null,
    title: string,
    requestedType?: NodeType,
  ) => {
    const allowedTypes = allowedChildTypes(parent?.type ?? null)
    const nextType = requestedType && allowedTypes.includes(requestedType)
      ? requestedType
      : allowedTypes[0]

    if (!parent && !activeProjectRoot) {
      throw new Error('Create or select a project first.')
    }

    const { node: created } = await invokeCapabilityOrThrow({
      capability: 'organizer.node.create',
      input: {
        type: nextType,
        title,
        parentKey: parent?.key,
        parentUuid: parent?.uuid,
        parentType: parent?.type,
        projectRoot: parent ? undefined : activeProjectRoot,
      },
      actor: BACKLOG_ACTOR,
    })
    if (!parent) {
      setPrograms(prev => [...prev, created].sort((a, b) => a.title.localeCompare(b.title)))
    }
    setMessage(`Created ${defaultNodeKindLabel(created.type)}: ${created.title}`)
    return created
  }, [activeProjectRoot])

  const deleteNodeRecursive = useCallback(async (node: NodeRecord, removedIds: Set<string>): Promise<void> => {
    const { nodes: children } = await invokeCapabilityOrThrow({
      capability: 'organizer.nodes.list_children',
      input: { parentKey: node.key },
      actor: BACKLOG_ACTOR,
    })
    for (const child of children) {
      await deleteNodeRecursive(child, removedIds)
    }
    await invokeCapabilityOrThrow({
      capability: 'organizer.node.delete',
      input: { uuid: node.uuid },
      actor: BACKLOG_ACTOR,
    })
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
      const { node: updated } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.rename',
        input: {
          uuid: selectedNode.uuid,
          newTitle,
        },
        actor: BACKLOG_ACTOR,
      })
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
      const { node: updated } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.update',
        input: {
          uuid: selectedNode.uuid,
          updates: { status: status as 'active' | 'paused' | 'completed' | 'archived' },
        },
        actor: BACKLOG_ACTOR,
      })
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
      const { node: updated } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.update',
        input: {
          uuid: selectedNode.uuid,
          updates: { priority: priority as 'low' | 'medium' | 'high' | 'critical' },
        },
        actor: BACKLOG_ACTOR,
      })
      setSelectedNode(updated)
    } catch (err) {
      setError(errorMessage(err, 'Failed to update priority'))
    } finally {
      setWorking(false)
    }
  }, [selectedNode])

  const updateNodeNotes = useCallback(async (description: string, comments: YAMLCommentEntry[]) => {
    if (!selectedNode) return
    setWorking(true)
    setError(null)
    try {
      const { node: updated } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.update',
        input: {
          uuid: selectedNode.uuid,
          updates: {
            description,
            comments,
          },
        },
        actor: BACKLOG_ACTOR,
      })
      setSelectedNode(updated)
      setMessage('Updated description/comments')
    } catch (err) {
      setError(errorMessage(err, 'Failed to update description/comments'))
    } finally {
      setWorking(false)
    }
  }, [selectedNode])

  const dropNodeToNode = useCallback(async (sourceUuid: string, targetNode: NodeRecord) => {
    setWorking(true)
    setError(null)
    setMessage(null)
    try {
      const { node: sourceNode } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.get',
        input: { uuid: sourceUuid },
        actor: BACKLOG_ACTOR,
      })
      if (!sourceNode) throw new Error('Source node not found')
      if (sourceNode.uuid === targetNode.uuid) throw new Error('Cannot move a node onto itself.')
      await invokeCapabilityOrThrow({
        capability: 'organizer.node.move',
        input: {
          uuid: sourceNode.uuid,
          newParentKey: targetNode.key,
        },
        actor: BACKLOG_ACTOR,
      })
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
      const { nodes: allNodes } = await invokeCapabilityOrThrow({
        capability: 'organizer.nodes.list_all',
        input: {},
        actor: BACKLOG_ACTOR,
      })
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setProjectModalOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create Project
        </Button>

        {availableProjects.map(project => {
          const isActive = project.root === activeProjectRoot
          return (
            <Button
              key={project.root}
              size="sm"
              variant={isActive ? 'default' : 'secondary'}
              onClick={() => selectProject(project.root)}
            >
              {project.name}
            </Button>
          )
        })}

        {activeProjectRoot && (
          <div className="basis-full text-xs text-muted-foreground">
            Active project root:{' '}
            <span className="font-mono text-foreground">{activeProjectRoot}</span>
          </div>
        )}
      </div>

      {(message || error) && (
        <div className="space-y-2">
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

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => { void syncVaultNow() }} disabled={working || syncing}>
          {syncing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Sync Vault Now
        </Button>
        <Button size="sm" variant="outline" onClick={() => { void exportToExcalidraw() }} disabled={working}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Export Excalidraw
        </Button>
        <div className="text-xs text-muted-foreground">
          Last synced: <span className="font-medium text-foreground">{formatSyncTime(lastSyncedAt)}</span>
        </div>
        {(working || syncing) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading hierarchy...
        </div>
      ) : (
        <BacklogListBlock
          programs={visiblePrograms}
          loadEpics={async program => {
            const { nodes } = await invokeCapabilityOrThrow({
              capability: 'organizer.nodes.list_children',
              input: { parentKey: program.key },
              actor: BACKLOG_ACTOR,
            })
            return nodes
          }}
          loadChildren={async node => {
            const { nodes } = await invokeCapabilityOrThrow({
              capability: 'organizer.nodes.list_children',
              input: { parentKey: node.key },
              actor: BACKLOG_ACTOR,
            })
            return nodes
          }}
          selectedNodeId={selectedNode?.uuid ?? null}
          onSelectNode={setSelectedNode}
          onCreateChild={createChildNode}
          onDropNodeToNode={dropNodeToNode}
        />
      )}

      {selectedNode && (
        <NodeDetailPanelBlock
          node={selectedNode}
          frontmatter={selectedFrontmatter}
          onClose={() => setSelectedNode(null)}
          onRename={renameNode}
          onUpdateStatus={updateStatus}
          onUpdatePriority={updatePriority}
          onUpdateNotes={updateNodeNotes}
          onOpenFile={() => openFile(selectedNode.filePath)}
          onDelete={() => deleteAnyNode(selectedNode)}
        />
      )}

      {projectModalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm" onClick={() => setProjectModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-xl border-border/80 shadow-2xl">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Create Project</CardTitle>
                    <CardDescription>
                      Choose project name and destination. We will create a <code>{THINKING_ORGANIZER_DIR}</code> folder inside it.
                    </CardDescription>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                    onClick={() => setProjectModalOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Project name</label>
                  <input
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    placeholder="Data Ingestion"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Destination folder</label>
                  <input
                    value={destinationPath}
                    onChange={e => {
                      const next = e.target.value
                      setDestinationPath(next)
                      const nextSegments = next.split('/').filter(Boolean)
                      setDestinationSegments(nextSegments)
                      setJsonStorageItem(STORAGE_KEYS.thinkingOrganizerProjectCreateDestination, nextSegments)
                    }}
                    placeholder="operations"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                  <CascadingFolderPicker
                    defaultPath={destinationSegments}
                    onChange={handleDestinationChange}
                    storageKey={STORAGE_KEYS.thinkingOrganizerProjectRoots}
                    maxRecents={12}
                  />
                </div>

                <div className="rounded-md border border-border/60 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
                  Project root preview:{' '}
                  <span className="font-mono text-foreground">
                    {destinationPath.trim() && newProjectName.trim()
                      ? `${normalizePath(destinationPath)}/${generateKey(newProjectName) || 'project'}`
                      : '(enter name and destination)'}
                  </span>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setProjectModalOpen(false)} disabled={creatingProject}>
                    Cancel
                  </Button>
                  <Button onClick={() => { void createProject() }} disabled={creatingProject}>
                    {creatingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Project'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
