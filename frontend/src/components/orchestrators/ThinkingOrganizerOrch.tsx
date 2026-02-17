import { useCallback, useState } from 'react'
import { ArrowRight, Loader2, FolderTree, Layers, Lightbulb } from 'lucide-react'
import { Button } from '@/components/lego_blocks/ui/button'
import type { NodeRecord } from '@/services/lego_blocks/dbBlock'
import type { NodeType } from '@/services/lego_blocks/yamlNoteBlock'
import { useMarkdownViewer } from '@/components/orchestrators/MarkdownViewerOrch'
import { defaultNodeKindLabel } from '@/components/lego_blocks/HierarchyTreeBlock'
import { invokeCapabilityOrThrow } from '@/services/orchestrators/capabilityRouterOrch'
import type { CapabilityActor } from '@/services/lego_blocks/capabilityRegistryBlock'
import {
  STORAGE_KEYS,
  getStorageItem,
  setStorageItem,
} from '@/services/lego_blocks/storageKeyBlock'
import BacklogOrch from '@/components/orchestrators/BacklogOrch'
import LinkingOrch from '@/components/orchestrators/LinkingOrch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/ui/card'
import { useEffect } from 'react'

type TabMode = 'backlog' | 'view' | 'link'

function nodeIcon(type: NodeType) {
  if (type === 'program') return FolderTree
  if (type === 'epic') return Layers
  return Lightbulb
}

function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) return value.message
  if (typeof value === 'string' && value.trim()) return value
  return fallback
}

const VIEW_ACTOR: CapabilityActor = {
  kind: 'human',
  id: 'ui.organizer-view',
}

function usePersistentTab(): [TabMode, (value: TabMode) => void] {
  const [tab, setTab] = useState<TabMode>(() => {
    const saved = getStorageItem(STORAGE_KEYS.thinkingOrganizerTab)
    if (saved === 'view' || saved === 'link') return saved
    return 'backlog'
  })

  const setAndPersist = useCallback((value: TabMode) => {
    setTab(value)
    setStorageItem(STORAGE_KEYS.thinkingOrganizerTab, value)
  }, [])

  return [tab, setAndPersist]
}

function ViewTab() {
  const { openFile } = useMarkdownViewer()
  const [programs, setPrograms] = useState<NodeRecord[]>([])
  const [selectedPath, setSelectedPath] = useState<NodeRecord[]>([])
  const [currentNodes, setCurrentNodes] = useState<NodeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [nodesLoading, setNodesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPrograms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { nodes: roots } = await invokeCapabilityOrThrow({
        capability: 'organizer.nodes.list_roots',
        input: { typeFilter: 'program' },
        actor: VIEW_ACTOR,
      })
      const sorted = roots.sort((a, b) => a.title.localeCompare(b.title))
      setPrograms(sorted)
      setCurrentNodes(sorted)
    } catch (err) {
      setError(errorMessage(err, 'Failed to load programs'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPrograms()
  }, [loadPrograms])

  const openPathNode = useCallback(async (node: NodeRecord) => {
    setError(null)
    setNodesLoading(true)
    const nextPath = [...selectedPath, node]
    setSelectedPath(nextPath)

    try {
      const { nodes: children } = await invokeCapabilityOrThrow({
        capability: 'organizer.nodes.list_children',
        input: { parentKey: node.key },
        actor: VIEW_ACTOR,
      })
      setCurrentNodes(children.sort((a, b) => a.title.localeCompare(b.title)))
    } catch (err) {
      setError(errorMessage(err, 'Failed to load children'))
    } finally {
      setNodesLoading(false)
    }
  }, [selectedPath])

  const rewindPath = useCallback(async (index: number) => {
    const nextPath = selectedPath.slice(0, index + 1)
    setSelectedPath(nextPath)
    const parent = nextPath[nextPath.length - 1]
    setNodesLoading(true)
    setError(null)
    try {
      const { nodes: children } = await invokeCapabilityOrThrow({
        capability: 'organizer.nodes.list_children',
        input: { parentKey: parent.key },
        actor: VIEW_ACTOR,
      })
      setCurrentNodes(children.sort((a, b) => a.title.localeCompare(b.title)))
    } catch (err) {
      setError(errorMessage(err, 'Failed to rewind path'))
    } finally {
      setNodesLoading(false)
    }
  }, [selectedPath])

  const resetToPrograms = useCallback(() => {
    setSelectedPath([])
    setCurrentNodes(programs)
  }, [programs])

  const levelLabel = selectedPath.length === 0 ? 'Programs' : 'Children'

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Hierarchy View</CardTitle>
          <CardDescription>
            Start at programs and drill down through your hierarchy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
              onClick={resetToPrograms}
            >
              Programs
            </button>
            {selectedPath.map((node, idx) => (
              <span key={node.uuid} className="inline-flex items-center gap-1.5">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
                  onClick={() => {
                    void rewindPath(idx)
                  }}
                >
                  {node.title}
                </button>
              </span>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading programs...
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {levelLabel}
              </div>
              {nodesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading level...
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {currentNodes.map(node => {
                    const Icon = nodeIcon(node.type)
                    return (
                      <button
                        key={node.uuid}
                        type="button"
                        className="rounded-xl border border-border/60 bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                        onClick={() => {
                          void openPathNode(node)
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div className="truncate text-sm font-medium">{node.title}</div>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {defaultNodeKindLabel(node.type)}
                          {node.status !== 'active' && ` \u00b7 ${node.status}`}
                        </div>
                        {node.aiSummary && (
                          <div className="mt-1 truncate text-xs text-muted-foreground/70">
                            {node.aiSummary}
                          </div>
                        )}
                      </button>
                    )
                  })}
                  {currentNodes.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border/70 px-3 py-6 text-sm text-muted-foreground">
                      No nodes at this level.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPath.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Node Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            {(() => {
              const node = selectedPath[selectedPath.length - 1]
              return (
                <>
                  <div>Title: <span className="font-medium text-foreground">{node.title}</span></div>
                  <div>Type: {defaultNodeKindLabel(node.type)}</div>
                  <div>Key: <span className="font-mono">{node.key}</span></div>
                  <div>Path: <span className="font-mono">{node.filePath}</span></div>
                  {node.tags && node.tags.length > 0 && <div>Tags: {node.tags.join(', ')}</div>}
                  <Button size="sm" variant="outline" onClick={() => openFile(node.filePath)}>
                    Open File
                  </Button>
                </>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}

export default function ThinkingOrganizerOrch() {
  const [tab, setTab] = usePersistentTab()

  return (
    <div className="ltm-page-shell ltm-shell-ultra">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Thinking Organizer</h1>
        <p className="text-sm text-muted-foreground">
          Create and organize hierarchy items in Create, explore in View, and map them to files in Link.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Button
          variant={tab === 'backlog' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setTab('backlog')}
        >
          Create
        </Button>
        <Button
          variant={tab === 'view' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setTab('view')}
        >
          View
        </Button>
        <Button
          variant={tab === 'link' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setTab('link')}
        >
          Link
        </Button>
      </div>

      {tab === 'backlog' && <BacklogOrch />}
      {tab === 'view' && <ViewTab />}
      {tab === 'link' && <LinkingOrch />}
    </div>
  )
}
