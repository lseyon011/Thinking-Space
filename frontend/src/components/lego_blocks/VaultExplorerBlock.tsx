import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  File,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCcw,
  Search,
} from 'lucide-react'
import { Button } from '@/components/lego_blocks/ui/button'
import { cn } from '@/lib/utils'

interface FolderEntries {
  folders: string[]
  files: string[]
}

interface NodeState extends FolderEntries {
  loaded: boolean
  loading: boolean
  error: string | null
}

interface VaultExplorerBlockProps {
  loadEntries: (path: string) => Promise<FolderEntries>
  onOpenFile: (path: string) => void
  selectedPath?: string | null
  onSelectFile?: (path: string) => void
  onDropNode?: (nodeUuid: string, targetPath: string) => Promise<void>
  draggableFiles?: boolean
  draggableFolders?: boolean
  title?: string
  className?: string
}

function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name
}

function getFileIcon(name: string) {
  const lower = name.toLowerCase()
  if (lower.endsWith('.md')) return FileText
  return File
}

function getParentPath(path: string): string {
  const idx = path.lastIndexOf('/')
  if (idx < 0) return ''
  return path.slice(0, idx)
}

function hasNodeDragType(event: React.DragEvent): boolean {
  const types = Array.from(event.dataTransfer.types)
  return types.includes('application/x-ltm-node-id') || types.includes('text/ltm-node-id')
}

function readDroppedNodeId(event: React.DragEvent): string | null {
  const explicit = event.dataTransfer.getData('application/x-ltm-node-id').trim()
  if (explicit) return explicit
  const textFallback = event.dataTransfer.getData('text/ltm-node-id').trim()
  if (textFallback) return textFallback
  const plain = event.dataTransfer.getData('text/plain').trim()
  if (plain.startsWith('ltm-node:')) return plain.slice('ltm-node:'.length).trim() || null
  return null
}

