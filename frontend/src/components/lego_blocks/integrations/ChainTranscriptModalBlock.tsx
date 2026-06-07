import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, Loader2 } from 'lucide-react'
import type { ActivityChain } from '@/services/lego_blocks/units/aiActivityParserBlock'
import { getChainTranscriptBlock } from '@/services/lego_blocks/units/getChainTranscriptBlock'

interface ChainTranscriptModalBlockProps {
  /** The chain whose full transcript should render. `null` closes the modal. */
  chain: ActivityChain | null
  onClose: () => void
}

export default function ChainTranscriptModalBlock({ chain, onClose }: ChainTranscriptModalBlockProps) {
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex h-[90vh] w-[min(900px,92vw)] flex-col overflow-hidden rounded-2xl border border-border/40 bg-background shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-5 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              {chain.project} · {chain.sessions.length} session{chain.sessions.length === 1 ? '' : 's'}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {chain.topic || '(no topic)'}
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
    </div>
  )
}
