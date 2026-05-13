import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BookOpenText, ChevronLeft, ChevronRight, List, Loader2, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { cn } from '@/lib/utils'
import { splitFrontmatter } from '@/components/lego_blocks/units/MarkdownDocumentContentBlock'
import { readMarkdownDocument } from '@/services/orchestrators/markdownDocumentsOrch'
import {
  splitMarkdownIntoBlocksBlock,
  paginateBlocksByHeightBlock,
  type RuledNotebookPageBlock,
} from '@/services/lego_blocks/units/ruledNotebookPaginationBlock'
import { assignOutlineLabelsBlock } from '@/services/lego_blocks/units/outlineCounterBlock'
import { resolveFrontmatterDatesBlock } from '@/services/lego_blocks/units/frontmatterDatesBlock'

interface RuledNotebookDocumentBlockProps {
  path: string
  onClose?: () => void
  className?: string
  topBarHidden?: boolean
}

type TransitionKind = 'idle' | 'page-over' | 'page-slide'
interface TransitionState {
  kind: Exclude<TransitionKind, 'idle'>
  direction: 'forward' | 'backward'
  fromIndex: number
  toIndex: number
}

const PAGE_TURN_MS = 640
const REMARK_PLUGINS = [remarkGfm]

function leafNameOf(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx < 0 ? path : path.slice(idx + 1)
}

function sideOf(index: number): 'right' | 'left' {
  // Page 1 (index 0) is the cover/right page. Even indices → right, odd → left.
  return index % 2 === 0 ? 'right' : 'left'
}

interface PageFaceProps {
  page: RuledNotebookPageBlock | null
  index: number
  title: string
  className?: string
  /* Optional date jotted into the page-1 left margin (the column to the left of the red rule). */
  marginDate?: string | null
}

function PageFace({ page, index, title, className, marginDate }: PageFaceProps) {
  const side = sideOf(index)
  if (!page) return null
  return (
    <div
      className={cn(
        'ltm-ruled-notebook-page-frame',
        side === 'right' ? 'ltm-ruled-notebook-page-right' : 'ltm-ruled-notebook-page-left',
        className,
      )}
    >
      <div className="ltm-ruled-notebook-page-meta">
        <span>{title}</span>
        <span>Page {index + 1}</span>
      </div>
      <div className="ltm-ruled-notebook-paper">
        {marginDate ? (
          <div className="ltm-ruled-notebook-margin-date" aria-label={`Created ${marginDate}`}>
            {marginDate}
          </div>
        ) : null}
        <div className="ltm-ruled-notebook-content">
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{page.source}</ReactMarkdown>
        </div>
      </div>
      <div className="ltm-ruled-notebook-footer">
        <span>{side}</span>
        <span>{index + 1}</span>
      </div>
    </div>
  )
}

