import { useEffect, useRef, useState } from 'react'
import { PanelLeft, PanelLeftClose, Sparkles, FileText } from 'lucide-react'
import VaultExplorerBlock from '@/components/lego_blocks/VaultExplorerBlock'
import MarkdownDocumentBlock from '@/components/lego_blocks/MarkdownDocumentBlock'
import ExtensionSlotBlock from '@/components/lego_blocks/ExtensionSlotBlock'
import { useUILayoutBlock } from '@/components/lego_blocks/UILayoutBlock'
import { Button } from '@/components/lego_blocks/ui/button'
import { listFolderEntries } from '@/services/orchestrators/fileSystemOrch'
import {
  shouldCloseDrawerFromSwipeBlock,
  shouldOpenDrawerFromSwipeBlock,
  shouldStartEdgeSwipeOpenBlock,
} from '@/services/lego_blocks/uiGestureBlock'

export default function ThinkingSpaceOrch() {
  const { layout } = useUILayoutBlock()
  const [inlinePath, setInlinePath] = useState<string | null>(null)
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false)
  const edgeSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const drawerSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const showInlineSidebar = layout.hasSidebar
  const iosSurface = layout.surface === 'capacitor-ios'
  const topInset = Math.max(0, Math.round(layout.safeAreaInsets.top))
  const bottomInset = Math.max(0, Math.round(layout.safeAreaInsets.bottom))
  const drawerBottomPadding = Math.max(bottomInset, layout.keyboardVisible ? Math.round(layout.keyboardInset) : 0)

  useEffect(() => {
    if (showInlineSidebar) setMobileExplorerOpen(false)
  }, [showInlineSidebar])

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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className={`grid min-h-0 flex-1 overflow-hidden ${showInlineSidebar ? 'grid-cols-[clamp(240px,28vw,360px)_minmax(0,1fr)]' : 'grid-cols-1'}`}>
        {showInlineSidebar && (
          <aside className="min-h-0 border-r border-border/60 bg-card/20 md:flex md:flex-col">
            <div className="min-h-0 flex-1">
              <VaultExplorerBlock
                loadEntries={listFolderEntries}
                onOpenFile={(path) => setInlinePath(path)}
              />
            </div>
            <div className="border-t border-border/60 p-2">
              <ExtensionSlotBlock
                slotId="sidebar-bottom"
                context={{ inlinePath }}
              />
            </div>
          </aside>
        )}

        <section className="relative min-h-0 bg-background">
          <Button
            variant="outline"
            size="sm"
            className={`ltm-motion-fast ltm-touch-target absolute left-3 top-3 z-20 h-8 ${showInlineSidebar ? 'hidden' : 'inline-flex'}`}
            onClick={() => setMobileExplorerOpen(true)}
          >
            <PanelLeft className="mr-2 h-4 w-4" />
            Explorer
          </Button>
          {inlinePath ? (
            <MarkdownDocumentBlock
              path={inlinePath}
              onClose={() => setInlinePath(null)}
              showCloseButton
              className="h-full"
            />
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
            className={`fixed inset-0 z-40 ltm-animate-fade-in ${
              iosSurface ? 'bg-background/55 backdrop-blur-md' : 'bg-background/70 backdrop-blur-sm'
            }`}
            onClick={() => setMobileExplorerOpen(false)}
          />
          <aside
            className={`fixed inset-y-0 left-0 z-50 flex w-[84vw] max-w-[420px] flex-col border-r border-border/70 ltm-animate-slide-in-left shadow-xl ${
              iosSurface ? 'bg-background/88 backdrop-blur-xl' : 'bg-card'
            }`}
            onTouchStart={handleExplorerDrawerTouchStart}
            onTouchMove={handleExplorerDrawerTouchMove}
            onTouchEnd={handleExplorerDrawerTouchEnd}
            onTouchCancel={handleExplorerDrawerTouchEnd}
          >
            <div
              className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 px-2"
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
                onOpenFile={(path) => {
                  setInlinePath(path)
                  setMobileExplorerOpen(false)
                }}
              />
            </div>
            <div
              className="border-t border-border/60 p-2"
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
