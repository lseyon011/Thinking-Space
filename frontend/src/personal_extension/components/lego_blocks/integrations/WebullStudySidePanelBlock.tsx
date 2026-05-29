import { useEffect, useMemo, useRef, useState } from 'react'
import { X, ExternalLink, Send, AlertCircle, Eye, FileText, Layers, MessageSquare } from 'lucide-react'
import MarkdownDocumentBlock from '@/components/lego_blocks/integrations/MarkdownDocumentBlock'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { cn } from '@/lib/utils'
import { appendStudyCommentBlock } from '../../../services/lego_blocks/integrations/webullStudyCommentBlock'
import type {
  WebullStudyRowOrch,
} from '../../../services/orchestrators/webullStudyOrch'

interface WebullStudySidePanelBlockProps {
  row: WebullStudyRowOrch | null
  onClose: () => void
  onOpenStudyFile: (filePath: string) => void
  /** Called after a successful comment add so the parent can refresh the snapshot. */
  onCommentAdded?: () => void
}

const STATUS_TONE_BLOCK: Record<string, string> = {
  'own-at-right-price':
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  'restudy-needed':
    'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  'too-hard': 'bg-muted/60 text-muted-foreground border-border',
  'unknown': 'bg-muted/60 text-muted-foreground border-border',
}

const STATUS_LABEL_BLOCK: Record<string, string> = {
  'own-at-right-price': 'Own at right price',
  'restudy-needed': 'Restudy needed',
  'too-hard': 'Too hard',
  'unknown': 'Unknown',
}

