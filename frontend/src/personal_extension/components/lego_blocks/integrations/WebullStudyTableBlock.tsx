import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronRight, FileText, MessageSquareText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  WebullStudyCategoryOrch,
  WebullStudyRowOrch,
} from '../../../services/orchestrators/webullStudyOrch'
import type { WebullStudyCommentBlock } from '../../../services/lego_blocks/units/webullStudyRecordBlock'

interface WebullStudyTableBlockProps {
  rows: WebullStudyRowOrch[]
  activeTicker: string | null
  onSelectTicker: (ticker: string) => void
  onOpenStudyFile: (filePath: string) => void
}

const CATEGORY_LABEL_BLOCK: Record<WebullStudyCategoryOrch, string> = {
  'in-range': 'In range',
  'approaching': 'Approaching',
  'above-range': 'Above range',
  'below-range': 'Below range',
  'restudy-soon': 'Restudy soon',
  'stale': 'Stale',
  'too-hard': 'Too hard',
  'no-range': 'No range',
  'no-study': 'No study yet',
}

const CATEGORY_TONE_BLOCK: Record<WebullStudyCategoryOrch, string> = {
  'in-range': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  'approaching': 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  'above-range': 'bg-muted text-muted-foreground border-border',
  'below-range': 'bg-muted text-muted-foreground border-border',
  'restudy-soon': 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  'stale': 'bg-destructive/15 text-destructive border-destructive/30',
  'too-hard': 'bg-muted/60 text-muted-foreground border-border',
  'no-range': 'bg-muted/60 text-muted-foreground border-border',
  'no-study': 'bg-muted/60 text-muted-foreground border-border',
}

function formatMoneyBlock(value: number | null, opts?: { sign?: boolean }): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const formatted = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (opts?.sign && value > 0) return `+$${formatted}`
  if (value < 0) return `-$${formatted}`
  return `$${formatted}`
}

function formatPctBlock(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value).toFixed(1)
  if (value > 0) return `+${abs}%`
  if (value < 0) return `-${abs}%`
  return '0.0%'
}

function deltaToneBlock(category: WebullStudyCategoryOrch): string {
  switch (category) {
    case 'in-range':
      return 'text-emerald-700 dark:text-emerald-300 font-medium'
    case 'approaching':
    case 'restudy-soon':
      return 'text-amber-700 dark:text-amber-300'
    case 'stale':
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}

function formatValidThroughBlock(row: WebullStudyRowOrch): string {
  if (!row.record?.validThrough) return '—'
  const days = row.daysToValidThrough
  if (days === null) return row.record.validThrough
  if (days < 0) return `${row.record.validThrough} (${Math.abs(days)}d past)`
  return `${row.record.validThrough} (${days}d)`
}

// Pick the comment to surface inline: the most recent dated one, else the last
// entry in the section (study files append newest comments at the bottom).
function pickHighlightCommentBlock(
  comments: WebullStudyCommentBlock[],
): WebullStudyCommentBlock | null {
  if (comments.length === 0) return null
  const dated = comments.filter((c) => c.date)
  if (dated.length > 0) {
    return dated.reduce((latest, c) => (c.date! > latest.date! ? c : latest))
  }
  return comments[comments.length - 1]
}

function HeldBadgeBlock({ row }: { row: WebullStudyRowOrch }) {
  if (!row.held) {
    return <span className="text-xs text-muted-foreground">No</span>
  }
  if (row.heldStock) {
    return (
      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        Stock
      </span>
    )
  }
  return (
    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
      Options
    </span>
  )
}

function CategoryChipBlock({ category }: { category: WebullStudyCategoryOrch }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide', CATEGORY_TONE_BLOCK[category])}>
      {CATEGORY_LABEL_BLOCK[category]}
    </span>
  )
}

const COLUMN_TEMPLATE_BLOCK =
  'grid grid-cols-[28px_minmax(140px,1.4fr)_70px_minmax(120px,1fr)_minmax(110px,1fr)_80px_minmax(150px,1.2fr)_minmax(110px,1fr)] gap-2 items-center px-3'

