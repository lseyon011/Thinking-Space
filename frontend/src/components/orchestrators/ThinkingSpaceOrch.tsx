import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PanelLeft, PanelLeftClose, Sparkles, FileText } from 'lucide-react'
import VaultExplorerBlock from '@/components/lego_blocks/integrations/VaultExplorerBlock'
import MarkdownDocumentBlock, { type MarkdownViewerMode } from '@/components/lego_blocks/integrations/MarkdownDocumentBlock'
import { useUILayoutBlock } from '@/components/lego_blocks/hooks/shared/useUILayoutBlock'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { cn } from '@/lib/utils'
import {
  createDrawingOrch,
  createFileOrch,
  createFolderOrch,
  deleteVaultPathOrch,
  duplicateFileOrch,
  getAbsolutePathForClipboardOrch,
  getRelativePathForClipboardOrch,
  listFolderEntries,
  openFileInNewTabOrch,
  openFileInNewWindowOrch,
  renameVaultPathOrch,
  revealVaultPathOrch,
} from '@/services/orchestrators/fileSystemOrch'
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/services/orchestrators/storageOrch'
import {
  shouldCloseDrawerFromSwipeBlock,
  shouldIgnoreEdgeSwipeFromTargetBlock,
  shouldOpenDrawerFromSwipeBlock,
  shouldStartEdgeSwipeOpenBlock,
} from '@/services/lego_blocks/units/uiGestureBlock'

const FILE_QUERY_PARAM = 'file'
const MAX_MOUNTED_INLINE_DOCS = 8
const EXPLORER_DEFAULT_WIDTH_PX = 320
const EXPLORER_MIN_WIDTH_PX = 220

function leafNameOf(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx < 0 ? path : path.slice(idx + 1)
}

function clampExplorerWidthPx(value: number): number {
  if (!Number.isFinite(value)) return EXPLORER_DEFAULT_WIDTH_PX
  return Math.max(EXPLORER_MIN_WIDTH_PX, value)
}