export default function VaultExplorerBlock({
  loadEntries,
  onOpenFile,
  selectedPath = null,
  onSelectFile,
  onDropNode,
  draggableFiles = false,
  draggableFolders = false,
  title = 'Thinking Space Explorer',
  className,
}: VaultExplorerBlockProps) {
  const [nodes, setNodes] = useState<Record<string, NodeState>>({})
  const [expandedPaths, setExpandedPaths] = useState<string[]>([''])
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null)
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [dropOverPath, setDropOverPath] = useState<string | null>(null)

  const getNode = useCallback(
    (path: string): NodeState =>
      nodes[path] ?? { folders: [], files: [], loaded: false, loading: false, error: null },
    [nodes],
  )

  const loadPath = useCallback(
    async (path: string, force = false) => {
      let shouldLoad = true

      setNodes(prev => {
        const existing = prev[path]
        if (!force && existing?.loaded) {
          shouldLoad = false
          return prev
        }

        return {
          ...prev,
          [path]: {
            ...(existing ?? { folders: [], files: [] }),
            loaded: false,
            loading: true,
            error: null,
          },
        }
      })

      if (!shouldLoad) return

      try {
        const entries = await loadEntries(path)
        setNodes(prev => ({
          ...prev,
          [path]: {
            ...entries,
            loaded: true,
            loading: false,
            error: null,
          },
        }))
      } catch (err) {
        setNodes(prev => ({
          ...prev,
          [path]: {
            ...(prev[path] ?? { folders: [], files: [] }),
            loaded: false,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load folder',
          },
        }))
      }
    },
    [loadEntries],
  )

  useEffect(() => {
    void loadPath('')
  }, [loadPath])

  useEffect(() => {
    if (!selectedPath) return
    setSelectedFilePath(selectedPath)
    setSelectedFolderPath(getParentPath(selectedPath))
  }, [selectedPath])

  const normalizedQuery = query.trim().toLowerCase()
  const hasTitle = title.trim().length > 0

  const pathMatchesQuery = useCallback(
    (path: string, visited: Set<string>): boolean => {
      if (!normalizedQuery) return true
      if (visited.has(path)) return false
      visited.add(path)

      const node = getNode(path)

      for (const folderName of node.folders) {
        const full = joinPath(path, folderName)
        if (folderName.toLowerCase().includes(normalizedQuery)) return true
        if (pathMatchesQuery(full, visited)) return true
      }

      for (const fileName of node.files) {
        if (fileName.toLowerCase().includes(normalizedQuery)) return true
      }

      return false
    },
    [getNode, normalizedQuery],
  )

  const toggleFolder = useCallback(
    (path: string) => {
      setExpandedPaths(prev => {
        if (prev.includes(path)) return prev.filter(p => p !== path)
        return [...prev, path]
      })
      if (!getNode(path).loaded) {
        void loadPath(path)
      }
    },
    [getNode, loadPath],
  )

  const refreshRoot = useCallback(() => {
    setNodes({})
    setExpandedPaths([''])
    setSelectedFolderPath(null)
    setSelectedFilePath(null)
    void loadPath('', true)
  }, [loadPath])

  const isExpanded = useCallback((path: string) => expandedPaths.includes(path), [expandedPaths])

  const renderPath = useCallback(
    (path: string, depth: number): JSX.Element[] => {
      const node = getNode(path)
      const rows: JSX.Element[] = []

      const visibleFolders = node.folders.filter(folderName => {
        if (!normalizedQuery) return true
        if (folderName.toLowerCase().includes(normalizedQuery)) return true
        return pathMatchesQuery(joinPath(path, folderName), new Set())
      })

      const visibleFiles = node.files.filter(fileName => {
        if (!normalizedQuery) return true
        return fileName.toLowerCase().includes(normalizedQuery)
      })

      visibleFolders.forEach(folderName => {
        const folderPath = joinPath(path, folderName)
        const expanded = isExpanded(folderPath)
        const folderNode = getNode(folderPath)
        const inSelectionTrail = selectedFolderPath === folderPath
          || (selectedFolderPath?.startsWith(`${folderPath}/`) ?? false)

        rows.push(
          <button
            key={`folder-${folderPath}`}
            type="button"
            draggable={draggableFolders}
            onDragStart={event => {
              if (!draggableFolders) return
              event.dataTransfer.setData('application/x-ltm-path', `ltm-path:${folderPath}`)
              event.dataTransfer.setData('text/ltm-file-path', folderPath)
              event.dataTransfer.setData('text/plain', folderPath)
              event.dataTransfer.effectAllowed = 'copy'
            }}
            onDragOver={onDropNode ? (event => {
              if (!hasNodeDragType(event)) return
              event.preventDefault()
              event.stopPropagation()
              event.dataTransfer.dropEffect = 'link'
              setDropOverPath(folderPath)
            }) : undefined}
            onDragLeave={onDropNode ? (() => {
              setDropOverPath(prev => prev === folderPath ? null : prev)
            }) : undefined}
            onDrop={onDropNode ? (event => {
              event.preventDefault()
              event.stopPropagation()
              setDropOverPath(null)
              const nodeId = readDroppedNodeId(event)
              if (nodeId) void onDropNode(nodeId, folderPath)
            }) : undefined}
            onClick={() => {
              setSelectedFolderPath(folderPath)
              toggleFolder(folderPath)
            }}
            className={cn(
              'ltm-explorer-row ltm-touch-row group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground/90 transition-colors hover:bg-muted/70',
              inSelectionTrail && 'border border-border/60 bg-muted/85 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_8px_-6px_rgba(0,0,0,0.35)] hover:bg-muted/90',
              expanded && !inSelectionTrail && 'bg-muted/50',
              onDropNode && dropOverPath === folderPath && 'ring-2 ring-blue-500/60 bg-blue-500/5',
            )}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
          >
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform',
                expanded && 'rotate-90',
                inSelectionTrail && 'text-foreground/75',
              )}
            />
            {expanded ? (
              <FolderOpen className={cn('h-3.5 w-3.5 text-blue-500', inSelectionTrail && 'text-foreground/85')} />
            ) : (
              <Folder className={cn('h-3.5 w-3.5 text-blue-500', inSelectionTrail && 'text-foreground/85')} />
            )}
            <span className="truncate">{folderName}</span>
            {folderNode.loading && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </button>,
        )

        if (expanded) {
          if (folderNode.error) {
            rows.push(
              <div
                key={`folder-error-${folderPath}`}
                className="px-2 py-1 text-xs text-destructive"
                style={{ paddingLeft: `${26 + depth * 14}px` }}
              >
                {folderNode.error}
              </div>,
            )
          }

          if (folderNode.loading && !folderNode.loaded) {
            rows.push(
              <div
                key={`folder-loading-${folderPath}`}
                className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"
                style={{ paddingLeft: `${26 + depth * 14}px` }}
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </div>,
            )
          }

          if (folderNode.loaded) {
            rows.push(...renderPath(folderPath, depth + 1))
          }
        }
      })

      visibleFiles.forEach(fileName => {
        const filePath = joinPath(path, fileName)
        const Icon = getFileIcon(fileName)

        rows.push(
          <button
            key={`file-${filePath}`}
            type="button"
            draggable={draggableFiles}
            onDragStart={event => {
              if (!draggableFiles) return
              event.dataTransfer.setData('application/x-ltm-path', `ltm-path:${filePath}`)
              event.dataTransfer.setData('text/ltm-file-path', filePath)
              event.dataTransfer.setData('text/plain', filePath)
              event.dataTransfer.effectAllowed = 'copy'
            }}
            onDragOver={onDropNode ? (event => {
              if (!hasNodeDragType(event)) return
              event.preventDefault()
              event.stopPropagation()
              event.dataTransfer.dropEffect = 'link'
              setDropOverPath(filePath)
            }) : undefined}
            onDragLeave={onDropNode ? (() => {
              setDropOverPath(prev => prev === filePath ? null : prev)
            }) : undefined}
            onDrop={onDropNode ? (event => {
              event.preventDefault()
              event.stopPropagation()
              setDropOverPath(null)
              const nodeId = readDroppedNodeId(event)
              if (nodeId) void onDropNode(nodeId, filePath)
            }) : undefined}
            onClick={() => {
              setSelectedFilePath(filePath)
              setSelectedFolderPath(getParentPath(filePath))
              onSelectFile?.(filePath)
              onOpenFile(filePath)
            }}
            className={cn(
              'ltm-explorer-row ltm-touch-row group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground/80 transition-colors hover:bg-muted/70',
              selectedFilePath === filePath && 'border border-[#c73773]/95 bg-[#c73773] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_2px_8px_-6px_rgba(0,0,0,0.45)] hover:bg-[#c73773]',
              onDropNode && dropOverPath === filePath && 'ring-2 ring-blue-500/60 bg-blue-500/5',
            )}
            style={{ paddingLeft: `${26 + depth * 14}px` }}
          >
            <Icon className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground', selectedFilePath === filePath && 'text-white')} />
            <span className="truncate">{fileName}</span>
          </button>,
        )
      })

      return rows
    },
    [dropOverPath, getNode, isExpanded, normalizedQuery, onDropNode, onOpenFile, onSelectFile, pathMatchesQuery, selectedFilePath, selectedFolderPath, toggleFolder],
  )

  const rootNode = getNode('')

  const content = useMemo(() => {
    if (rootNode.loading && !rootNode.loaded) {
      return (
        <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading vault...
        </div>
      )
    }

    const rows = renderPath('', 0)
    if (rows.length === 0) {
      return (
        <div className="px-3 py-4 text-sm text-muted-foreground">
          {normalizedQuery ? 'No matching files or folders.' : 'Vault appears to be empty.'}
        </div>
      )
    }

    return rows
  }, [normalizedQuery, renderPath, rootNode.loaded, rootNode.loading])

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="border-b border-border/60 px-3 py-2">
        {hasTitle && (
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={refreshRoot}
              title="Refresh explorer"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter files..."
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs text-foreground outline-none ring-0 transition-colors placeholder:text-muted-foreground focus:border-ring"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-1.5 py-2">{content}</div>
    </div>
  )
}
