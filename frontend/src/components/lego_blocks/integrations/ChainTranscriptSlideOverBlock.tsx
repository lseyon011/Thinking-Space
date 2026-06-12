import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, Loader2 } from 'lucide-react'
import type { ActivityChain } from '@/services/lego_blocks/units/aiActivityParserBlock'
import { getChainTranscriptBlock } from '@/services/lego_blocks/units/getChainTranscriptBlock'

interface ChainTranscriptSlideOverBlockProps {
  /** The chain whose full transcript should render. `null` closes the panel. */
  chain: ActivityChain | null
  onClose: () => void
}

function fmtClock(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const suffix = h < 12 ? 'am' : 'pm'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

/** Render a chain's date + time span for the header, e.g. "Jun 11 · 4:48pm–9:14am +1d". */
function fmtChainWhen(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const date = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const a = fmtClock(startIso)
  const b = endIso ? fmtClock(endIso) : a
  if (!endIso || a === b) return `${date} · ${a}`
  const end = new Date(endIso)
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  const dayDelta = Math.round((endDay - startDay) / 86_400_000)
  const span = dayDelta > 0 ? `${a}–${b} +${dayDelta}d` : `${a}–${b}`
  return `${date} · ${span}`
}

export default function ChainTranscriptSlideOverBlock({ chain, onClose }: ChainTranscriptSlideOverBlockProps) {
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!chain) {
      setMarkdown(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setMarkdown(null)
    getChainTranscriptBlock(chain)
      .then(md => { if (!cancelled) setMarkdown(md) })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [chain])

  useEffect(() => {
    if (!chain) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chain, onClose])

  if (!chain) return null

  // Portal to <body>: this block mounts inside the home-canvas anchor panel,
  // whose transformed ancestors turn `position: fixed` into local positioning
  // (and overflow:hidden would clip the panel).
  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <style>{`
        @keyframes ltm-transcript-slideover-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
      {/* Transparent click-catcher: closes on outside click but leaves the
          page visible so the day table can be read alongside the transcript. */}
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="absolute right-0 top-0 flex h-full w-[min(760px,92vw)] flex-col overflow-hidden border-l border-border/40 bg-background shadow-2xl"
        style={{
          animation: 'ltm-transcript-slideover-in 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              {chain.project} · {chain.sessions.length} session{chain.sessions.length === 1 ? '' : 's'}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {chain.topic || '(no topic)'}
            </div>
            <div className="truncate text-[11px] text-muted-foreground/80">
              {fmtChainWhen(chain.startedIso, chain.endedIso)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading transcript…
            </div>
          )}
          {error && !loading && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {markdown && !loading && (
            <article
              className="prose prose-sm dark:prose-invert max-w-none"
              style={{ overflowWrap: 'anywhere' }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </article>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