export default function ThinkingSpaceOrch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const inlinePathFromUrl = searchParams.get(FILE_QUERY_PARAM)?.trim() || null
  const { layout } = useUILayoutBlock()
  const [inlinePath, setInlinePath] = useState<string | null>(inlinePathFromUrl)
  const [mountedInlinePaths, setMountedInlinePaths] = useState<string[]>(
    () => (inlinePathFromUrl ? [inlinePathFromUrl] : []),
  )
  const [inlineInitialModeByPath, setInlineInitialModeByPath] = useState<Record<string, MarkdownViewerMode>>(
    () => (inlinePathFromUrl ? { [inlinePathFromUrl]: 'view' } : {}),
  )
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false)
  const [isExplorerResizing, setIsExplorerResizing] = useState(false)
  const [explorerCollapsed, setExplorerCollapsed] = useState(
    () => getStorageItem(STORAGE_KEYS.thinkingSpaceExplorerCollapsed) === '1',
  )
  const [explorerWidthPx, setExplorerWidthPx] = useState(() => {
    const raw = getStorageItem(STORAGE_KEYS.thinkingSpaceExplorerWidthPx)
    if (!raw) return EXPLORER_DEFAULT_WIDTH_PX
    const parsed = Number.parseInt(raw, 10)
    return clampExplorerWidthPx(parsed)
  })
  const edgeSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const drawerSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const explorerResizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const forceCompactForIosKeyboard = layout.surface === 'capacitor-ios' && layout.keyboardVisible
  const showInlineSidebar = layout.hasSidebar && !forceCompactForIosKeyboard
  const showCollapsedInlineExplorer = showInlineSidebar && !explorerCollapsed
  const showExplorerTrigger = !showCollapsedInlineExplorer
  const isIosSurface = layout.surface === 'capacitor-ios'
  const headerOffsetClass = showExplorerTrigger
    ? (isIosSurface
      ? '[&_.ts-md-header]:pl-16 sm:[&_.ts-md-header]:pl-20'
      : '[&_.ts-md-header]:pl-28 sm:[&_.ts-md-header]:pl-44')
    : ''

  const rememberMountedInlinePath = useCallback((path: string, initialMode: MarkdownViewerMode) => {
    setMountedInlinePaths((prev) => {
      if (prev.includes(path)) return prev
      const next = [...prev, path]
      return next.length > MAX_MOUNTED_INLINE_DOCS ? next.slice(1) : next
    })
    setInlineInitialModeByPath((prev) => (prev[path] ? prev : { ...prev, [path]: initialMode }))
  }, [])

  const removeMountedInlinePath = useCallback((path: string) => {
    setMountedInlinePaths((prev) => prev.filter((item) => item !== path))
    setInlineInitialModeByPath((prev) => {
      if (!(path in prev)) return prev
      const next = { ...prev }
      delete next[path]
      return next
    })
  }, [])

  const replaceMountedInlinePath = useCallback((fromPath: string, toPath: string) => {
    setMountedInlinePaths((prev) => {
      let changed = false
      const replaced = prev.map((item) => {
        if (item !== fromPath) return item
        changed = true
        return toPath
      })
      if (!changed) return prev
      const deduped: string[] = []
      for (const item of replaced) {
        if (!deduped.includes(item)) deduped.push(item)
      }
      return deduped
    })
    setInlineInitialModeByPath((prev) => {
      if (!(fromPath in prev)) return prev
      if (toPath in prev) {
        const next = { ...prev }
        delete next[fromPath]
        return next
      }
      const next = { ...prev, [toPath]: prev[fromPath] }
      delete next[fromPath]
      return next
    })
  }, [])

  useEffect(() => {
    setInlineInitialModeByPath((prev) => {
      const mounted = new Set(mountedInlinePaths)
      let changed = false
      const next: Record<string, MarkdownViewerMode> = {}
      for (const [path, mode] of Object.entries(prev)) {
        if (!mounted.has(path)) {
          changed = true
          continue
        }
        next[path] = mode
      }
      return changed ? next : prev
    })
  }, [mountedInlinePaths])

  useEffect(() => {
    if (inlinePathFromUrl === inlinePath) return
    setInlinePath(inlinePathFromUrl)
    if (inlinePathFromUrl) {
      rememberMountedInlinePath(inlinePathFromUrl, 'view')
    }
  }, [inlinePath, inlinePathFromUrl, rememberMountedInlinePath])

  const setInlinePathAndSyncUrl = useCallback((path: string | null, mode: MarkdownViewerMode = 'view') => {
    if (path) {
      rememberMountedInlinePath(path, mode)
    }
    setInlinePath(path)
    setSearchParams((prev) => {
      const current = prev.get(FILE_QUERY_PARAM)?.trim() || null
      if (current === path) return prev
      const next = new URLSearchParams(prev)
      if (path) {
        next.set(FILE_QUERY_PARAM, path)
      } else {
        next.delete(FILE_QUERY_PARAM)
      }
      return next
    }, { replace: true })
  }, [rememberMountedInlinePath, setSearchParams])

  const handleInlineDocumentClose = useCallback(() => {
    setInlinePathAndSyncUrl(null)
    setMountedInlinePaths([])
    setInlineInitialModeByPath({})
  }, [setInlinePathAndSyncUrl])

  const handleInlineOpenPath = useCallback((nextPath: string) => {
    setInlinePathAndSyncUrl(nextPath)
  }, [setInlinePathAndSyncUrl])

  const handleInlineOpenPathForEdit = useCallback((nextPath: string) => {
    setInlinePathAndSyncUrl(nextPath, 'edit')
  }, [setInlinePathAndSyncUrl])

  const handleDrawerFileOpen = useCallback((path: string) => {
    setInlinePathAndSyncUrl(path)
    setMobileExplorerOpen(false)
  }, [setInlinePathAndSyncUrl])

  const copyToClipboard = useCallback(async (value: string): Promise<boolean> => {
    if (!value.trim()) return false
    await navigator.clipboard.writeText(value)
    return true
  }, [])

  const handleExplorerCreateFolder = useCallback(async (parentPath: string): Promise<string> => {
    // Avoid prompt dependency in Electron; create then rename inline.
    return createFolderOrch(parentPath, 'New Folder')
  }, [])

  const handleExplorerCreateFile = useCallback(async (parentPath: string): Promise<string> => {
    const outputPath = await createFileOrch(parentPath, 'New File.md')
    setInlinePathAndSyncUrl(outputPath, 'edit')
    return outputPath
  }, [setInlinePathAndSyncUrl])

  const handleExplorerCreateCsvFile = useCallback(async (parentPath: string): Promise<string> => {
    const outputPath = await createFileOrch(parentPath, 'New Table.csv')
    setInlinePathAndSyncUrl(outputPath, 'edit')
    return outputPath
  }, [setInlinePathAndSyncUrl])

  const handleExplorerCreateDrawing = useCallback(async (parentPath: string): Promise<string | boolean> => {
    // Avoid window.prompt() — not supported in Capacitor WebView.
    // Create with default name; user can rename inline like folders.
    const outputPath = await createDrawingOrch(parentPath, 'New Drawing.excalidraw.md')
    setInlinePathAndSyncUrl(outputPath)
    return outputPath
  }, [setInlinePathAndSyncUrl])

  const handleExplorerCopyRelativePath = useCallback(async (path: string): Promise<boolean> => {
    return copyToClipboard(getRelativePathForClipboardOrch(path))
  }, [copyToClipboard])

  const handleExplorerCopyAbsolutePath = useCallback(async (path: string): Promise<boolean> => {
    const absolute = getAbsolutePathForClipboardOrch(path)
    if (!absolute) {
      throw new Error('Absolute path is unavailable for this runtime.')
    }
    return copyToClipboard(absolute)
  }, [copyToClipboard])

  const handleExplorerOpenInNewTab = useCallback((path: string): boolean => {
    openFileInNewTabOrch(path)
    return true
  }, [])

  const handleExplorerOpenInNewWindow = useCallback((path: string): boolean => {
    openFileInNewWindowOrch(path)
    return true
  }, [])

  const handleExplorerDuplicateFile = useCallback(async (path: string): Promise<boolean> => {
    const duplicatePath = await duplicateFileOrch(path)
    setInlinePathAndSyncUrl(duplicatePath)
    return true
  }, [setInlinePathAndSyncUrl])

  const handleExplorerRenamePath = useCallback(async (
    path: string,
    kind: 'file' | 'folder',
    nextName: string,
  ): Promise<string> => {
    const nextPath = await renameVaultPathOrch(path, nextName)
    if (kind === 'file') {
      replaceMountedInlinePath(path, nextPath)
    }
    if (kind === 'file' && inlinePath === path) {
      setInlinePathAndSyncUrl(nextPath)
    }
    return nextPath
  }, [inlinePath, replaceMountedInlinePath, setInlinePathAndSyncUrl])

  const handleExplorerDeleteFile = useCallback(async (path: string): Promise<boolean> => {
    const confirmed = window.confirm(`Delete file "${leafNameOf(path)}"?`)
    if (!confirmed) return false
    await deleteVaultPathOrch(path)
    removeMountedInlinePath(path)
    if (inlinePath === path) {
      setInlinePathAndSyncUrl(null)
    }
    return true
  }, [inlinePath, removeMountedInlinePath, setInlinePathAndSyncUrl])

  const handleExplorerOpenInFinder = useCallback(async (path: string): Promise<boolean> => {
    await revealVaultPathOrch(path)
    return true
  }, [])

  const handleExplorerResizeMove = useCallback((event: PointerEvent) => {
    const state = explorerResizeRef.current
    if (!state) return
    const deltaX = event.clientX - state.startX
    const nextWidth = clampExplorerWidthPx(state.startWidth + deltaX)
    setExplorerWidthPx(nextWidth)
  }, [])

  const stopExplorerResize = useCallback(() => {
    explorerResizeRef.current = null
    setIsExplorerResizing(false)
    window.removeEventListener('pointermove', handleExplorerResizeMove)
    window.removeEventListener('pointerup', stopExplorerResize)
    window.removeEventListener('pointercancel', stopExplorerResize)
    document.body.style.removeProperty('user-select')
    document.body.style.removeProperty('cursor')
  }, [handleExplorerResizeMove])

  const handleExplorerResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!showCollapsedInlineExplorer) return
    event.preventDefault()
    setIsExplorerResizing(true)
    explorerResizeRef.current = { startX: event.clientX, startWidth: explorerWidthPx }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    window.addEventListener('pointermove', handleExplorerResizeMove)
    window.addEventListener('pointerup', stopExplorerResize)
    window.addEventListener('pointercancel', stopExplorerResize)
  }, [explorerWidthPx, handleExplorerResizeMove, showCollapsedInlineExplorer, stopExplorerResize])

  const handleExplorerResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const step = event.shiftKey ? 32 : 16
    const delta = event.key === 'ArrowLeft' ? -step : step
    setExplorerWidthPx((prev) => clampExplorerWidthPx(prev + delta))
  }, [])

  useEffect(() => {
    if (showInlineSidebar) setMobileExplorerOpen(false)
  }, [showInlineSidebar])

  useEffect(() => {
    if (layout.keyboardVisible) {
      setMobileExplorerOpen(false)
    }
  }, [layout.keyboardVisible])

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.thinkingSpaceExplorerCollapsed, explorerCollapsed ? '1' : '0')
  }, [explorerCollapsed])

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.thinkingSpaceExplorerWidthPx, String(explorerWidthPx))
  }, [explorerWidthPx])

  useEffect(() => {
    const handleResize = () => {
      setExplorerWidthPx((prev) => clampExplorerWidthPx(prev))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    return () => {
      stopExplorerResize()
    }
  }, [stopExplorerResize])

  useEffect(() => {
    if (showInlineSidebar || mobileExplorerOpen || layout.keyboardVisible) {
      edgeSwipeStartRef.current = null
      return
    }

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      if (shouldIgnoreEdgeSwipeFromTargetBlock(event.target)) {
        edgeSwipeStartRef.current = null
        return
      }
      if (!shouldStartEdgeSwipeOpenBlock(touch.clientX)) return
      edgeSwipeStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchMove = (event: TouchEvent) => {
      const start = edgeSwipeStartRef.current
      if (!start) return
      const touch = event.touches[0]
      if (!touch) return
      if (shouldOpenDrawerFromSwipeBlock(touch.clientX - start.x, touch.clientY - start.y)) {
        edgeSwipeStartRef.current = null
        setMobileExplorerOpen(true)
      }
    }

    const clearGesture = () => {
      edgeSwipeStartRef.current = null
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', clearGesture)
    window.addEventListener('touchcancel', clearGesture)

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', clearGesture)
      window.removeEventListener('touchcancel', clearGesture)
    }
  }, [layout.keyboardVisible, mobileExplorerOpen, showInlineSidebar])

  const handleExplorerDrawerTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    if (!touch) return
    drawerSwipeStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleExplorerDrawerTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    const start = drawerSwipeStartRef.current
    if (!start) return
    const touch = event.touches[0]
    if (!touch) return
    if (shouldCloseDrawerFromSwipeBlock(touch.clientX - start.x, touch.clientY - start.y)) {
      drawerSwipeStartRef.current = null
      setMobileExplorerOpen(false)
    }
  }

  const handleExplorerDrawerTouchEnd = () => {
    drawerSwipeStartRef.current = null
  }

  const inlineExplorerContent = useMemo(() => (
    <>
      <div className="ltm-shell-segment-header ltm-thinking-space-explorer-chrome flex h-11 shrink-0 items-center justify-between px-2">
        <span className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Thinking Space Explorer
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="ltm-touch-target h-8 w-8"
          title="Collapse explorer"
          onClick={() => setExplorerCollapsed(true)}
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <VaultExplorerBlock
          loadEntries={listFolderEntries}
          selectedPath={inlinePath}
          listenToGlobalSyncRefresh
          onOpenFile={setInlinePathAndSyncUrl}
          onCreateFolder={handleExplorerCreateFolder}
          onCreateFile={handleExplorerCreateFile}
          onCreateCsvFile={handleExplorerCreateCsvFile}
          onCreateDrawing={handleExplorerCreateDrawing}
          onCopyRelativePath={handleExplorerCopyRelativePath}
          onCopyAbsolutePath={handleExplorerCopyAbsolutePath}
          onOpenInNewTab={handleExplorerOpenInNewTab}
          onOpenInNewWindow={handleExplorerOpenInNewWindow}
          onDuplicateFile={handleExplorerDuplicateFile}
          onRenamePath={handleExplorerRenamePath}
          onDeleteFile={handleExplorerDeleteFile}
          onOpenInFinder={handleExplorerOpenInFinder}
          title=""
        />
      </div>
    </>
  ), [handleExplorerCreateCsvFile, inlinePath, setInlinePathAndSyncUrl])

  const inlineDocumentContent = useMemo(() => {
    if (mountedInlinePaths.length === 0) return null
    return mountedInlinePaths.map((path) => (
      <section
        key={path}
        hidden={inlinePath !== path}
        aria-hidden={inlinePath !== path}
        className="h-full min-h-0"
      >
        <MarkdownDocumentBlock
          path={path}
          initialMode={inlineInitialModeByPath[path] ?? 'view'}
          onOpenPath={handleInlineOpenPath}
          onOpenPathForEdit={handleInlineOpenPathForEdit}
          onClose={handleInlineDocumentClose}
          showCloseButton
          className="h-full min-h-0"
        />
      </section>
    ))
  }, [
    handleInlineDocumentClose,
    handleInlineOpenPath,
    handleInlineOpenPathForEdit,
    inlineInitialModeByPath,
    inlinePath,
    mountedInlinePaths,
  ])

  return (
    <div
      className="ltm-thinking-space-shell flex h-full min-h-0 flex-col overflow-hidden"
      data-ltm-explorer-open={showCollapsedInlineExplorer ? 'true' : 'false'}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showInlineSidebar && (
          <aside
            className={cn(
              'ltm-thinking-space-explorer-surface min-h-0 shrink-0 overflow-hidden md:flex md:flex-col',
              isExplorerResizing ? 'transition-none' : 'transition-[width,opacity] duration-200 ease-out',
              showCollapsedInlineExplorer
                ? 'opacity-100'
                : 'opacity-0',
            )}
            style={{ width: showCollapsedInlineExplorer ? `${explorerWidthPx}px` : '0px' }}
            data-ltm-nav-region="explorer"
          >
            <div
              className={cn('flex h-full min-h-0 flex-col', !showCollapsedInlineExplorer && 'pointer-events-none')}
              aria-hidden={!showCollapsedInlineExplorer}
            >
              {inlineExplorerContent}
            </div>
          </aside>
        )}

        {showInlineSidebar && showCollapsedInlineExplorer && (
          <div
            role="separator"
            aria-label="Resize explorer"
            aria-orientation="vertical"
            tabIndex={0}
            onPointerDown={handleExplorerResizeStart}
            onDoubleClick={() => setExplorerWidthPx(EXPLORER_DEFAULT_WIDTH_PX)}
            onKeyDown={handleExplorerResizeKeyDown}
            className="ltm-thinking-space-explorer-resizer group relative hidden w-2 shrink-0 cursor-col-resize items-stretch md:flex"
          >
            <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/70 transition-colors group-hover:bg-primary/70 group-focus-visible:bg-primary/80" />
          </div>
        )}

        <section className="ltm-thinking-space-document-stage relative min-h-0 flex-1">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'ltm-shell-action ltm-motion-fast ltm-touch-target absolute left-3 top-3 z-20 h-11 items-center gap-1.5',
              isIosSurface ? 'w-11 justify-center px-0' : 'px-3',
              showExplorerTrigger ? 'inline-flex' : 'hidden',
            )}
            title="Open explorer"
            aria-label="Open explorer"
            onClick={() => {
              if (showInlineSidebar) {
                setExplorerCollapsed(false)
                return
              }
              setMobileExplorerOpen(true)
            }}
          >
            <PanelLeft className="h-4 w-4" />
            {!isIosSurface && <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Explorer</span>}
          </Button>
          {inlinePath && inlineDocumentContent ? (
            <div className={cn('h-full min-h-0', headerOffsetClass)}>
              {inlineDocumentContent}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-5 py-10 text-center md:px-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background">
                <FileText className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight">Open a File to Start</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Pick a file from the explorer. It opens inline here using the same markdown
                viewer/editor component used in side popup flows.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Obsidian-style sidebar flow, tuned for responsiveness
              </div>
            </div>
          )}
        </section>
      </div>

      {!showInlineSidebar && mobileExplorerOpen && (
        <>
          <div
            className="ltm-shell-motion-overlay fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileExplorerOpen(false)}
          />
          <aside
            className="ltm-mobile-drawer ltm-shell-mobile-drawer ltm-shell-drawer-surface ltm-shell-motion-drawer fixed inset-y-0 left-0 z-50 flex flex-col"
            onTouchStart={handleExplorerDrawerTouchStart}
            onTouchMove={handleExplorerDrawerTouchMove}
            onTouchEnd={handleExplorerDrawerTouchEnd}
            onTouchCancel={handleExplorerDrawerTouchEnd}
          >
            <div className="ltm-shell-segment-header ltm-thinking-space-explorer-chrome flex h-11 shrink-0 items-center justify-between px-2">
              <span className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Explorer
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="ltm-touch-target h-8 w-8"
                onClick={() => setMobileExplorerOpen(false)}
                title="Close explorer"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <VaultExplorerBlock
                loadEntries={listFolderEntries}
                selectedPath={inlinePath}
                listenToGlobalSyncRefresh
                onOpenFile={handleDrawerFileOpen}
                onCreateFolder={handleExplorerCreateFolder}
                onCreateFile={handleExplorerCreateFile}
                onCreateCsvFile={handleExplorerCreateCsvFile}
                onCreateDrawing={handleExplorerCreateDrawing}
                onCopyRelativePath={handleExplorerCopyRelativePath}
                onCopyAbsolutePath={handleExplorerCopyAbsolutePath}
                onOpenInNewTab={handleExplorerOpenInNewTab}
                onOpenInNewWindow={handleExplorerOpenInNewWindow}
                onDuplicateFile={handleExplorerDuplicateFile}
                onRenamePath={handleExplorerRenamePath}
                onDeleteFile={handleExplorerDeleteFile}
                onOpenInFinder={handleExplorerOpenInFinder}
                title=""
              />
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