export default function RuledNotebookDocumentBlock({
  path,
  onClose,
  className,
  topBarHidden = false,
}: RuledNotebookDocumentBlockProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [transition, setTransition] = useState<TransitionState | null>(null)
  const [pages, setPages] = useState<RuledNotebookPageBlock[]>([])
  const [tocOpen, setTocOpen] = useState(false)
  const [createdSeconds, setCreatedSeconds] = useState<number | null>(null)

  const paperMeasureRef = useRef<HTMLDivElement | null>(null)
  const blocksMeasureRef = useRef<HTMLDivElement | null>(null)

  const pageTitle = useMemo(() => leafNameOf(path).replace(/\.md$/i, ''), [path])

  /* Created date, jotted in the left-hand margin of page 1 — same way a kid would
     write the date at the top-left of their notebook. Prefer YAML frontmatter
     (`created_at`/`created`/…) so iCloud-mirrored ctime collisions don't matter. */
  const createdLabel = useMemo(() => {
    if (content === null) return null
    const { created } = resolveFrontmatterDatesBlock(content, { ctimeSeconds: createdSeconds })
    if (!created) return null
    return created.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  }, [content, createdSeconds])

  const blocks = useMemo(() => {
    if (content === null) return []
    const { body } = splitFrontmatter(content)
    return splitMarkdownIntoBlocksBlock(body)
  }, [content])

  useLayoutEffect(() => {
    if (blocks.length === 0) {
      setPages([{ index: 0, source: '', blocks: [] }])
      return
    }
    const paperEl = paperMeasureRef.current
    const blocksEl = blocksMeasureRef.current
    if (!paperEl || !blocksEl) return

    const compute = () => {
      const paperPx = paperEl.clientHeight
      if (!paperPx) return
      const contentStyle = window.getComputedStyle(blocksEl)
      const lineHeightPx = parseFloat(contentStyle.lineHeight || '0') || 0
      // Keep pagination slightly conservative so subpixel line boxes and
      // font-rendering differences do not push the final live lines below the
      // paper's clipping edge.
      const pageBudgetPx = Math.max(0, paperPx - Math.max(4, Math.round(lineHeightPx * 0.35)))
      const blockEls = Array.from(blocksEl.children) as HTMLElement[]
      const heights = blockEls.map((el) => {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        const marginBottom = parseFloat(style.marginBottom || '0') || 0
        return rect.height + marginBottom
      })
      setPages(paginateBlocksByHeightBlock(blocks, heights, pageBudgetPx))
    }

    compute()
    const ro = new ResizeObserver(() => compute())
    ro.observe(paperEl)
    ro.observe(blocksEl)
    return () => ro.disconnect()
  }, [blocks])

  // Walk paginated blocks to extract headings + the page each one lives on.
  const tocItems = useMemo(() => {
    const items: Array<{ id: string; title: string; level: number; pageIndex: number; label: string }> = []
    pages.forEach((page, pIdx) => {
      page.blocks.forEach((block, bIdx) => {
        if (block.kind !== 'heading') return
        const match = block.source.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/m)
        if (!match) return
        const level = match[1].length
        const title = match[2].trim()
        if (!title) return
        items.push({ id: `${pIdx}-${bIdx}-${level}-${title.toLowerCase()}`, title, level, pageIndex: pIdx, label: '' })
      })
    })
    const labels = assignOutlineLabelsBlock(items.map((item) => item.level))
    return items.map((item, idx) => ({ ...item, label: labels[idx] }))
  }, [pages])

  const currentPage = pages[pageIndex] ?? null
  const hasPrev = pageIndex > 0
  const hasNext = pageIndex < pages.length - 1
  const currentSide = sideOf(pageIndex)

  const transitionKind: TransitionKind = transition?.kind ?? 'idle'
  const transitionDirection = transition?.direction ?? 'forward'
  const outgoingPage = transition ? pages[transition.fromIndex] ?? null : null
  const peekIndex = hasNext ? pageIndex + 1 : null
  const peekPage = peekIndex !== null ? pages[peekIndex] ?? null : null

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setPageIndex(0)
    setTransition(null)

    const load = async () => {
      try {
        const document = await readMarkdownDocument(path, { includeHash: false })
        if (!cancelled) {
          setContent(document.content)
          setCreatedSeconds(document.ctime ?? null)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load markdown file.')
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [path])

  useEffect(() => {
    if (!onClose) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  /* While the ruled notebook is on screen, suppress chrome from any
     Excalidraw canvases mounted in background tabs (iPad/mobile-mode Excalidraw
     renders a fixed bottom toolbar that bleeds through when its tab isn't the
     active one). Scoped to a body class so it only affects this view. */
  useEffect(() => {
    document.body.classList.add('ltm-ruled-notebook-active')
    return () => document.body.classList.remove('ltm-ruled-notebook-active')
  }, [])

  useEffect(() => {
    if (!transition) return
    const timeout = window.setTimeout(() => setTransition(null), PAGE_TURN_MS)
    return () => window.clearTimeout(timeout)
  }, [transition])

  const handleMovePage = useCallback(
    (direction: 'forward' | 'backward') => {
      setPageIndex((current) => {
        const next = direction === 'forward' ? current + 1 : current - 1
        if (next < 0 || next >= pages.length) return current
        // Page-over flip: forward from a right page (even) or backward from a left page (odd) —
        // both turn the same physical sheet over its spine. Otherwise slide to next sheet.
        const kind: Exclude<TransitionKind, 'idle'> =
          (direction === 'forward' && current % 2 === 0)
          || (direction === 'backward' && current % 2 === 1)
            ? 'page-over'
            : 'page-slide'
        setTransition({ kind, direction, fromIndex: current, toIndex: next })
        return next
      })
    },
    [pages.length],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault()
        handleMovePage('forward')
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        handleMovePage('backward')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleMovePage])

  if (loading) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading ruled notebook…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('flex h-full items-center justify-center p-6', className)}>
        <div className="max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  return (
    <section className={cn('ltm-ruled-notebook-shell flex h-full min-h-0 flex-col', className)}>
      {!topBarHidden && (
        <header className="relative flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <BookOpenText className="h-4 w-4" />
              <span>Ruled Notebook</span>
            </div>
            <h2 className="truncate pt-1 text-base font-semibold text-foreground">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {pageIndex + 1} / {Math.max(pages.length, 1)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTocOpen((open) => !open)}
              title="Contents"
              disabled={tocItems.length === 0}
              aria-expanded={tocOpen}
            >
              <List className="h-4 w-4" />
            </Button>
            {onClose ? (
              <Button variant="ghost" size="icon" onClick={onClose} title="Close ruled notebook">
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <div
            className="ltm-ruled-notebook-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={Math.max(pages.length, 1)}
            aria-valuenow={pageIndex + 1}
          >
            <div
              className="ltm-ruled-notebook-progress-fill"
              style={{
                width: `${Math.min(100, ((pageIndex + 1) / Math.max(pages.length, 1)) * 100)}%`,
              }}
            />
          </div>
        </header>
      )}

      {tocOpen && tocItems.length > 0 ? (
        <>
          <button
            type="button"
            aria-label="Close contents"
            className="ltm-ruled-notebook-toc-overlay"
            onClick={() => setTocOpen(false)}
          />
          <aside className="ltm-ruled-notebook-toc-panel" role="dialog" aria-label="Contents">
            <div className="ltm-ruled-notebook-toc-header">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Contents</span>
              <Button variant="ghost" size="icon" onClick={() => setTocOpen(false)} title="Close contents">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ul className="ltm-ruled-notebook-toc-list">
              {tocItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      'ltm-ruled-notebook-toc-item',
                      item.pageIndex === pageIndex && 'ltm-ruled-notebook-toc-item-active',
                    )}
                    style={{ paddingLeft: `${12 + (item.level - 1) * 14}px` }}
                    onClick={() => {
                      setPageIndex(item.pageIndex)
                      setTransition(null)
                      setTocOpen(false)
                    }}
                  >
                    <span className="ltm-ruled-notebook-toc-item-label">{item.label}</span>
                    <span className="ltm-ruled-notebook-toc-item-title">{item.title}</span>
                    <span className="ltm-ruled-notebook-toc-item-page">{item.pageIndex + 1}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={() => handleMovePage('backward')} disabled={!hasPrev}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <div className="text-center text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {currentSide === 'right' ? 'Right Page' : 'Left Page'}
            </div>
            <Button variant="outline" size="sm" onClick={() => handleMovePage('forward')} disabled={!hasNext}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <div className="ltm-ruled-notebook-stage">
            <div className="ltm-ruled-notebook-stack">
              {/* Peek: a slim strip of the next page poking out from the right edge */}
              {peekPage ? (
                <div
                  aria-hidden="true"
                  className={cn(
                    'ltm-ruled-notebook-page-peek',
                    transitionKind === 'page-slide' && transitionDirection === 'forward' && 'ltm-ruled-notebook-page-peek-shift',
                  )}
                />
              ) : null}

              {/* Outgoing layer during slide */}
              {transitionKind === 'page-slide' && outgoingPage ? (
                <PageFace
                  page={outgoingPage}
                  index={transition?.fromIndex ?? pageIndex}
                  title={pageTitle}
                  marginDate={(transition?.fromIndex ?? pageIndex) === 0 ? createdLabel : null}
                  className={cn(
                    'ltm-ruled-notebook-page-layer ltm-ruled-notebook-page-layer-outgoing',
                    transitionDirection === 'forward'
                      ? 'ltm-ruled-notebook-animate-slide-out-forward'
                      : 'ltm-ruled-notebook-animate-slide-out-backward',
                  )}
                />
              ) : null}

              {/* Current page */}
              <PageFace
                page={currentPage}
                index={pageIndex}
                title={pageTitle}
                marginDate={pageIndex === 0 ? createdLabel : null}
                className={cn(
                  'ltm-ruled-notebook-page-layer ltm-ruled-notebook-page-layer-current',
                  transitionKind === 'page-slide' && transitionDirection === 'forward' && 'ltm-ruled-notebook-animate-slide-in-forward',
                  transitionKind === 'page-slide' && transitionDirection === 'backward' && 'ltm-ruled-notebook-animate-slide-in-backward',
                )}
              />

              {/* Turning page on top during page-over: outgoing page flips, revealing the new page beneath */}
              {transitionKind === 'page-over' && outgoingPage ? (
                <PageFace
                  page={outgoingPage}
                  index={transition?.fromIndex ?? pageIndex}
                  title={pageTitle}
                  marginDate={(transition?.fromIndex ?? pageIndex) === 0 ? createdLabel : null}
                  className={cn(
                    'ltm-ruled-notebook-page-layer ltm-ruled-notebook-page-layer-turning',
                    transitionDirection === 'forward'
                      ? 'ltm-ruled-notebook-animate-page-over'
                      : 'ltm-ruled-notebook-animate-page-over-reverse',
                  )}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden measurement layer — same width as the live page so block heights line up. */}
      <div aria-hidden="true" className="ltm-ruled-notebook-measure-host">
        <div className="ltm-ruled-notebook-page-frame ltm-ruled-notebook-page-right">
          <div className="ltm-ruled-notebook-page-meta">
            <span>&nbsp;</span>
            <span>Page 0</span>
          </div>
          <div className="ltm-ruled-notebook-paper" ref={paperMeasureRef}>
            <div className="ltm-ruled-notebook-content" ref={blocksMeasureRef}>
              {blocks.map((block, idx) => (
                <div key={idx} className="ltm-ruled-notebook-measure-block">
                  <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{block.source}</ReactMarkdown>
                </div>
              ))}
            </div>
          </div>
          <div className="ltm-ruled-notebook-footer">
            <span>right</span>
            <span>0</span>
          </div>
        </div>
      </div>
    </section>
  )
}
