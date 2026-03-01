import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import BacklogListBlock from '@/components/lego_blocks/integrations/BacklogListBlock'
import ScrollableZoomSurfaceBlock from '@/components/lego_blocks/integrations/ScrollableZoomSurfaceBlock'
import VaultExplorerBlock from '@/components/lego_blocks/integrations/VaultExplorerBlock'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import { dropPathToYamlNodeOrch } from '@/services/orchestrators/thinkingOrganizerDropOrch'
import { listFolderEntries } from '@/services/orchestrators/fileSystemOrch'
import { useMarkdownViewer } from '@/components/orchestrators/MarkdownViewerOrch'
import { invokeCapabilityOrThrow } from '@/services/orchestrators/capabilityRouterOrch'
import type { CapabilityActor } from '@/services/lego_blocks/integrations/capabilityRegistryBlock'

const LINKING_ACTOR: CapabilityActor = {
  kind: 'human',
  id: 'ui.linking',
}

function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) return value.message
  if (typeof value === 'string' && value.trim()) return value
  return fallback
}

export default function LinkingOrch() {
  const { openFile } = useMarkdownViewer()
  const [programs, setPrograms] = useState<NodeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const loadPrograms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { nodes: roots } = await invokeCapabilityOrThrow({
        capability: 'organizer.nodes.list_roots',
        input: { typeFilter: 'program' },
        actor: LINKING_ACTOR,
      })
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

  const handleDropNodeOnPath = useCallback(async (nodeUuid: string, targetPath: string) => {
    setWorking(true)
    setError(null)
    setMessage(null)
    try {
      const { node } = await invokeCapabilityOrThrow({
        capability: 'organizer.node.get',
        input: { uuid: nodeUuid },
        actor: LINKING_ACTOR,
      })
      if (!node) throw new Error('Node not found')
      if (node.type === 'program') throw new Error('Cannot link files to a program node directly.')

      const result = await dropPathToYamlNodeOrch({
        targetNode: node,
        droppedPath: targetPath,
      })

      if (result.mappedCount === 0 && result.failureCount > 0) {
        throw new Error(`No items were mapped. ${result.failures[0]?.reason ?? 'Unknown error'}`)
      }

      const summary = `Linked ${result.mappedCount} file${result.mappedCount === 1 ? '' : 's'} to ${node.title}`
      if (result.failureCount > 0) {
        setMessage(`${summary} (${result.failureCount} failed)`)
        setError(result.failures[0]?.reason ?? 'Some items failed')
        return
      }
      setMessage(summary)
    } catch (err) {
      setError(errorMessage(err, 'Failed to link node to file'))
    } finally {
      setWorking(false)
    }
  }, [])

  return (
    <div className="space-y-4">
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

      {working && (
        <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/10 px-2.5 py-1 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Linking...
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Left: read-only backlog for dragging */}
        <Card className="flex min-h-[420px] h-[calc(100dvh-16rem)] flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Hierarchy (drag items)</CardTitle>
            <CardDescription>Drag items from here onto files in the explorer to link them.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-auto p-0 px-3 pb-3">
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <ScrollableZoomSurfaceBlock controlsLabel="Table zoom">
                <BacklogListBlock
                  programs={programs}
                  loadEpics={async program => {
                    const { nodes } = await invokeCapabilityOrThrow({
                      capability: 'organizer.nodes.list_children',
                      input: { parentKey: program.key },
                      actor: LINKING_ACTOR,
                    })
                    return nodes
                  }}
                  loadChildren={async node => {
                    const { nodes } = await invokeCapabilityOrThrow({
                      capability: 'organizer.nodes.list_children',
                      input: { parentKey: node.key },
                      actor: LINKING_ACTOR,
                    })
                    return nodes
                  }}
                  selectedNodeId={null}
                  readOnly
                  onSelectNode={() => {}}
                />
              </ScrollableZoomSurfaceBlock>
            )}
          </CardContent>
        </Card>

        {/* Right: vault explorer with drop targets */}
        <Card className="flex min-h-[420px] h-[calc(100dvh-16rem)] flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Vault Explorer (drop here)</CardTitle>
            <CardDescription>Drop hierarchy items onto files to link them.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 p-0">
            <VaultExplorerBlock
              loadEntries={listFolderEntries}
              onOpenFile={path => openFile(path)}
              onDropNode={handleDropNodeOnPath}
              title="Vault Explorer"
              className="h-full"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
