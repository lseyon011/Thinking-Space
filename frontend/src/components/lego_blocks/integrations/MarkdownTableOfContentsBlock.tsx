import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, ListTree } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  parseMarkdownTableOfContentsBlock,
  type MarkdownTableOfContentsItemBlock,
} from '@/services/lego_blocks/units/markdownTableOfContentsBlock'
import { assignOutlineLabelsBlock } from '@/services/lego_blocks/units/outlineCounterBlock'

interface MarkdownTableOfContentsBlockProps {
  content: string
  currentLine: number
  compact?: boolean
  onSelectHeading: (heading: MarkdownTableOfContentsItemBlock) => void
}

interface MarkdownTableOfContentsDisplayItemBlock extends MarkdownTableOfContentsItemBlock {
  outlineLabel: string
}

export default function MarkdownTableOfContentsBlock({
  content,
  currentLine,
  compact = false,
  onSelectHeading,
}: MarkdownTableOfContentsBlockProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const activeItemRef = useRef<HTMLButtonElement | null>(null)
  const items = useMemo(() => parseMarkdownTableOfContentsBlock(content), [content])
  const displayItems = useMemo<MarkdownTableOfContentsDisplayItemBlock[]>(() => {
    const labels = assignOutlineLabelsBlock(items.map((item) => item.level))
    return items.map((item, idx) => ({ ...item, outlineLabel: labels[idx] }))
  }, [items])
  const activeItem = useMemo(() => {
    let lastMatch: MarkdownTableOfContentsItemBlock | null = null
    for (const item of items) {
      if (item.line > currentLine) break
      lastMatch = item
    }
    return lastMatch
  }, [currentLine, items])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeItem?.id, open])

  const headingCountLabel = items.length === 1 ? '1 heading' : `${items.length} headings`

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground',
          open && 'bg-muted text-foreground',
          items.length === 0 && 'opacity-55',
        )}
        title={items.length > 0 ? 'Open table of contents' : 'No headings found yet'}
      >
        <ListTree className="h-3.5 w-3.5" />
        <span>Contents</span>
        <span className="rounded bg-background/80 px-1 py-0.5 text-[10px] leading-none text-muted-foreground">
          {items.length}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/70 bg-white shadow-2xl">
          <div className="border-b border-border/50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">Table of Contents</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {items.length > 0
                    ? `${headingCountLabel}${activeItem ? ` • current: ${activeItem.title}` : ''}`
                    : 'Add markdown headings to build an outline.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>

          {items.length > 0 ? (
            <div className={cn('overflow-auto p-2', compact ? 'max-h-[55vh]' : 'max-h-[24rem]')}>
              <div className="flex min-w-max flex-col gap-0.5">
                {displayItems.map((item) => {
                  const isActive = item.id === activeItem?.id
                  return (
                    <button
                      key={item.id}
                      ref={isActive ? activeItemRef : null}
                      type="button"
                      onClick={() => {
                        onSelectHeading(item)
                        setOpen(false)
                      }}
                      className={cn(
                        'group flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                        isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                      )}
                      style={{ paddingLeft: `${0.65 + (item.depth * 0.85)}rem` }}
                      title={`Jump to section ${item.outlineLabel} • line ${item.line}`}
                    >
                      <span className={cn(
                        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border text-[10px] font-semibold',
                        isActive ? 'border-primary/40 bg-background text-primary' : 'border-border/60 bg-background/70 text-muted-foreground',
                      )}>
                        H{Math.min(item.level, 99)}
                      </span>
                      <span className={cn(
                        'h-5 w-px shrink-0 rounded-full',
                        isActive ? 'bg-primary/40' : 'bg-border/50',
                      )} />
                      <span className={cn(
                        'shrink-0 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] leading-none',
                        isActive ? 'text-primary' : 'text-muted-foreground',
                      )}>
                        {item.outlineLabel}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">L{item.line}</span>
                      <ChevronRight className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-transform',
                        isActive && 'translate-x-0.5 text-primary',
                      )} />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              No headings yet. Add `#`, `##`, or deeper heading levels and they will appear here.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