export default function WebullStudyTableBlock({
  rows,
  activeTicker,
  onSelectTicker,
  onOpenStudyFile,
}: WebullStudyTableBlockProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpanded = (ticker: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        No study records found. Add one under <code>watchlist/</code> or as
        <code>{'<TICKER>/<ticker>-study.md'}</code> in the F9-execution folder.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className={cn(COLUMN_TEMPLATE_BLOCK, 'border-b bg-muted/40 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground')}>
        <span aria-hidden="true" />
        <span>Ticker</span>
        <span>Held</span>
        <span>Range</span>
        <span>Price</span>
        <span>Δ%</span>
        <span>Valid through</span>
        <span>Last updated</span>
      </div>

      <div className="divide-y">
        {rows.map((row) => {
          const isExpanded = expanded.has(row.ticker)
          const isActive = activeTicker === row.ticker
          const range = row.record?.currentRange
          const rangeLabel = range
            ? `$${range.low.toLocaleString()}–$${range.high.toLocaleString()}`
            : '—'
          const optionCount = row.options.length
          const impNote = row.record
            ? pickHighlightCommentBlock(row.record.impQuickNotes)
            : null
          const extraNoteCount = row.record
            ? Math.max(0, row.record.impQuickNotes.length - 1)
            : 0
          return (
            <div
              key={row.ticker}
              className={cn(
                'transition-colors',
                isActive ? 'bg-accent/40' : 'hover:bg-muted/30',
              )}
            >
              <div
                className={cn(COLUMN_TEMPLATE_BLOCK, 'cursor-pointer py-2.5 text-sm')}
                onClick={() => onSelectTicker(row.ticker)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectTicker(row.ticker)
                  }
                }}
              >
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
                  aria-label={isExpanded ? 'Collapse evolution' : 'Expand evolution'}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleExpanded(row.ticker)
                  }}
                >
                  <ChevronRight
                    className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')}
                  />
                </button>

                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tracking-tight">{row.ticker}</span>
                    {optionCount > 0 && (
                      <span className="rounded border border-border bg-muted/50 px-1.5 text-[10px] font-medium text-muted-foreground">
                        +{optionCount} opt
                      </span>
                    )}
                  </div>
                  <CategoryChipBlock category={row.category} />
                </div>

                <div>
                  <HeldBadgeBlock row={row} />
                </div>

                <div className="tabular-nums text-sm">{rangeLabel}</div>

                <div className="tabular-nums">
                  <div className="text-sm">{formatMoneyBlock(row.livePrice.value)}</div>
                  {row.livePrice.source !== 'unavailable' && (
                    <div className="text-[10px] text-muted-foreground">
                      {row.livePrice.source === 'webull-holding' ? 'Webull' : row.livePrice.source === 'yahoo-chart' ? 'Yahoo' : ''}
                    </div>
                  )}
                </div>

                <div className={cn('tabular-nums text-sm', deltaToneBlock(row.category))}>
                  {formatPctBlock(row.rangeDeltaPct)}
                </div>

                <div className={cn('text-sm tabular-nums', row.category === 'stale' && 'text-destructive')}>
                  {formatValidThroughBlock(row)}
                </div>

                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span className="tabular-nums">{row.record?.lastUpdated ?? '—'}</span>
                  {row.record?.filePath && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenStudyFile(row.record!.filePath)
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Open study file"
                      aria-label="Open study file"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {impNote && !isExpanded && (
                <div
                  className="flex cursor-pointer items-start gap-1.5 px-3 pb-2 pl-12 text-xs"
                  onClick={() => onSelectTicker(row.ticker)}
                  title={impNote.raw}
                >
                  <span className="mt-px shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Imp
                  </span>
                  <span className="min-w-0 flex-1 text-muted-foreground">
                    {impNote.date && (
                      <span className="mr-1.5 tabular-nums opacity-70">
                        {impNote.date}
                      </span>
                    )}
                    <span className="italic text-foreground/80">
                      {impNote.text}
                    </span>
                    {extraNoteCount > 0 && (
                      <span className="ml-1.5 not-italic opacity-60">
                        +{extraNoteCount} more
                      </span>
                    )}
                  </span>
                </div>
              )}

              {isExpanded && (
                <div className="border-t bg-muted/15 px-12 py-4">
                  {!row.record ? (
                    <p className="text-sm text-muted-foreground">
                      No study record yet for this held ticker. Add one under
                      <code className="mx-1">{`${row.ticker}/${row.ticker.toLowerCase()}-study.md`}</code>
                      to capture your reasoning.
                    </p>
                  ) : (
                  <>
                  {row.record.impQuickNotes.length > 0 && (
                    <div className="mb-4">
                      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px]">
                          Imp
                        </span>
                        Quick note
                      </div>
                      <ul className="flex flex-col gap-1.5">
                        {row.record.impQuickNotes.map((note, i) => (
                          <li
                            key={`${note.raw}-${i}`}
                            className="flex items-start gap-2 text-sm"
                          >
                            {note.date && (
                              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                                {note.date}
                              </span>
                            )}
                            <span>{note.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {row.record.comments.length > 0 && (
                    <div className="mb-4">
                      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <MessageSquareText className="h-3.5 w-3.5" />
                        Comments
                      </div>
                      <ul className="flex flex-col gap-1.5">
                        {row.record.comments.map((comment, i) => (
                          <li
                            key={`${comment.raw}-${i}`}
                            className="flex items-start gap-2 text-sm"
                          >
                            {comment.date && (
                              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                                {comment.date}
                              </span>
                            )}
                            <span>{comment.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {row.record.rangeHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No range history entries parsed from the study record body.
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-3">
                      {row.record.rangeHistory.map((entry, i) => (
                        <li
                          key={`${entry.heading}-${i}`}
                          className="rounded-md border bg-background p-3 shadow-sm"
                        >
                          <div className="mb-2 flex items-baseline gap-3 border-b pb-2">
                            <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide tabular-nums text-muted-foreground">
                              {entry.date ?? 'undated'}
                            </span>
                            <span className="text-sm font-semibold">{entry.heading}</span>
                          </div>
                          {entry.body && (
                            <div className="prose prose-sm max-w-none text-sm dark:prose-invert prose-headings:my-2 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {entry.body}
                              </ReactMarkdown>
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                  </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
