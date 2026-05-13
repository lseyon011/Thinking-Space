import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Folder, FileText, File, GripVertical, LayoutGrid, List, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isExcalidrawPathBlock } from '@/services/lego_blocks/units/excalidrawPathBlock'
import { isPdfDocumentPathBlock } from '@/services/lego_blocks/units/pdfDocumentPathBlock'
import { readMarkdownDocument } from '@/services/orchestrators/markdownDocumentsOrch'
import { loadExcalidrawSvgPreviewBlock } from '@/services/lego_blocks/units/excalidrawPreviewBlock'
import type { NotebookEntry } from '@/components/lego_blocks/hooks/shared/useNotebookEntriesBlock'

function getEntryIcon(entry: NotebookEntry) {
  if (entry.kind === 'folder') return Folder
  if (isExcalidrawPathBlock(entry.name)) return File
  if (/\.md$/i.test(entry.name)) return FileText
  if (isPdfDocumentPathBlock(entry.path)) return FileText
  return File
}

function getEntryIconColor(entry: NotebookEntry): string {
  if (entry.kind === 'folder') return 'text-blue-500'
  if (isExcalidrawPathBlock(entry.name)) return 'text-violet-400'
  if (isPdfDocumentPathBlock(entry.path)) return 'text-red-400'
  return 'text-muted-foreground'
}

export type NotebookTocViewMode = 'list' | 'grid'

type DropEdge = 'before' | 'after'

interface NotebookTocBlockProps {
  entries: NotebookEntry[]
  activeEntryPath: string | null
  activePagePath: string | null
  onScrollToPage: (path: string) => void
  onSelectPage: (path: string) => void
  onSelectFolder?: (path: string) => void
  onToggleFolder?: (path: string) => void
  onOpenFile: (path: string) => void
  onReorderFiles?: (folderPath: string, orderedPaths: string[]) => void
  viewMode: NotebookTocViewMode
  onViewModeChange: (mode: NotebookTocViewMode) => void
  totalPages: number
  showHeader?: boolean
  onEntryContextMenu?: (entry: NotebookEntry, event: React.MouseEvent) => void
  onEntryContextMenuRequest?: (entry: NotebookEntry, anchorRect: DOMRect) => void
}

