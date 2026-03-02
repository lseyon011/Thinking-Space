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
        AI Suggested Related Thoughts
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
      {!loading && !error && matches.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border/70 bg-background">
          <table className="w-full min-w-[640px] table-fixed text-left text-xs">
            <thead className="border-b border-border/60 bg-muted/30 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-2.5 py-2 font-medium">Thought</th>
                <th className="px-2.5 py-2 font-medium">Path</th>
                <th className="px-2.5 py-2 font-medium">Score</th>
                <th className="px-2.5 py-2 font-medium">Signals</th>
                <th className="px-2.5 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => (
                <tr key={match.node.uuid} className="border-b border-border/40 last:border-b-0">
                  <td className="px-2.5 py-2 align-top text-foreground">
                    <div className="truncate font-medium" title={match.node.title}>{match.node.title}</div>
                  </td>
                  <td className="px-2.5 py-2 align-top text-muted-foreground">
                    <div className="truncate" title={match.node.filePath}>{match.node.filePath}</div>
                  </td>
                  <td className="px-2.5 py-2 align-top text-muted-foreground">
                    {Math.round(match.normalizedScore * 100)}%
                  </td>
                  <td className="px-2.5 py-2 align-top text-muted-foreground">
                    <div className="line-clamp-2" title={match.reasons.join(', ') || 'lexical'}>
                      {match.reasons.join(', ') || 'lexical'}
                    </div>
                  </td>
                  <td className="px-2.5 py-2 align-top">
                    <button
                      type="button"
                      className="rounded-md border border-border/70 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        if (!onOpenPath) return
                        onOpenPath(match.node.filePath)
                      }}
                      disabled={!onOpenPath}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
