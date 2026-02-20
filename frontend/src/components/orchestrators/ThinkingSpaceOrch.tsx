import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PanelLeft, PanelLeftClose, Sparkles, FileText } from 'lucide-react'
import VaultExplorerBlock from '@/components/lego_blocks/VaultExplorerBlock'
import MarkdownDocumentBlock from '@/components/lego_blocks/MarkdownDocumentBlock'
import ExtensionSlotBlock from '@/components/lego_blocks/ExtensionSlotBlock'
import { useUILayoutBlock } from '@/components/lego_blocks/UILayoutBlock'
import { Button } from '@/components/lego_blocks/ui/button'
import { cn } from '@/lib/utils'
import { listFolderEntries } from '@/services/orchestrators/fileSystemOrch'
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/services/orchestrators/storageOrch'
import {
  shouldCloseDrawerFromSwipeBlock,
  shouldOpenDrawerFromSwipeBlock,
  shouldStartEdgeSwipeOpenBlock,
} from '@/services/lego_blocks/uiGestureBlock'

const FILE_QUERY_PARAM = 'file'

export default function ThinkingSpaceOrch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const inlinePathFromUrl = searchParams.get(FILE_QUERY_PARAM)?.trim() || null
  const { layout } = useUILayoutBlock()
  const [inlinePath, setInlinePath] = useState<string | null>(inlinePathFromUrl)
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false)
  const [explorerCollapsed, setExplorerCollapsed] = useState(
    () => getStorageItem(STORAGE_KEYS.thinkingSpaceExplorerCollapsed) === '1',
  )
  const edgeSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const drawerSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const showInlineSidebar = layout.hasSidebar
  const showCollapsedInlineExplorer = showInlineSidebar && !explorerCollapsed
  const showExplorerTrigger = !showCollapsedInlineExplorer
  const topInset = Math.max(0, Math.round(layout.safeAreaInsets.top))
  const bottomInset = Math.max(0, Math.round(layout.safeAreaInsets.bottom))
  const drawerBottomPadding = Math.max(bottomInset, layout.keyboardVisible ? Math.round(layout.keyboardInset) : 0)

  useEffect(() => {
    if (inlinePathFromUrl === inlinePath) return
    setInlinePath(inlinePathFromUrl)
  }, [inlinePath, inlinePathFromUrl])

  const setInlinePathAndSyncUrl = useCallback((path: string | null) => {
    setInlinePath(path)
    const current = searchParams.get(FILE_QUERY_PARAM)?.trim() || null
    if (current === path) return
    const next = new URLSearchParams(searchParams)
    if (path) {
      next.set(FILE_QUERY_PARAM, path)
    } else {
      next.delete(FILE_QUERY_PARAM)
    }
    setSearchParams(next)
  }, [searchParams, setSearchParams])

  const handleInlineFileOpen = useCallback((path: string) => {
    setInlinePathAndSyncUrl(path)
  }, [setInlinePathAndSyncUrl])

  const handleInlineDocumentClose = useCallback(() => {
    setInlinePathAndSyncUrl(null)
  }, [setInlinePathAndSyncUrl])

  const handleDrawerFileOpen = useCallback((path: string) => {
    setInlinePathAndSyncUrl(path)
    setMobileExplorerOpen(false)
  }, [setInlinePathAndSyncUrl])

  useEffect(() => {
    if (showInlineSidebar) setMobileExplorerOpen(false)
  }, [showInlineSidebar])

  useEffect(() => {
    setStorageItem(STORAGE_KEYS.thinkingSpaceExplorerCollapsed, explorerCollapsed ? '1' : '0')
  }, [explorerCollapsed])

  useEffect(() => {
    if (showInlineSidebar || mobileExplorerOpen) {
      edgeSwipeStartRef.current = null
      return
    }

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
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
  }, [mobileExplorerOpen, showInlineSidebar])

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
      <div className="ltm-shell-segment-header flex h-11 shrink-0 items-center justify-between px-2">
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
          onOpenFile={handleInlineFileOpen}
          title=""
        />
      </div>
      <div className="ltm-shell-segment-footer p-2">
        <ExtensionSlotBlock
          slotId="sidebar-bottom"
          context={{ inlinePath }}
        />
      </div>
    </>
  ), [handleInlineFileOpen, inlinePath])

  const inlineDocumentContent = useMemo(() => {
    if (!inlinePath) return null
    return (
      <MarkdownDocumentBlock
        key={inlinePath}
        path={inlinePath}
        onClose={handleInlineDocumentClose}
        showCloseButton
        className="h-full min-h-0"
      />
    )
  }, [handleInlineDocumentClose, inlinePath])

  return (
    <div className="ltm-thinking-space-shell flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showInlineSidebar && (
          <aside
            className={cn(
              'ltm-thinking-space-explorer-surface min-h-0 shrink-0 overflow-hidden md:flex md:flex-col',
              showCollapsedInlineExplorer
                ? 'w-[clamp(240px,28vw,360px)] opacity-100'
                : 'w-0 opacity-0',
            )}
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

        <section className="ltm-thinking-space-document-stage relative min-h-0 flex-1">
          <Button
            variant="outline"
            size="sm"
            className={`ltm-shell-action ltm-motion-fast ltm-touch-target absolute left-3 top-3 z-20 h-8 ${showExplorerTrigger ? 'inline-flex' : 'hidden'}`}
            onClick={() => {
              if (showInlineSidebar) {
                setExplorerCollapsed(false)
                return
              }
              setMobileExplorerOpen(true)
            }}
          >
            <PanelLeft className="mr-2 h-4 w-4" />
            Explorer
          </Button>
          {inlineDocumentContent ? (
            <div className={cn('h-full min-h-0', showExplorerTrigger && '[&_.ts-md-header]:pl-32')}>
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
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm ltm-animate-fade-in"
            onClick={() => setMobileExplorerOpen(false)}
          />
          <aside
            className="ltm-shell-mobile-drawer ltm-shell-drawer-surface fixed inset-y-0 left-0 z-50 flex flex-col ltm-animate-slide-in-left"
            onTouchStart={handleExplorerDrawerTouchStart}
            onTouchMove={handleExplorerDrawerTouchMove}
            onTouchEnd={handleExplorerDrawerTouchEnd}
            onTouchCancel={handleExplorerDrawerTouchEnd}
          >
            <div
              className="ltm-shell-segment-header flex h-11 shrink-0 items-center justify-between px-2"
              style={topInset ? { paddingTop: `${topInset}px`, height: `${44 + topInset}px` } : undefined}
            >
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
                onOpenFile={handleDrawerFileOpen}
                title=""
              />
            </div>
            <div
              className="ltm-shell-segment-footer p-2"
              style={drawerBottomPadding ? { paddingBottom: `${drawerBottomPadding + 8}px` } : undefined}
            >
              <ExtensionSlotBlock
                slotId="sidebar-bottom"
                context={{ inlinePath }}
              />
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