function formatMoneyBlock(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function priceSourceLabelBlock(source: string): string {
  switch (source) {
    case 'webull-holding':
      return 'Webull holding'
    case 'webull-option-leg':
      return 'Webull option leg'
    case 'yahoo-chart':
      return 'Yahoo'
    default:
      return 'Unavailable'
  }
}

function SectionHeaderBlock({
  icon: Icon,
  title,
  trailing,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  trailing?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      {trailing}
    </div>
  )
}

export default function WebullStudySidePanelBlock({
  row,
  onClose,
  onOpenStudyFile,
  onCommentAdded,
}: WebullStudySidePanelBlockProps) {
  const [commentDraft, setCommentDraft] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null)

  // Reset draft when switching rows.
  useEffect(() => {
    setCommentDraft('')
    setCommentError(null)
  }, [row?.ticker])

  const record = row?.record ?? null
  const range = record?.currentRange ?? null
  const comments = record?.comments ?? []

  const kindLabel = useMemo(() => {
    if (!record) return 'HELD · NO STUDY'
    if (row?.heldStock) return 'STUDY · HELD STOCK'
    if (row?.held) return 'STUDY · HELD OPTION'
    return 'STUDY · WATCHLIST'
  }, [record, row?.held, row?.heldStock])

  if (!row) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        Select a study row to see the full record here.
      </div>
    )
  }

  const submitComment = async () => {
    if (!record?.filePath) return
    const trimmed = commentDraft.trim()
    if (!trimmed) return
    setCommentSubmitting(true)
    setCommentError(null)
    try {
      await appendStudyCommentBlock(record.filePath, trimmed)
      setCommentDraft('')
      onCommentAdded?.()
      // Refocus for the next comment
      commentInputRef.current?.focus()
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : String(err))
    } finally {
      setCommentSubmitting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-background">
      {/* Top label + close */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          {kindLabel}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Title block */}
      <div className="border-b px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">{row.ticker}</h2>
          <div className="flex items-center gap-1">
            {record?.filePath && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onOpenStudyFile(record.filePath)}
                className="gap-1.5"
              >
                <ExternalLink className="h-4 w-4" />
                Open File
              </Button>
            )}
          </div>
        </div>
        {record && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                STATUS_TONE_BLOCK[record.status] ?? STATUS_TONE_BLOCK.unknown,
              )}
            >
              {STATUS_LABEL_BLOCK[record.status] ?? record.status}
            </span>
            {record.statusRaw && record.statusRaw !== STATUS_LABEL_BLOCK[record.status] && (
              <span className="text-xs italic text-muted-foreground">"{record.statusRaw}"</span>
            )}
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-auto">
        {/* Summary cards */}
        <div className="grid gap-2 border-b px-4 py-4 text-sm sm:grid-cols-3">
          <div className="rounded-md border bg-muted/20 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Live Price
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {formatMoneyBlock(row.livePrice.value)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {priceSourceLabelBlock(row.livePrice.source)}
            </p>
          </div>
          <div className="rounded-md border bg-muted/20 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Current Range
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {range
                ? `${formatMoneyBlock(range.low)} – ${formatMoneyBlock(range.high)}`
                : '—'}
            </p>
            {range?.setOn && (
              <p className="text-[10px] text-muted-foreground">set {range.setOn}</p>
            )}
          </div>
          <div className="rounded-md border bg-muted/20 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Valid through
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {record?.validThrough ?? '—'}
            </p>
            {row.daysToValidThrough !== null && (
              <p
                className={cn(
                  'text-[10px]',
                  row.daysToValidThrough < 0 ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {row.daysToValidThrough < 0
                  ? `${Math.abs(row.daysToValidThrough)} days past`
                  : `${row.daysToValidThrough} days remaining`}
              </p>
            )}
          </div>
        </div>

        {/* Options */}
        {row.options.length > 0 && (
          <div className="border-b px-4 py-4">
            <SectionHeaderBlock icon={FileText} title={`Options (${row.options.length})`} />
            <ul className="flex flex-col gap-1.5 text-sm">
              {row.options.map((opt, i) => {
                const spec = opt.spec
                const label = `${spec.optionType ?? 'OPT'} ${
                  spec.exercisePrice !== null ? '$' + spec.exercisePrice : '?'
                } ${spec.expireDate ?? '?'}`
                return (
                  <li
                    key={`${spec.optionType}-${spec.exercisePrice}-${spec.expireDate}-${i}`}
                    className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">{label}</span>
                      {opt.matchedHolding && (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-emerald-700 dark:text-emerald-300">
                          Held
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="tabular-nums">{formatMoneyBlock(opt.livePrice.value)}</p>
                      {opt.livePrice.note && (
                        <p className="text-[10px] text-muted-foreground">{opt.livePrice.note}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Comments */}
        <div className="border-b px-4 py-4">
          <SectionHeaderBlock
            icon={MessageSquare}
            title={`Comments${comments.length > 0 ? ` (${comments.length})` : ''}`}
          />
          {comments.length === 0 ? (
            <p className="mb-3 text-xs italic text-muted-foreground">
              No comments yet. Add the first one below — it'll be appended to the
              <code className="mx-1">## Comments</code> section in the study file.
            </p>
          ) : (
            <ul className="mb-3 flex flex-col gap-2">
              {comments.map((c, i) => (
                <li
                  key={`${c.date ?? 'undated'}-${i}`}
                  className="rounded-md border bg-muted/15 px-2.5 py-1.5 text-sm"
                >
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground tabular-nums">
                    {c.date ?? 'undated'}
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap break-words">{c.text}</div>
                </li>
              ))}
            </ul>
          )}

          {record?.filePath ? (
            <div className="flex flex-col gap-2">
              <textarea
                ref={commentInputRef}
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                rows={2}
                placeholder="Add a comment…"
                className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
                disabled={commentSubmitting}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    void submitComment()
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-muted-foreground">⌘+Enter to send</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void submitComment()}
                  disabled={commentSubmitting || !commentDraft.trim()}
                  className="gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {commentSubmitting ? 'Adding…' : 'Add comment'}
                </Button>
              </div>
              {commentError && (
                <div className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                  <span>{commentError}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              Comments need a study file. Create
              <code className="mx-1">{`${row.ticker}/${row.ticker.toLowerCase()}-study.md`}</code>
              first.
            </p>
          )}
        </div>

        {/* Body */}
        <div className="px-4 py-4">
          <SectionHeaderBlock icon={Eye} title="Study record" />
          {record?.filePath ? (
            <div className="min-h-[300px] overflow-hidden rounded-md border">
              <MarkdownDocumentBlock
                key={record.filePath}
                path={record.filePath}
                initialMode="view"
                topBarHidden
                onOpenPath={onOpenStudyFile}
                onOpenPathForEdit={onOpenStudyFile}
                className="h-full"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No study record yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
