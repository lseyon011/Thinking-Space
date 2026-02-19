import { useState } from 'react'
import { PanelLeft, PanelLeftClose, Sparkles, FileText } from 'lucide-react'
import VaultExplorerBlock from '@/components/lego_blocks/VaultExplorerBlock'
import MarkdownDocumentBlock from '@/components/lego_blocks/MarkdownDocumentBlock'
import ExtensionSlotBlock from '@/components/lego_blocks/ExtensionSlotBlock'
import { Button } from '@/components/lego_blocks/ui/button'
import { listFolderEntries } from '@/services/orchestrators/fileSystemOrch'

export default function ThinkingSpaceOrch() {
  const [inlinePath, setInlinePath] = useState<string | null>(null)
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false)

  return (
    <div className="ltm-page-shell ltm-shell-xwide">
      <div className="mb-3 flex items-center justify-between gap-3 md:mb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Thinking Space</h1>
          <p className="text-sm text-muted-foreground">
            Browse your vault and open any file fast.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="md:hidden"
          onClick={() => setMobileExplorerOpen(true)}
        >
          <PanelLeft className="mr-2 h-4 w-4" />
          Explorer
        </Button>
      </div>

      <div className="ltm-fill-panel overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur">
        <div className="grid h-full md:grid-cols-[clamp(240px,28vw,360px)_minmax(0,1fr)]">
          <aside className="hidden min-h-0 border-r border-border/60 md:flex md:flex-col">
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

          <section className="relative min-h-[360px] md:min-h-0">
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
      </div>

      {mobileExplorerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileExplorerOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[360px] border-r border-border/70 bg-card shadow-xl">
            <div className="flex h-11 items-center justify-between border-b border-border/60 px-2">
              <span className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Explorer
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMobileExplorerOpen(false)}
                title="Close explorer"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-[calc(100%-2.75rem)]">
              <VaultExplorerBlock
                loadEntries={listFolderEntries}
                onOpenFile={(path) => {
                  setInlinePath(path)
                  setMobileExplorerOpen(false)
                }}
              />
            </div>
            <div className="border-t border-border/60 p-2">
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