interface TocEntryProps {
  entry: NotebookEntry
  pageCounter: { value: number }
  activeEntryPath: string | null
  activePagePath: string | null
  onSelectPage: (path: string) => void
  onSelectFolder?: (path: string) => void
  onToggleFolder?: (path: string) => void
  draggingPath: string | null
  dragOverPath: string | null
  dragOverEdge: DropEdge | null
  onDragStart: (path: string, event: React.DragEvent) => void
  onDragOver: (path: string, event: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (path: string, event: React.DragEvent) => void
  onDragEnd: () => void
  onEntryContextMenu?: (entry: NotebookEntry, event: React.MouseEvent) => void
  registerEntryButton: (path: string, node: HTMLButtonElement | null) => void
  onEntryKeyDown: (entry: NotebookEntry, event: React.KeyboardEvent<HTMLButtonElement>) => void
  onEntryPointerDown: (entry: NotebookEntry, event: React.PointerEvent<HTMLButtonElement>) => void
  onEntryPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void
  onEntryPointerUp: () => void
  onEntryClickCapture: (event: React.MouseEvent<HTMLButtonElement>) => void
}

function TocEntry({
  entry,
  pageCounter,
  activeEntryPath,
  activePagePath,
  onSelectPage,
  onSelectFolder,
  onToggleFolder,
  draggingPath,
  dragOverPath,
  dragOverEdge,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onEntryContextMenu,
  registerEntryButton,
  onEntryKeyDown,
  onEntryPointerDown,
  onEntryPointerMove,
  onEntryPointerUp,
  onEntryClickCapture,
}: TocEntryProps) {
  const Icon = getEntryIcon(entry)
  const iconColor = getEntryIconColor(entry)
  const isSelected = activeEntryPath === entry.path

  if (entry.kind === 'folder') {
    return (
      <div className="mt-3 first:mt-0">
        <button
          type="button"
          ref={(node) => registerEntryButton(entry.path, node)}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors',
            isSelected
              ? 'bg-primary/10 text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          onClick={() => {
            onSelectFolder?.(entry.path)
            onToggleFolder?.(entry.path)
          }}
          onPointerDown={(event) => onEntryPointerDown(entry, event)}
          onPointerMove={onEntryPointerMove}
          onPointerUp={onEntryPointerUp}
          onPointerCancel={onEntryPointerUp}
          onClickCapture={onEntryClickCapture}
          onContextMenu={onEntryContextMenu ? (event) => onEntryContextMenu(entry, event) : undefined}
          onKeyDown={(event) => onEntryKeyDown(entry, event)}
        >
          <Icon className={cn('h-3.5 w-3.5 shrink-0', iconColor)} />
          <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {entry.name}
          </span>
        </button>
        {entry.children && entry.children.length > 0 ? (
          <div className="ml-2 border-l border-border/40 pl-1">
            {entry.children.map((child) => (
              <TocEntry
                key={child.path}
                entry={child}
                pageCounter={pageCounter}
                activeEntryPath={activeEntryPath}
                activePagePath={activePagePath}
                onSelectPage={onSelectPage}
                onSelectFolder={onSelectFolder}
                onToggleFolder={onToggleFolder}
                draggingPath={draggingPath}
                dragOverPath={dragOverPath}
                dragOverEdge={dragOverEdge}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                onEntryContextMenu={onEntryContextMenu}
                registerEntryButton={registerEntryButton}
                onEntryKeyDown={onEntryKeyDown}
                onEntryPointerDown={onEntryPointerDown}
                onEntryPointerMove={onEntryPointerMove}
                onEntryPointerUp={onEntryPointerUp}
                onEntryClickCapture={onEntryClickCapture}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const pageNum = ++pageCounter.value
  const isActive = activePagePath === entry.path
  const isDragging = draggingPath === entry.path
  const isDropTarget = dragOverPath === entry.path
  const isMarkdown = /\.md$/i.test(entry.name)

  return (
    <div
      className={cn(
        'relative',
        isDropTarget && dragOverEdge === 'before' && 'before:absolute before:left-2 before:right-2 before:top-0 before:h-0.5 before:rounded-full before:bg-primary',
        isDropTarget && dragOverEdge === 'after' && 'after:absolute after:left-2 after:right-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary',
      )}
      onDragOver={(event) => onDragOver(entry.path, event)}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(entry.path, event)}
    >
      <button
        type="button"
        ref={(node) => registerEntryButton(entry.path, node)}
        className={cn(
          'group flex w-full items-center gap-1 rounded-md px-1.5 py-1.5 text-left text-xs transition-colors',
          isActive
            ? 'bg-primary/10 text-foreground font-medium'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          isDragging && 'opacity-40',
        )}
        onClick={() => onSelectPage(entry.path)}
        onPointerDown={(event) => onEntryPointerDown(entry, event)}
        onPointerMove={onEntryPointerMove}
        onPointerUp={onEntryPointerUp}
        onPointerCancel={onEntryPointerUp}
        onClickCapture={onEntryClickCapture}
        onContextMenu={onEntryContextMenu ? (event) => onEntryContextMenu(entry, event) : undefined}
        onKeyDown={(event) => onEntryKeyDown(entry, event)}
        draggable={isMarkdown}
        onDragStart={(event) => onDragStart(entry.path, event)}
        onDragEnd={onDragEnd}
      >
        {isMarkdown ? (
          <GripVertical className="h-3 w-3 shrink-0 cursor-grab opacity-0 transition-opacity group-hover:opacity-50 active:cursor-grabbing" />
        ) : null}
        <span className="w-4 shrink-0 text-right text-[10px] tabular-nums opacity-60">
          {pageNum}
        </span>
        <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? iconColor : 'text-muted-foreground/70')} />
        <span className="min-w-0 truncate">{entry.name}</span>
      </button>
    </div>
  )
}

interface GridThumbnailProps {
  entry: NotebookEntry
  pageNumber: number
  isActive: boolean
  onClick: () => void
  onContextMenu?: (event: React.MouseEvent) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  registerEntryButton: (path: string, node: HTMLButtonElement | null) => void
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void
  onPointerUp: () => void
  onClickCapture: (event: React.MouseEvent<HTMLButtonElement>) => void
}

function GridThumbnail({
  entry,
  pageNumber,
  isActive,
  onClick,
  onContextMenu,
  onKeyDown,
  registerEntryButton,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClickCapture,
}: GridThumbnailProps) {
  const [thumbnail, setThumbnail] = useState<React.ReactNode | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const isExcalidraw = isExcalidrawPathBlock(entry.name)
    const isMarkdown = /\.md$/i.test(entry.name) && !isExcalidraw

    if (isExcalidraw) {
      void loadExcalidrawSvgPreviewBlock(entry.path).then((svg) => {
        if (cancelled) return
        setThumbnail(
          <div
            className="flex h-full w-full items-center justify-center bg-white p-1 dark:bg-zinc-50"
            dangerouslySetInnerHTML={{ __html: svg }}
          />,
        )
        setLoaded(true)
      }).catch(() => { if (!cancelled) setLoaded(true) })
    } else if (isMarkdown) {
      void readMarkdownDocument(entry.path, { includeHash: false }).then((doc) => {
        if (cancelled) return
        let text = doc.content
        if (text.startsWith('---')) {
          const endIdx = text.indexOf('\n---', 3)
          if (endIdx !== -1) text = text.slice(endIdx + 4)
        }
        const lines = text.trim().split('\n').filter((line) => line.trim().length > 0)
        const title = lines[0]?.replace(/^#+\s*/, '') ?? entry.name
        const body = lines.slice(1, 6).join('\n')
        setThumbnail(
          <div className="pointer-events-none flex h-full w-full flex-col overflow-hidden bg-white p-2 dark:bg-zinc-50">
            <div className="mb-0.5 truncate text-[7px] font-bold leading-[9px] text-foreground/80">
              {title}
            </div>
            <div className="flex-1 overflow-hidden text-[5px] leading-[7px] text-foreground/50">
              {body}
            </div>
          </div>,
        )
        setLoaded(true)
      }).catch(() => { if (!cancelled) setLoaded(true) })
    } else {
      const Icon = getEntryIcon(entry)
      const iconColor = getEntryIconColor(entry)
      setThumbnail(
        <div className="flex h-full w-full items-center justify-center bg-white dark:bg-zinc-50">
          <Icon className={cn('h-6 w-6', iconColor)} />
        </div>,
      )
      setLoaded(true)
    }

    return () => { cancelled = true }
  }, [entry.name, entry.path])

  return (
    <button
      type="button"
      ref={(node) => registerEntryButton(entry.path, node)}
      className={cn(
        'group flex flex-col overflow-hidden rounded-md border transition-all text-left',
        isActive
          ? 'border-primary ring-2 ring-primary/30'
          : 'border-border/50 hover:border-border hover:shadow-sm',
      )}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-background">
        {loaded ? thumbnail : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-3 w-3 animate-pulse rounded-full bg-muted-foreground/20" />
          </div>
        )}
      </div>
      <div className="flex w-full items-center gap-1.5 border-t border-border/30 bg-muted/30 px-1.5 py-1">
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{pageNumber}</span>
        <span className="truncate text-[10px] font-medium text-foreground/80">{entry.name}</span>
      </div>
    </button>
  )
}

interface GridViewProps {
  entries: NotebookEntry[]
  activeEntryPath: string | null
  activePagePath: string | null
  onSelectPage: (path: string) => void
  onSelectFolder?: (path: string) => void
  onToggleFolder?: (path: string) => void
  onEntryContextMenu?: (entry: NotebookEntry, event: React.MouseEvent) => void
  registerEntryButton: (path: string, node: HTMLButtonElement | null) => void
  onEntryKeyDown: (entry: NotebookEntry, event: React.KeyboardEvent<HTMLButtonElement>) => void
  onEntryPointerDown: (entry: NotebookEntry, event: React.PointerEvent<HTMLButtonElement>) => void
  onEntryPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void
  onEntryPointerUp: () => void
  onEntryClickCapture: (event: React.MouseEvent<HTMLButtonElement>) => void
}

function GridView({
  entries,
  activeEntryPath,
  activePagePath,
  onSelectPage,
  onSelectFolder,
  onToggleFolder,
  onEntryContextMenu,
  registerEntryButton,
  onEntryKeyDown,
  onEntryPointerDown,
  onEntryPointerMove,
  onEntryPointerUp,
  onEntryClickCapture,
}: GridViewProps) {
  function renderGridEntries(items: NotebookEntry[], pageCounter: { value: number }) {
    const result: React.ReactNode[] = []

    for (const entry of items) {
      if (entry.kind === 'folder') {
        const childCount = entry.children
          ? entry.children.reduce(function count(total, child): number {
              if (child.kind === 'file') return total + 1
              return child.children ? child.children.reduce(count, total) : total
            }, 0)
          : 0

        result.push(
          <div key={entry.path} className="col-span-2 mt-3 first:mt-0">
            <button
              type="button"
              ref={(node) => registerEntryButton(entry.path, node)}
              className={cn(
                'flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left transition-colors',
                activeEntryPath === entry.path
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              onClick={() => {
                onSelectFolder?.(entry.path)
                onToggleFolder?.(entry.path)
              }}
              onPointerDown={(event) => onEntryPointerDown(entry, event)}
              onPointerMove={onEntryPointerMove}
              onPointerUp={onEntryPointerUp}
              onPointerCancel={onEntryPointerUp}
              onClickCapture={onEntryClickCapture}
              onContextMenu={onEntryContextMenu ? (event) => onEntryContextMenu(entry, event) : undefined}
              onKeyDown={(event) => onEntryKeyDown(entry, event)}
            >
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              <Folder className="h-3 w-3 shrink-0 text-blue-500" />
              <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {entry.name}
              </span>
              <span className="text-[10px] text-muted-foreground/60">{childCount}</span>
            </button>
          </div>,
        )

        if (entry.children && entry.children.length > 0) {
          result.push(...renderGridEntries(entry.children, pageCounter))
        }
        continue
      }

      pageCounter.value += 1
      result.push(
        <GridThumbnail
          key={entry.path}
          entry={entry}
          pageNumber={pageCounter.value}
          isActive={activePagePath === entry.path}
          onClick={() => onSelectPage(entry.path)}
          onContextMenu={onEntryContextMenu ? (event) => onEntryContextMenu(entry, event) : undefined}
          onKeyDown={(event) => onEntryKeyDown(entry, event)}
          registerEntryButton={registerEntryButton}
          onPointerDown={(event) => onEntryPointerDown(entry, event)}
          onPointerMove={onEntryPointerMove}
          onPointerUp={onEntryPointerUp}
          onClickCapture={onEntryClickCapture}
        />,
      )
    }

    return result
  }

  return (
    <div className="grid grid-cols-2 gap-2 px-2 py-2">
      {renderGridEntries(entries, { value: 0 })}
    </div>
  )
}

function NotebookTocBlock({
  entries,
  activeEntryPath,
  activePagePath,
  onScrollToPage: _onScrollToPage,
  onSelectPage,
  onSelectFolder,
  onToggleFolder,
  onOpenFile: _onOpenFile,
  onReorderFiles,
  viewMode,
  onViewModeChange,
  totalPages,
  showHeader = true,
  onEntryContextMenu,
  onEntryContextMenuRequest,
}: NotebookTocBlockProps) {
  const [draggingPath, setDraggingPath] = useState<string | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
  const [dragOverEdge, setDragOverEdge] = useState<DropEdge | null>(null)
  const pageCounter = { value: 0 }
  const entryButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTargetRef = useRef<{ entry: NotebookEntry; x: number; y: number } | null>(null)
  const suppressNextClickRef = useRef(false)

  const visibleEntries = useMemo(() => {
    const flat: NotebookEntry[] = []
    function walk(items: NotebookEntry[]) {
      for (const item of items) {
        flat.push(item)
        if (item.children?.length) walk(item.children)
      }
    }
    walk(entries)
    return flat
  }, [entries])

  const registerEntryButton = useCallback((path: string, node: HTMLButtonElement | null) => {
    if (node) entryButtonRefs.current.set(path, node)
    else entryButtonRefs.current.delete(path)
  }, [])

  const focusEntry = useCallback((entry: NotebookEntry | undefined) => {
    if (!entry) return
    entryButtonRefs.current.get(entry.path)?.focus()
    if (entry.kind === 'file') onSelectPage(entry.path)
    else onSelectFolder?.(entry.path)
  }, [onSelectFolder, onSelectPage])

  const openEntryContextMenuFromKeyboard = useCallback((entry: NotebookEntry) => {
    if (!onEntryContextMenuRequest) return
    const rect = entryButtonRefs.current.get(entry.path)?.getBoundingClientRect()
    if (!rect) return
    onEntryContextMenuRequest(entry, rect)
  }, [onEntryContextMenuRequest])

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressTargetRef.current = null
  }, [])

  useEffect(() => () => cancelLongPress(), [cancelLongPress])

  const handleEntryPointerDown = useCallback((entry: NotebookEntry, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
    longPressTargetRef.current = { entry, x: event.clientX, y: event.clientY }
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = window.setTimeout(() => {
      const target = longPressTargetRef.current
      if (!target) return
      suppressNextClickRef.current = true
      openEntryContextMenuFromKeyboard(target.entry)
      cancelLongPress()
    }, 500)
  }, [cancelLongPress, openEntryContextMenuFromKeyboard])

  const handleEntryPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const target = longPressTargetRef.current
    if (!target) return
    const dx = event.clientX - target.x
    const dy = event.clientY - target.y
    if (Math.hypot(dx, dy) > 10) cancelLongPress()
  }, [cancelLongPress])

  const handleEntryClickCapture = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!suppressNextClickRef.current) return
    suppressNextClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const onEntryKeyDown = useCallback((entry: NotebookEntry, event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = visibleEntries.findIndex((item) => item.path === entry.path)

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusEntry(visibleEntries[currentIndex + 1])
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusEntry(visibleEntries[currentIndex - 1])
      return
    }
    if (event.key === 'ArrowRight' && entry.kind === 'folder') {
      event.preventDefault()
      onSelectFolder?.(entry.path)
      onToggleFolder?.(entry.path)
      return
    }
    if (event.key === 'ArrowLeft' && entry.kind === 'folder') {
      event.preventDefault()
      onSelectFolder?.(entry.path)
      onToggleFolder?.(entry.path)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (entry.kind === 'file') onSelectPage(entry.path)
      else {
        onSelectFolder?.(entry.path)
        onToggleFolder?.(entry.path)
      }
      return
    }
    if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
      event.preventDefault()
      openEntryContextMenuFromKeyboard(entry)
    }
  }, [focusEntry, onSelectFolder, onSelectPage, onToggleFolder, openEntryContextMenuFromKeyboard, visibleEntries])

  const handleDragStart = useCallback((path: string, event: React.DragEvent) => {
    setDraggingPath(path)
    event.dataTransfer.setData('text/plain', path)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((path: string, event: React.DragEvent) => {
    if (!draggingPath || draggingPath === path) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDragOverPath(path)
    setDragOverEdge(event.clientY < midY ? 'before' : 'after')
  }, [draggingPath])

  const handleDragLeave = useCallback(() => {
    setDragOverPath(null)
    setDragOverEdge(null)
  }, [])

  const handleDrop = useCallback((targetPath: string, event: React.DragEvent) => {
    event.preventDefault()
    if (!draggingPath || draggingPath === targetPath || !onReorderFiles) {
      setDraggingPath(null)
      setDragOverPath(null)
      setDragOverEdge(null)
      return
    }

    const sourceDir = draggingPath.includes('/') ? draggingPath.slice(0, draggingPath.lastIndexOf('/')) : ''
    const targetDir = targetPath.includes('/') ? targetPath.slice(0, targetPath.lastIndexOf('/')) : ''
    if (sourceDir !== targetDir) {
      setDraggingPath(null)
      setDragOverPath(null)
      setDragOverEdge(null)
      return
    }

    function getFilePaths(items: NotebookEntry[]): string[] | null {
      for (const item of items) {
        if (item.kind === 'folder' && item.children) {
          const directFiles = item.children.filter((child) => child.kind === 'file').map((child) => child.path)
          if (draggingPath && directFiles.includes(draggingPath) && directFiles.includes(targetPath)) {
            return directFiles
          }
          const nested = getFilePaths(item.children)
          if (nested) return nested
        }
      }
      return null
    }

    let filePaths = getFilePaths(entries)
    if (!filePaths) {
      const rootFiles = entries.filter((entry) => entry.kind === 'file').map((entry) => entry.path)
      if (rootFiles.includes(draggingPath) && rootFiles.includes(targetPath)) {
        filePaths = rootFiles
      }
    }

    if (!filePaths) {
      setDraggingPath(null)
      setDragOverPath(null)
      setDragOverEdge(null)
      return
    }

    const ordered = filePaths.filter((path) => path !== draggingPath)
    const targetIdx = ordered.indexOf(targetPath)
    const insertIdx = dragOverEdge === 'before' ? targetIdx : targetIdx + 1
    ordered.splice(insertIdx, 0, draggingPath)
    onReorderFiles(sourceDir, ordered)

    setDraggingPath(null)
    setDragOverPath(null)
    setDragOverEdge(null)
  }, [dragOverEdge, draggingPath, entries, onReorderFiles])

  const handleDragEnd = useCallback(() => {
    setDraggingPath(null)
    setDragOverPath(null)
    setDragOverEdge(null)
  }, [])

  return (
    <nav className="flex h-full min-h-0 flex-col">
      {showHeader ? (
        <div className="flex shrink-0 items-center gap-1 border-b border-border/50 px-2 py-1.5">
          <h3 className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pages
            <span className="ml-1.5 font-normal normal-case tracking-normal opacity-60">{totalPages}</span>
          </h3>
          <button
            type="button"
            className={cn(
              'rounded p-1 transition-colors',
              viewMode === 'grid'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onViewModeChange('grid')}
            title="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={cn(
              'rounded p-1 transition-colors',
              viewMode === 'list'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onViewModeChange('list')}
            title="List view"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className={cn('min-h-0 flex-1 overflow-auto', showHeader ? 'px-1 py-2' : 'px-1.5 py-2')}>
        {viewMode === 'grid' ? (
          <GridView
            entries={entries}
            activeEntryPath={activeEntryPath}
            activePagePath={activePagePath}
            onSelectPage={onSelectPage}
            onSelectFolder={onSelectFolder}
            onToggleFolder={onToggleFolder}
            onEntryContextMenu={onEntryContextMenu}
            registerEntryButton={registerEntryButton}
            onEntryKeyDown={onEntryKeyDown}
            onEntryPointerDown={handleEntryPointerDown}
            onEntryPointerMove={handleEntryPointerMove}
            onEntryPointerUp={cancelLongPress}
            onEntryClickCapture={handleEntryClickCapture}
          />
        ) : (
          entries.map((entry) => (
            <TocEntry
              key={entry.path}
              entry={entry}
              pageCounter={pageCounter}
              activeEntryPath={activeEntryPath}
              activePagePath={activePagePath}
              onSelectPage={onSelectPage}
              onSelectFolder={onSelectFolder}
              onToggleFolder={onToggleFolder}
              draggingPath={draggingPath}
              dragOverPath={dragOverPath}
              dragOverEdge={dragOverEdge}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onEntryContextMenu={onEntryContextMenu}
              registerEntryButton={registerEntryButton}
              onEntryKeyDown={onEntryKeyDown}
              onEntryPointerDown={handleEntryPointerDown}
              onEntryPointerMove={handleEntryPointerMove}
              onEntryPointerUp={cancelLongPress}
              onEntryClickCapture={handleEntryClickCapture}
            />
          ))
        )}
      </div>
    </nav>
  )
}

export default memo(NotebookTocBlock)
