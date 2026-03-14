import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PanelLeft, PanelLeftClose, FileText, Rss as RssIcon } from 'lucide-react'
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
  moveVaultPathOrch,
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
import {
  dispatchThinkingSpaceGoogleWorkspaceChromeStateBlock,
  THINKING_SPACE_GOOGLE_WORKSPACE_TOGGLE_EXPLORER_EVENT_BLOCK,
  THINKING_SPACE_GOOGLE_WORKSPACE_TOGGLE_HEADER_EVENT_BLOCK,
} from '@/services/lego_blocks/units/thinkingSpaceGoogleWorkspaceChromeBlock'
import { dispatchGlobalSyncRefreshBlock } from '@/services/lego_blocks/units/globalSyncRefreshBlock'
import { createUrlShortcutOrch } from '@/services/orchestrators/urlShortcutOrch'
import { getNodeByPath } from '@/services/lego_blocks/integrations/dbBlock'
import RssFeedPanelBlock from '@/components/lego_blocks/integrations/RssFeedPanelBlock'
import RssArticleViewBlock from '@/components/lego_blocks/integrations/RssArticleViewBlock'
import UrlDocumentBlock from '@/components/lego_blocks/integrations/UrlDocumentBlock'
import type { RssFeedItemBlock } from '@/services/lego_blocks/units/rssFeedBlock'

function dispatchFileOpRefresh(): void {
  dispatchGlobalSyncRefreshBlock({
    source: 'unknown',
    requestedAt: Date.now(),
    vaultSyncAttempted: false,
    vaultSyncSucceeded: false,
  })
}

const FILE_QUERY_PARAM = 'file'
const MAX_MOUNTED_INLINE_DOCS = 8
const EXPLORER_DEFAULT_WIDTH_PX = 320
const EXPLORER_MIN_WIDTH_PX = 220

function leafNameOf(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx < 0 ? path : path.slice(idx + 1)
}

function remapPathAfterMove(path: string, sourcePath: string, targetPath: string): string {
  if (path === sourcePath) return targetPath
  if (!path.startsWith(`${sourcePath}/`)) return path
  const suffix = path.slice(sourcePath.length + 1)
  return suffix ? `${targetPath}/${suffix}` : targetPath
}

function isSameOrChildPath(path: string, candidateParent: string): boolean {
  if (!candidateParent) return true
  return path === candidateParent || path.startsWith(`${candidateParent}/`)
}

function clampExplorerWidthPx(value: number): number {
  if (!Number.isFinite(value)) return EXPLORER_DEFAULT_WIDTH_PX
  return Math.max(EXPLORER_MIN_WIDTH_PX, value)
}

