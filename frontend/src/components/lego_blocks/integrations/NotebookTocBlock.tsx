import { memo, useCallback, useEffect, useState } from 'react'
import { Folder, FileText, File, GripVertical, LayoutGrid, List, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isExcalidrawPathBlock } from '@/services/lego_blocks/units/excalidrawPathBlock'
import { isPdfDocumentPathBlock } from '@/services/lego_blocks/units/pdfDocumentPathBlock'
import { readMarkdownDocument } from '@/services/orchestrators/markdownDocumentsOrch'
import { loadExcalidrawSvgPreviewBlock } from '@/services/lego_blocks/units/excalidrawPreviewBlock'
import type { NotebookEntry } from '@/components/lego_blocks/hooks/shared/useNotebookEntriesBlock'

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

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
  activePagePath: string | null
  onScrollToPage: (path: string) => void
  onSelectPage: (path: string) => void
  onOpenFile: (path: string) => void
  onReorderFiles?: (folderPath: string, orderedPaths: string[]) => void
  viewMode: NotebookTocViewMode
  onViewModeChange: (mode: NotebookTocViewMode) => void
  totalPages: number
}

// ---------------------------------------------------------------------------
// List view (existing TocEntry)
// ---------------------------------------------------------------------------

function TocEntry({
  entry,
  pageCounter,
  activePagePath,
  onSelectPage,
  draggingPath,
  dragOverPath,
  dragOverEdge,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  entry: NotebookEntry
  pageCounter: { value: number }
  activePagePath: string | null
  onSelectPage: (path: string) => void
  draggingPath: string | null
  dragOverPath: string | null
  dragOverEdge: DropEdge | null
  onDragStart: (path: string, event: React.DragEvent) => void
  onDragOver: (path: string, event: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (path: string, event: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const Icon = getEntryIcon(entry)
  const iconColor = getEntryIconColor(entry)

  if (entry.kind === 'folder') {
    return (
      <div className="mt-3 first:mt-0">
        <div className="flex items-center gap-1.5 px-2 py-1">
          <Icon className={cn('h-3.5 w-3.5 shrink-0', iconColor)} />
          <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {entry.name}
          </span>
        </div>
        {entry.children && entry.children.length > 0 && (
          <div className="ml-2 border-l border-border/40 pl-1">
            {entry.children.map((child) => (
              <TocEntry
                key={child.path}
                entry={child}
                pageCounter={pageCounter}
                activePagePath={activePagePath}
                onSelectPage={onSelectPage}
                draggingPath={draggingPath}
                dragOverPath={dragOverPath}
                dragOverEdge={dragOverEdge}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
              />
            ))}
          </div>
        )}
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
      onDragOver={(e) => onDragOver(entry.path, e)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(entry.path, e)}
    >
      <button
        type="button"
        className={cn(
          'group flex w-full items-center gap-1 rounded-md px-1.5 py-1.5 text-left text-xs transition-colors',
          isActive
            ? 'bg-primary/10 text-foreground font-medium'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          isDragging && 'opacity-40',
        )}
        onClick={() => onSelectPage(entry.path)}
        draggable={isMarkdown}
        onDragStart={(e) => onDragStart(entry.path, e)}
        onDragEnd={onDragEnd}
      >
        {isMarkdown && (
          <GripVertical className="h-3 w-3 shrink-0 cursor-grab opacity-0 transition-opacity group-hover:opacity-50 active:cursor-grabbing" />
        )}
        <span className="w-4 shrink-0 text-right text-[10px] tabular-nums opacity-60">
          {pageNum}
        </span>
        <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? iconColor : 'text-muted-foreground/70')} />
        <span className="min-w-0 truncate">{entry.name}</span>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grid thumbnail view
// ---------------------------------------------------------------------------

function GridThumbnail({ entry, pageNumber, isActive, onClick }: {
  entry: NotebookEntry
  pageNumber: number
  isActive: boolean
  onClick: () => void
}) {
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
        // Extract a meaningful title + first lines for preview
        const lines = text.trim().split('\n').filter((l) => l.trim().length > 0)
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
  }, [entry.path, entry.name])

  return (
    <button
      type="button"
      className={cn(
        'group flex flex-col overflow-hidden rounded-md border transition-all text-left',
        isActive
          ? 'border-primary ring-2 ring-primary/30'
          : 'border-border/50 hover:border-border hover:shadow-sm',
      )}
      onClick={onClick}
    >
      {/* Thumbnail area */}
      <div className="aspect-[4/3] w-full overflow-hidden bg-background">
        {loaded ? thumbnail : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-3 w-3 animate-pulse rounded-full bg-muted-foreground/20" />
          </div>
        )}
      </div>
      {/* Footer: page number + filename */}
      <div className="flex w-full items-center gap-1.5 border-t border-border/30 bg-muted/30 px-1.5 py-1">
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{pageNumber}</span>
        <span className="truncate text-[10px] font-medium text-foreground/80">{entry.name}</span>
      </div>
    </button>
  )
}

function GridView({ entries, activePagePath, onSelectPage }: {
  entries: NotebookEntry[]
  activePagePath: string | null
  onSelectPage: (path: string) => void
}) {
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())

  const toggleFolder = useCallback((path: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  function renderGridEntries(items: NotebookEntry[], pageCounter: { value: number }) {
    const result: React.ReactNode[] = []

    for (const entry of items) {
      if (entry.kind === 'folder') {
        const isCollapsed = collapsedFolders.has(entry.path)
        const childCount = entry.children
          ? entry.children.reduce(function count(n, e): number {
              if (e.kind === 'file') return n + 1
              return e.children ? e.children.reduce(count, n) : n
            }, 0)
          : 0

        result.push(
          <div key={entry.path} className="col-span-2 mt-3 first:mt-0">
            <button
              type="button"
              className="flex w-full items-center gap-1.5 px-1 py-1 text-left"
              onClick={() => toggleFolder(entry.path)}
            >
              {isCollapsed
                ? <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                : <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              }
              <Folder className="h-3 w-3 shrink-0 text-blue-500" />
              <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {entry.name}
              </span>
              <span className="text-[10px] text-muted-foreground/60">{childCount}</span>
            </button>
          </div>,
        )

        if (!isCollapsed && entry.children && entry.children.length > 0) {
          result.push(...renderGridEntries(entry.children, pageCounter))
        }
      } else {
        pageCounter.value += 1
        result.push(
          <GridThumbnail
            key={entry.path}
            entry={entry}
            pageNumber={pageCounter.value}
            isActive={activePagePath === entry.path}
            onClick={() => onSelectPage(entry.path)}
          />,
        )
      }
    }

    return result
  }

  return (
    <div className="grid grid-cols-2 gap-2 px-2 py-2">
      {renderGridEntries(entries, { value: 0 })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main TOC block
// ---------------------------------------------------------------------------

function NotebookTocBlock({
  entries,
  activePagePath,
  onScrollToPage: _onScrollToPage,
  onSelectPage,
  onOpenFile: _onOpenFile,
  onReorderFiles,
  viewMode,
  onViewModeChange,
  totalPages,
}: NotebookTocBlockProps) {
  const [draggingPath, setDraggingPath] = useState<string | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
  const [dragOverEdge, setDragOverEdge] = useState<DropEdge | null>(null)
  const pageCounter = { value: 0 }

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
        if (item.kind === 'folder') {
          if (item.children) {
            const directFiles = item.children.filter((c) => c.kind === 'file').map((c) => c.path)
            if (directFiles.includes(draggingPath!) && directFiles.includes(targetPath)) {
              return directFiles
            }
            const nested = getFilePaths(item.children)
            if (nested) return nested
          }
        }
      }
      return null
    }

    let filePaths = getFilePaths(entries)
    if (!filePaths) {
      const rootFiles = entries.filter((e) => e.kind === 'file').map((e) => e.path)
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

    const ordered = filePaths.filter((p) => p !== draggingPath)
    const targetIdx = ordered.indexOf(targetPath)
    const insertIdx = dragOverEdge === 'before' ? targetIdx : targetIdx + 1
    ordered.splice(insertIdx, 0, draggingPath)

    onReorderFiles(sourceDir, ordered)

    setDraggingPath(null)
    setDragOverPath(null)
    setDragOverEdge(null)
  }, [draggingPath, dragOverEdge, entries, onReorderFiles])

  const handleDragEnd = useCallback(() => {
    setDraggingPath(null)
    setDragOverPath(null)
    setDragOverEdge(null)
  }, [])

  return (
    <nav className="flex h-full min-h-0 flex-col">
      {/* Header with view mode toggle */}
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

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto px-1 py-2">
        {viewMode === 'grid' ? (
          <GridView
            entries={entries}
            activePagePath={activePagePath}
            onSelectPage={onSelectPage}
          />
        ) : (
          entries.map((entry) => (
            <TocEntry
              key={entry.path}
              entry={entry}
              pageCounter={pageCounter}
              activePagePath={activePagePath}
              onSelectPage={onSelectPage}
              draggingPath={draggingPath}
              dragOverPath={dragOverPath}
              dragOverEdge={dragOverEdge}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ))
        )}
      </div>
    </nav>
  )
}

export default memo(NotebookTocBlock)
