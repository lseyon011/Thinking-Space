import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

type ExplorerPathKind = 'file' | 'folder'
type ExplorerActionResult = void | boolean | string | Promise<void | boolean | string>

interface ContextMenuState {
  x: number
  y: number
  path: string
  kind: ExplorerPathKind
}

interface PendingRenameState {
  path: string
  kind: ExplorerPathKind
}

interface InlineRenameState {
  path: string
  kind: ExplorerPathKind
  value: string
}

interface VaultExplorerBlockProps {
  loadEntries: (path: string) => Promise<FolderEntries>
  onOpenFile: (path: string) => void
  onCreateFolder?: (parentPath: string) => ExplorerActionResult
  onCreateFile?: (parentPath: string) => ExplorerActionResult
  onCreateDrawing?: (parentPath: string) => ExplorerActionResult
  onCopyAbsolutePath?: (path: string) => ExplorerActionResult
  onCopyRelativePath?: (path: string) => ExplorerActionResult
  onOpenInNewTab?: (path: string) => ExplorerActionResult
  onOpenInNewWindow?: (path: string) => ExplorerActionResult
  onDuplicateFile?: (path: string) => ExplorerActionResult
  onRenamePath?: (path: string, kind: ExplorerPathKind, nextName: string) => ExplorerActionResult
  onDeleteFile?: (path: string) => ExplorerActionResult
  onOpenInFinder?: (path: string) => ExplorerActionResult
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

function getLeafName(path: string): string {
  const idx = path.lastIndexOf('/')
  if (idx < 0) return path
  return path.slice(idx + 1)
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
  onCreateFolder,
  onCreateFile,
  onCreateDrawing,
  onCopyAbsolutePath,
  onCopyRelativePath,
  onOpenInNewTab,
  onOpenInNewWindow,
  onDuplicateFile,
  onRenamePath,
  onDeleteFile,
  onOpenInFinder,
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [pendingRename, setPendingRename] = useState<PendingRenameState | null>(null)
  const [inlineRename, setInlineRename] = useState<InlineRenameState | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const renameSubmittingRef = useRef(false)

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
  const inlineRenameSession = inlineRename ? `${inlineRename.kind}:${inlineRename.path}` : null

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
    setPendingRename(null)
    void loadPath('', true)
  }, [loadPath])

  const isExpanded = useCallback((path: string) => expandedPaths.includes(path), [expandedPaths])

  const rowRefKey = useCallback((kind: ExplorerPathKind, path: string) => `${kind}:${path}`, [])

  const bindRowRef = useCallback(
    (kind: ExplorerPathKind, path: string) => (node: HTMLButtonElement | null) => {
      const key = rowRefKey(kind, path)
      if (node) rowRefs.current.set(key, node)
      else rowRefs.current.delete(key)
    },
    [rowRefKey],
  )

  const beginInlineRename = useCallback((path: string, kind: ExplorerPathKind) => {
    setPendingRename(null)
    setInlineRename({
      path,
      kind,
      value: getLeafName(path),
    })
    if (kind === 'file') {
      setSelectedFilePath(path)
      setSelectedFolderPath(getParentPath(path))
    } else {
      setSelectedFolderPath(path)
    }
  }, [])

  const cancelInlineRename = useCallback(() => {
    if (!inlineRename) return
    const key = rowRefKey(inlineRename.kind, inlineRename.path)
    const row = rowRefs.current.get(key)
    setInlineRename(null)
    if (row) {
      window.requestAnimationFrame(() => row.focus())
    }
  }, [inlineRename, rowRefKey])

  const commitInlineRename = useCallback(async () => {
    if (!inlineRename || renameSubmittingRef.current) return
    const currentPath = inlineRename.path
    const currentKind = inlineRename.kind
    const trimmed = inlineRename.value.trim()
    const original = getLeafName(currentPath)

    if (!trimmed || trimmed === original) {
      cancelInlineRename()
      return
    }

    if (!onRenamePath) {
      cancelInlineRename()
      return
    }

    renameSubmittingRef.current = true
    try {
      const result = await onRenamePath(currentPath, currentKind, trimmed)
      const nextPath = typeof result === 'string' ? result : currentPath
      const parentPath = getParentPath(nextPath)
      if (currentKind === 'file') {
        setSelectedFilePath(nextPath)
        setSelectedFolderPath(parentPath)
      } else {
        setSelectedFolderPath(nextPath)
      }
      setInlineRename(null)
      void loadPath(parentPath, true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rename failed'
      window.alert(message)
    } finally {
      renameSubmittingRef.current = false
    }
  }, [cancelInlineRename, inlineRename, loadPath, onRenamePath])

  const runContextAction = useCallback(
    async (
      handler: (() => ExplorerActionResult) | undefined,
      options?: { refresh?: boolean; refreshPath?: string; armRenameOnEnterKind?: ExplorerPathKind },
    ) => {
      if (!handler) return
      try {
        const result = await handler()
        if (result !== false && typeof result === 'string' && options?.armRenameOnEnterKind) {
          const createdPath = result
          const createdParent = getParentPath(createdPath)
          setPendingRename({ path: createdPath, kind: options.armRenameOnEnterKind })
          if (options.armRenameOnEnterKind === 'file') {
            setSelectedFilePath(createdPath)
            setSelectedFolderPath(createdParent)
          } else {
            setSelectedFolderPath(createdPath)
          }
        } else if (result === false) {
          setPendingRename(null)
        }
        if (result !== false && typeof options?.refreshPath === 'string') {
          void loadPath(options.refreshPath, true)
        } else if (options?.refresh && result !== false) {
          refreshRoot()
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Action failed'
        window.alert(message)
      } finally {
        setContextMenu(null)
      }
    },
    [loadPath, refreshRoot],
  )

  const openContextMenu = useCallback(
    (event: React.MouseEvent, path: string, kind: ExplorerPathKind) => {
      event.preventDefault()
      event.stopPropagation()
      setPendingRename(null)
      if (kind === 'file') {
        setSelectedFilePath(path)
        setSelectedFolderPath(getParentPath(path))
      } else {
        setSelectedFolderPath(path)
      }
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        path,
        kind,
      })
    },
    [],
  )

  useEffect(() => {
    if (!pendingRename) return
    const key = rowRefKey(pendingRename.kind, pendingRename.path)
    const node = rowRefs.current.get(key)
    if (!node) return
    const rafId = window.requestAnimationFrame(() => node.focus())
    return () => window.cancelAnimationFrame(rafId)
  }, [nodes, pendingRename, rowRefKey])

  useEffect(() => {
    if (!inlineRenameSession) return
    const rafId = window.requestAnimationFrame(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [inlineRenameSession])

  useEffect(() => {
    if (!contextMenu) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        setContextMenu(null)
        return
      }
      if (!contextMenuRef.current?.contains(target)) {
        setContextMenu(null)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null)
    }

    const onScroll = () => setContextMenu(null)

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [contextMenu])

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
        const isInlineEditing = inlineRename?.kind === 'folder' && inlineRename.path === folderPath
        const inSelectionTrail = selectedFolderPath === folderPath
          || (selectedFolderPath?.startsWith(`${folderPath}/`) ?? false)

        if (isInlineEditing) {
          rows.push(
            <div
              key={`folder-${folderPath}`}
              className={cn(
                'ltm-explorer-row flex w-full items-center gap-1 rounded-md border border-border/60 bg-muted/85 px-2 py-1.5 text-[13px] text-foreground',
                onDropNode && dropOverPath === folderPath && 'ring-2 ring-blue-500/60 bg-blue-500/5',
              )}
              style={{ paddingLeft: `${8 + depth * 14}px` }}
            >
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 text-muted-foreground transition-transform',
                  expanded && 'rotate-90',
                )}
              />
              {expanded ? (
                <FolderOpen className="h-3.5 w-3.5 text-foreground/85" />
              ) : (
                <Folder className="h-3.5 w-3.5 text-foreground/85" />
              )}
              <input
                ref={renameInputRef}
                value={inlineRename.value}
                onChange={event => setInlineRename(prev => prev ? { ...prev, value: event.target.value } : prev)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void commitInlineRename()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    cancelInlineRename()
                  }
                }}
                onBlur={() => { void commitInlineRename() }}
                className="h-6 flex-1 rounded border border-input bg-background px-1.5 text-xs outline-none focus:border-ring"
                aria-label="Rename folder"
              />
            </div>,
          )
        } else {
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
              onKeyDown={event => {
                if (event.key === 'Enter' && selectedFolderPath === folderPath) {
                  event.preventDefault()
                  event.stopPropagation()
                  beginInlineRename(folderPath, 'folder')
                }
              }}
              onContextMenu={event => openContextMenu(event, folderPath, 'folder')}
              onClick={() => {
                setSelectedFolderPath(folderPath)
                setPendingRename(prev => (
                  prev?.kind === 'folder' && prev.path === folderPath ? prev : null
                ))
                toggleFolder(folderPath)
              }}
              ref={bindRowRef('folder', folderPath)}
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
        }

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
        const isInlineEditing = inlineRename?.kind === 'file' && inlineRename.path === filePath

        if (isInlineEditing) {
          rows.push(
            <div
              key={`file-${filePath}`}
              className={cn(
                'ltm-explorer-row flex w-full items-center gap-2 rounded-md border border-[#c73773]/95 bg-[#c73773] px-2 py-1.5 text-[13px] text-white',
                onDropNode && dropOverPath === filePath && 'ring-2 ring-blue-500/60 bg-blue-500/10',
              )}
              style={{ paddingLeft: `${26 + depth * 14}px` }}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-white" />
              <input
                ref={renameInputRef}
                value={inlineRename.value}
                onChange={event => setInlineRename(prev => prev ? { ...prev, value: event.target.value } : prev)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void commitInlineRename()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    cancelInlineRename()
                  }
                }}
                onBlur={() => { void commitInlineRename() }}
                className="h-6 flex-1 rounded border border-white/45 bg-black/20 px-1.5 text-xs text-white outline-none placeholder:text-white/70 focus:border-white"
                aria-label="Rename file"
              />
            </div>,
          )
        } else {
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
              onKeyDown={event => {
                if (event.key === 'Enter' && selectedFilePath === filePath) {
                  event.preventDefault()
                  event.stopPropagation()
                  beginInlineRename(filePath, 'file')
                }
              }}
              onContextMenu={event => openContextMenu(event, filePath, 'file')}
              onClick={(event) => {
                setSelectedFilePath(filePath)
                setSelectedFolderPath(getParentPath(filePath))
                setPendingRename(prev => (
                  prev?.kind === 'file' && prev.path === filePath ? prev : null
                ))
                onSelectFile?.(filePath)
                if ((event.metaKey || event.ctrlKey) && onOpenInNewTab) {
                  void onOpenInNewTab(filePath)
                  return
                }
                onOpenFile(filePath)
              }}
              ref={bindRowRef('file', filePath)}
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
        }
      })

      return rows
    },
    [
      beginInlineRename,
      bindRowRef,
      cancelInlineRename,
      commitInlineRename,
      dropOverPath,
      getNode,
      inlineRename,
      isExpanded,
      normalizedQuery,
      onDropNode,
      onOpenFile,
      onOpenInNewTab,
      onSelectFile,
      openContextMenu,
      pathMatchesQuery,
      pendingRename,
      selectedFilePath,
      selectedFolderPath,
      toggleFolder,
    ],
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

  const contextMenuStyle = useMemo(() => {
    if (!contextMenu) return undefined
    const menuWidth = 228
    const menuHeight = contextMenu.kind === 'file' ? 420 : 272
    const maxX = Math.max(8, window.innerWidth - menuWidth - 8)
    const maxY = Math.max(8, window.innerHeight - menuHeight - 8)
    return {
      left: `${Math.min(contextMenu.x, maxX)}px`,
      top: `${Math.min(contextMenu.y, maxY)}px`,
    }
  }, [contextMenu])

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
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[90] min-w-[220px] rounded-lg border border-border bg-background/95 p-1 shadow-2xl backdrop-blur-sm"
          style={contextMenuStyle}
          role="menu"
        >
          {(() => {
            const parentPath = contextMenu.kind === 'folder' ? contextMenu.path : getParentPath(contextMenu.path)
            const filePath = contextMenu.path
            const showFileActions = contextMenu.kind === 'file'

            const MenuItem = ({
              label,
              onClick,
              disabled = false,
              destructive = false,
            }: {
              label: string
              onClick: () => void
              disabled?: boolean
              destructive?: boolean
            }) => (
              <button
                type="button"
                className={cn(
                  'flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs',
                  disabled && 'cursor-not-allowed opacity-50',
                  !disabled && !destructive && 'text-foreground hover:bg-muted',
                  !disabled && destructive && 'text-destructive hover:bg-destructive/10',
                )}
                onClick={onClick}
                disabled={disabled}
                role="menuitem"
              >
                {label}
              </button>
            )

            return (
              <>
                <MenuItem
                  label="New Folder"
                  onClick={() => { void runContextAction(onCreateFolder ? () => onCreateFolder(parentPath) : undefined, { refreshPath: parentPath, armRenameOnEnterKind: 'folder' }) }}
                  disabled={!onCreateFolder}
                />
                <MenuItem
                  label="New File"
                  onClick={() => { void runContextAction(onCreateFile ? () => onCreateFile(parentPath) : undefined, { refreshPath: parentPath, armRenameOnEnterKind: 'file' }) }}
                  disabled={!onCreateFile}
                />
                <MenuItem
                  label="New Drawing"
                  onClick={() => { void runContextAction(onCreateDrawing ? () => onCreateDrawing(parentPath) : undefined, { refreshPath: parentPath, armRenameOnEnterKind: 'file' }) }}
                  disabled={!onCreateDrawing}
                />
                <MenuItem
                  label="Copy Absolute Path"
                  onClick={() => { void runContextAction(onCopyAbsolutePath ? () => onCopyAbsolutePath(filePath) : undefined) }}
                  disabled={!onCopyAbsolutePath}
                />
                <MenuItem
                  label="Copy Relative Path"
                  onClick={() => { void runContextAction(onCopyRelativePath ? () => onCopyRelativePath(filePath) : undefined) }}
                  disabled={!onCopyRelativePath}
                />
                <MenuItem
                  label="Rename"
                  onClick={() => {
                    setContextMenu(null)
                    beginInlineRename(filePath, contextMenu.kind)
                  }}
                  disabled={!onRenamePath}
                />
                {showFileActions && (
                  <>
                    <div className="my-1 border-t border-border/70" />
                    <MenuItem
                      label="Open in New Tab"
                      onClick={() => { void runContextAction(onOpenInNewTab ? () => onOpenInNewTab(filePath) : undefined) }}
                      disabled={!onOpenInNewTab}
                    />
                    <MenuItem
                      label="Open in New Window"
                      onClick={() => { void runContextAction(onOpenInNewWindow ? () => onOpenInNewWindow(filePath) : undefined) }}
                      disabled={!onOpenInNewWindow}
                    />
                    <MenuItem
                      label="Duplicate"
                      onClick={() => { void runContextAction(onDuplicateFile ? () => onDuplicateFile(filePath) : undefined, { refresh: true }) }}
                      disabled={!onDuplicateFile}
                    />
                    <MenuItem
                      label="Delete"
                      onClick={() => { void runContextAction(onDeleteFile ? () => onDeleteFile(filePath) : undefined, { refresh: true }) }}
                      disabled={!onDeleteFile}
                      destructive
                    />
                    <MenuItem
                      label="Open in Finder"
                      onClick={() => { void runContextAction(onOpenInFinder ? () => onOpenInFinder(filePath) : undefined) }}
                      disabled={!onOpenInFinder}
                    />
                  </>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