function isGoogleWorkspacePathBlock(path: string | null): boolean {
  if (!path) return false
  return /\.(gdoc|gdoc\.json|gsheet|gsheet\.json)$/i.test(path)
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
  const [rssPanelOpen, setRssPanelOpen] = useState(false)
  const [browserUrl, setBrowserUrl] = useState<string | null>(null)
  const [rssActiveArticle, setRssActiveArticle] = useState<{
    item: RssFeedItemBlock
    onItemUpdate: (updated: RssFeedItemBlock) => void
    onItemRemove: () => void
    presetTags: string[]
    tagColors: Record<string, string>
  } | null>(null)
  const [linkPromptOpen, setLinkPromptOpen] = useState(false)
  const linkPromptResolveRef = useRef<((url: string | null) => void) | null>(null)
  const [isExplorerResizing, setIsExplorerResizing] = useState(false)
  const [focusedHeaderVisible, setFocusedHeaderVisible] = useState(false)
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
  const isGoogleWorkspaceInlinePath = isGoogleWorkspacePathBlock(inlinePath)
  const useInstantExplorerToggle = showInlineSidebar && isGoogleWorkspaceInlinePath
  const focusedDocumentMode = showInlineSidebar && showExplorerTrigger

  const hideDocumentHeaderInFocusedMode = focusedDocumentMode && !focusedHeaderVisible
  const isIosSurface = layout.surface === 'capacitor-ios'
  const [rssUrlBarVisible, setRssUrlBarVisible] = useState(!isIosSurface)
  const headerOffsetClass = showExplorerTrigger && !hideDocumentHeaderInFocusedMode
    ? (isIosSurface
      ? '[&_.ts-doc-header]:pl-20 sm:[&_.ts-doc-header]:pl-24'
      : '[&_.ts-doc-header]:pl-40 sm:[&_.ts-doc-header]:pl-44')
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
      setBrowserUrl(null) // clear browser URL when opening a file
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
    const outputPath = await createFolderOrch(parentPath, 'New Folder')
    dispatchFileOpRefresh()
    return outputPath
  }, [])

  const handleExplorerCreateFile = useCallback(async (parentPath: string): Promise<string> => {
    const outputPath = await createFileOrch(parentPath, 'New File.md')
    setInlinePathAndSyncUrl(outputPath, 'edit')
    dispatchFileOpRefresh()
    return outputPath
  }, [setInlinePathAndSyncUrl])

  const handleExplorerCreateCsvFile = useCallback(async (parentPath: string): Promise<string> => {
    const outputPath = await createFileOrch(parentPath, 'New Table.csv')
    setInlinePathAndSyncUrl(outputPath, 'edit')
    dispatchFileOpRefresh()
    return outputPath
  }, [setInlinePathAndSyncUrl])

  const handleExplorerCreateDrawing = useCallback(async (parentPath: string): Promise<string | boolean> => {
    // Avoid window.prompt() — not supported in Capacitor WebView.
    // Create with default name; user can rename inline like folders.
    const outputPath = await createDrawingOrch(parentPath, 'New Drawing.excalidraw.md')
    setInlinePathAndSyncUrl(outputPath)
    dispatchFileOpRefresh()
    return outputPath
  }, [setInlinePathAndSyncUrl])

  const handleExplorerCreateLink = useCallback(async (parentPath: string): Promise<string | boolean> => {
    const url = await new Promise<string | null>((resolve) => {
      linkPromptResolveRef.current = resolve
      setLinkPromptOpen(true)
    })
    setLinkPromptOpen(false)
    if (!url?.trim()) return false
    const outputPath = await createUrlShortcutOrch(parentPath, url.trim())
    setInlinePathAndSyncUrl(outputPath)
    dispatchFileOpRefresh()
    return outputPath
  }, [setInlinePathAndSyncUrl])

  const handleRssOpenArticle = useCallback((
    item: RssFeedItemBlock,
    onItemUpdate: (updated: RssFeedItemBlock) => void,
    onItemRemove: () => void,
    presetTags: string[],
    tagColors: Record<string, string>,
  ) => {
    setRssActiveArticle({ item, onItemUpdate, onItemRemove, presetTags, tagColors })
    setRssUrlBarVisible(!isIosSurface)
    setBrowserUrl(null)
    setMobileExplorerOpen(false)
  }, [])

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
    dispatchFileOpRefresh()
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
    dispatchFileOpRefresh()
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
    dispatchFileOpRefresh()
    return true
  }, [inlinePath, removeMountedInlinePath, setInlinePathAndSyncUrl])

  const handleExplorerDeleteFolder = useCallback(async (path: string): Promise<boolean> => {
    const confirmed = window.confirm(`Delete folder "${leafNameOf(path)}" and all its contents?`)
    if (!confirmed) return false
    await deleteVaultPathOrch(path)
    dispatchFileOpRefresh()
    setMountedInlinePaths((prev) => prev.filter((item) => !isSameOrChildPath(item, path)))
    setInlineInitialModeByPath((prev) => {
      let changed = false
      const next: Record<string, MarkdownViewerMode> = {}
      for (const [itemPath, mode] of Object.entries(prev)) {
        if (isSameOrChildPath(itemPath, path)) {
          changed = true
          continue
        }
        next[itemPath] = mode
      }
      return changed ? next : prev
    })
    if (inlinePath && isSameOrChildPath(inlinePath, path)) {
      setInlinePathAndSyncUrl(null)
    }
    return true
  }, [inlinePath, setInlinePathAndSyncUrl])

  const handleExplorerOpenInFinder = useCallback(async (path: string): Promise<boolean> => {
    await revealVaultPathOrch(path)
    return true
  }, [])

  const handleExplorerLoadFileTags = useCallback(async (path: string): Promise<string[]> => {
    const node = await getNodeByPath(path)
    return node?.tags ?? []
  }, [])

  const handleExplorerMovePath = useCallback(async (
    sourcePath: string,
    sourceKind: 'file' | 'folder',
    targetFolderPath: string,
  ): Promise<string> => {
    const nextPath = await moveVaultPathOrch(sourcePath, targetFolderPath)
    if (nextPath === sourcePath) return sourcePath

    setMountedInlinePaths((prev) => {
      const remapped = prev.map(path => remapPathAfterMove(path, sourcePath, nextPath))
      const deduped: string[] = []
      for (const path of remapped) {
        if (!deduped.includes(path)) deduped.push(path)
      }
      return deduped
    })
    setInlineInitialModeByPath((prev) => {
      const next: Record<string, MarkdownViewerMode> = {}
      for (const [path, mode] of Object.entries(prev)) {
        const remappedPath = remapPathAfterMove(path, sourcePath, nextPath)
        if (!(remappedPath in next)) next[remappedPath] = mode
      }
      return next
    })

    if (inlinePath) {
      const remappedInlinePath = remapPathAfterMove(inlinePath, sourcePath, nextPath)
      if (remappedInlinePath !== inlinePath) {
        setInlinePathAndSyncUrl(remappedInlinePath)
      }
    }

    // Preserve existing file-only behavior while also supporting folder moves.
    if (sourceKind === 'file') return nextPath
    return nextPath
  }, [inlinePath, setInlinePathAndSyncUrl])

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
    if (!focusedDocumentMode) {
      setFocusedHeaderVisible(true)
      return
    }
    setFocusedHeaderVisible(false)
  }, [focusedDocumentMode])

  useEffect(() => {
    // On iOS, explorer is driven by mobileExplorerOpen (drawer), not explorerCollapsed
    const explorerCollapsedForChrome = isIosSurface ? !mobileExplorerOpen : explorerCollapsed

    if (rssActiveArticle) {
      dispatchThinkingSpaceGoogleWorkspaceChromeStateBlock({
        enabled: true,
        explorerCollapsed: explorerCollapsedForChrome,
        headerVisible: rssUrlBarVisible,
        showHeaderToggle: true,
      })
      return
    }
    if (isIosSurface) {
      // Always show explorer toggle in top chrome on iOS
      dispatchThinkingSpaceGoogleWorkspaceChromeStateBlock({
        enabled: true,
        explorerCollapsed: explorerCollapsedForChrome,
        headerVisible: true,
        showHeaderToggle: false,
      })
      return
    }
    const headerVisible = !hideDocumentHeaderInFocusedMode
    dispatchThinkingSpaceGoogleWorkspaceChromeStateBlock({
      enabled: focusedDocumentMode,
      explorerCollapsed,
      headerVisible,
      showHeaderToggle: focusedDocumentMode && Boolean(inlinePath),
    })
  }, [explorerCollapsed, hideDocumentHeaderInFocusedMode, focusedDocumentMode, inlinePath, rssActiveArticle, rssUrlBarVisible, isIosSurface, mobileExplorerOpen])

  useEffect(() => {
    return () => {
      dispatchThinkingSpaceGoogleWorkspaceChromeStateBlock({
        enabled: false,
        explorerCollapsed: false,
        headerVisible: true,
        showHeaderToggle: false,
      })
    }
  }, [])

  useEffect(() => {
    const onToggleExplorer = () => {
      if (showInlineSidebar) {
        setExplorerCollapsed(prev => !prev)
        return
      }
      setMobileExplorerOpen(prev => !prev)
    }
    const onToggleHeader = () => {
      if (rssActiveArticle) {
        setRssUrlBarVisible(prev => !prev)
        return
      }
      if (!focusedDocumentMode) return
      setFocusedHeaderVisible(prev => !prev)
    }

    window.addEventListener(THINKING_SPACE_GOOGLE_WORKSPACE_TOGGLE_EXPLORER_EVENT_BLOCK, onToggleExplorer as EventListener)
    window.addEventListener(THINKING_SPACE_GOOGLE_WORKSPACE_TOGGLE_HEADER_EVENT_BLOCK, onToggleHeader as EventListener)
    return () => {
      window.removeEventListener(THINKING_SPACE_GOOGLE_WORKSPACE_TOGGLE_EXPLORER_EVENT_BLOCK, onToggleExplorer as EventListener)
      window.removeEventListener(THINKING_SPACE_GOOGLE_WORKSPACE_TOGGLE_HEADER_EVENT_BLOCK, onToggleHeader as EventListener)
    }
  }, [focusedDocumentMode, showInlineSidebar, rssActiveArticle])

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
      {rssPanelOpen ? (
        <div className="min-h-0 flex-1">
          <RssFeedPanelBlock
            onOpenArticle={handleRssOpenArticle}
            onClose={() => setRssPanelOpen(false)}
          />
        </div>
      ) : (
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
            onCreateLink={handleExplorerCreateLink}
            onCopyRelativePath={handleExplorerCopyRelativePath}
            onCopyAbsolutePath={handleExplorerCopyAbsolutePath}
            onOpenInNewTab={handleExplorerOpenInNewTab}
            onOpenInNewWindow={handleExplorerOpenInNewWindow}
            onDuplicateFile={handleExplorerDuplicateFile}
            onRenamePath={handleExplorerRenamePath}
            onDeleteFile={handleExplorerDeleteFile}
            onDeleteFolder={handleExplorerDeleteFolder}
            onOpenInFinder={handleExplorerOpenInFinder}
            loadFileTags={handleExplorerLoadFileTags}
            onMovePath={handleExplorerMovePath}
            draggableFiles
            draggableFolders
            title=""
          />
        </div>
      )}
      <div className="shrink-0 border-t border-border/50 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setRssPanelOpen(prev => !prev)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
            rssPanelOpen
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted/70',
          )}
        >
          <RssIcon className="h-3.5 w-3.5" />
          RSS Feeds
        </button>
      </div>
    </>
  ), [handleExplorerCreateCsvFile, inlinePath, rssPanelOpen, setInlinePathAndSyncUrl])

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
              (isExplorerResizing || useInstantExplorerToggle)
                ? 'transition-none'
                : 'transition-[width,opacity] duration-200 ease-out',
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
            <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent" />
          </div>
        )}

        <section className="ltm-thinking-space-document-stage relative min-h-0 flex-1">
          {/* Explorer trigger — only for mobile/compact (desktop uses the top chrome button) */}
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'ltm-shell-action ltm-motion-fast ltm-touch-target absolute left-6 top-6 z-20 h-11 items-center gap-1.5',
              isIosSurface ? 'w-11 justify-center px-0' : 'px-3',
              showExplorerTrigger && !showInlineSidebar && !isIosSurface ? 'inline-flex' : 'hidden',
            )}
            title="Open explorer"
            aria-label="Open explorer"
            onClick={() => setMobileExplorerOpen(true)}
          >
            <PanelLeft className="h-4 w-4" />
            {!isIosSurface && <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Explorer</span>}
          </Button>
          {rssActiveArticle ? (
            <div className="h-full min-h-0">
              <RssArticleViewBlock
                key={rssActiveArticle.item.id}
                item={rssActiveArticle.item}
                onClose={() => setRssActiveArticle(null)}
                onItemUpdate={(updated) => {
                  setRssActiveArticle(prev => prev ? { ...prev, item: updated } : null)
                  rssActiveArticle.onItemUpdate(updated)
                }}
                onMoved={(newPath) => {
                  rssActiveArticle.onItemRemove()
                  setRssActiveArticle(null)
                  setInlinePathAndSyncUrl(newPath)
                }}
                presetTags={rssActiveArticle.presetTags}
                tagColors={rssActiveArticle.tagColors}
                suspended={mobileExplorerOpen}
                hideUrlBar={!rssUrlBarVisible}
              />
            </div>
          ) : browserUrl ? (
            <div className="h-full min-h-0">
              <UrlDocumentBlock
                url={browserUrl}
                onClose={() => setBrowserUrl(null)}
                showCloseButton
              />
            </div>
          ) : inlinePath && inlineDocumentContent ? (
            <div className={cn(
              'h-full min-h-0',
              headerOffsetClass,
              hideDocumentHeaderInFocusedMode && '[&_.ts-doc-header]:hidden',
            )}>
              {inlineDocumentContent}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-5 py-10 text-center md:px-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background">
                <FileText className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight">Open a File to Start</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Pick a file from the explorer.
              </p>
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
            {rssPanelOpen ? (
              <div className="min-h-0 flex-1">
                <RssFeedPanelBlock
                  onOpenArticle={handleRssOpenArticle}
                  onClose={() => setRssPanelOpen(false)}
                />
              </div>
            ) : (
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
                  onCreateLink={handleExplorerCreateLink}
                  onCopyRelativePath={handleExplorerCopyRelativePath}
                  onCopyAbsolutePath={handleExplorerCopyAbsolutePath}
                  onOpenInNewTab={handleExplorerOpenInNewTab}
                  onOpenInNewWindow={handleExplorerOpenInNewWindow}
                  onDuplicateFile={handleExplorerDuplicateFile}
                  onRenamePath={handleExplorerRenamePath}
                  onDeleteFile={handleExplorerDeleteFile}
                  onDeleteFolder={handleExplorerDeleteFolder}
                  onOpenInFinder={handleExplorerOpenInFinder}
                  onMovePath={handleExplorerMovePath}
                  draggableFiles
                  draggableFolders
                  title=""
                />
              </div>
            )}
            <div className="shrink-0 border-t border-border/50 px-2 py-1.5">
              <button
                type="button"
                onClick={() => setRssPanelOpen(prev => !prev)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                  rssPanelOpen
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/70',
                )}
              >
                <RssIcon className="h-3.5 w-3.5" />
                RSS Feeds
              </button>
            </div>
          </aside>
        </>
      )}
      {linkPromptOpen && (
        <LinkUrlPromptOverlay
          onSubmit={(url) => { linkPromptResolveRef.current?.(url); linkPromptResolveRef.current = null }}
          onCancel={() => { linkPromptResolveRef.current?.(null); linkPromptResolveRef.current = null }}
        />
      )}
    </div>
  )
}

function LinkUrlPromptOverlay({
  onSubmit,
  onCancel,
}: {
  onSubmit: (url: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
    else onCancel()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-xl border border-border bg-background p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-sm font-medium">Add Link</p>
        <input
          ref={inputRef}
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
            if (e.key === 'Escape') { e.preventDefault(); onCancel() }
          }}
          placeholder="https://example.com"
          className="mb-3 h-9 w-full rounded-md border border-input bg-muted/40 px-3 text-sm outline-none focus:border-ring"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
