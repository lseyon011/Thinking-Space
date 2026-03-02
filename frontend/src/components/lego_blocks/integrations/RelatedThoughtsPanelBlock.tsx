import { useEffect, useState } from 'react'
import { findRelated, type SimilarityMatch } from '@/services/lego_blocks/integrations/aiBlock'
import { cn } from '@/lib/utils'

interface RelatedThoughtsPanelBlockProps {
  text: string
  enabled?: boolean
  disabled?: boolean
  sourceFilePath?: string
  limit?: number
  minChars?: number
  className?: string
  onOpenPath?: (path: string) => void
}

export default function RelatedThoughtsPanelBlock({
  text,
  enabled = true,
  disabled = false,
  sourceFilePath,
  limit = 6,
  minChars = 24,
  className,
  onOpenPath,
}: RelatedThoughtsPanelBlockProps) {
  const resolvedText = text.trim()
  const resolvedSourcePath = (sourceFilePath ?? '').trim()
  const [matches, setMatches] = useState<SimilarityMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || disabled) {
      setMatches([])
      setLoading(false)
      setError(null)
      return
    }

    if (resolvedText.length < minChars) {
      setMatches([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const related = await findRelated({
            text: resolvedText,
            sourceFilePath: resolvedSourcePath || undefined,
            preferredTypes: ['thought'],
            limit,
          })
          if (cancelled) return
          setMatches(related)
        } catch (err) {
          if (cancelled) return
          setError(err instanceof Error ? err.message : 'Failed to load related thoughts')
          setMatches([])
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, 320)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [disabled, enabled, limit, minChars, resolvedSourcePath, resolvedText])

  return (
    <div className={cn('space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3', className)}>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Related Thoughts
      </div>
      {loading && (
        <div className="text-xs text-muted-foreground">Finding related notes...</div>
      )}
      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}
      {!loading && !error && matches.length === 0 && (
        <div className="text-xs text-muted-foreground">
          Keep typing to see lexical matches from your thought cache.
        </div>
      )}
      {matches.map(match => (
        <button
          key={match.node.uuid}
          type="button"
          className="w-full rounded-md border border-border/70 bg-background px-2.5 py-2 text-left transition-colors hover:bg-muted/40 disabled:opacity-70"
          onClick={() => {
            if (!onOpenPath) return
            onOpenPath(match.node.filePath)
          }}
          disabled={!onOpenPath}
        >
          <div className="truncate text-xs font-medium text-foreground">{match.node.title}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{match.node.filePath}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Score {Math.round(match.normalizedScore * 100)}% · {match.reasons.join(', ') || 'lexical'}
          </div>
        </button>
      ))}
    </div>
  )
}
