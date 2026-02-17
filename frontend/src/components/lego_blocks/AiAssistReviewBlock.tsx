import { useMemo } from 'react'
import type { RunAiAssistResult } from '@/services/orchestrators/aiAssistOrch'
import { buildAiAssistDiffBlock } from '@/services/lego_blocks/aiAssistDiffBlock'

interface AiAssistReviewBlockProps {
  suggestion: RunAiAssistResult
  onApply: () => void
  onDiscard: () => void
}

function diffRowClass(kind: 'changed' | 'added' | 'removed'): string {
  if (kind === 'added') return 'bg-emerald-500/10'
  if (kind === 'removed') return 'bg-destructive/10'
  return 'bg-amber-500/10'
}

export default function AiAssistReviewBlock({ suggestion, onApply, onDiscard }: AiAssistReviewBlockProps) {
  const diff = useMemo(
    () => buildAiAssistDiffBlock(suggestion.originalContent, suggestion.suggestedContent),
    [suggestion.originalContent, suggestion.suggestedContent],
  )

  return (
    <div className="rounded-lg border border-border/50 bg-background p-3">
      <div className="text-xs text-muted-foreground">
        {[suggestion.provider, suggestion.model].filter(Boolean).join(' • ')}
        {suggestion.latency_ms != null && ` • ${suggestion.latency_ms} ms`}
        {suggestion.total_tokens != null && ` • tokens ${suggestion.total_tokens}`}
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        Diff summary:
        {' '}
        <span className="text-foreground">changed {diff.summary.changed}</span>
        {' • '}
        <span className="text-foreground">added {diff.summary.added}</span>
        {' • '}
        <span className="text-foreground">removed {diff.summary.removed}</span>
        {diff.truncated && ' • showing first 200 changes'}
      </div>

      <div className="mt-2 max-h-56 overflow-auto rounded-md border border-border/50">
        {diff.rows.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">No line-level differences to display.</div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-muted-foreground">
                <th className="px-2 py-1.5 font-medium">Line</th>
                <th className="px-2 py-1.5 font-medium">Before</th>
                <th className="px-2 py-1.5 font-medium">After</th>
              </tr>
            </thead>
            <tbody>
              {diff.rows.map((row) => (
                <tr key={`${row.lineNumber}-${row.kind}`} className={`border-b border-border/40 align-top ${diffRowClass(row.kind)}`}>
                  <td className="px-2 py-1.5 font-mono text-muted-foreground">{row.lineNumber}</td>
                  <td className="px-2 py-1.5 font-mono whitespace-pre-wrap break-words">{row.before || '\u00a0'}</td>
                  <td className="px-2 py-1.5 font-mono whitespace-pre-wrap break-words">{row.after || '\u00a0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-2">
        <div className="mb-1 text-xs text-muted-foreground">Suggested text</div>
        <textarea
          value={suggestion.suggestedContent}
          readOnly
          className="min-h-[14vh] w-full resize-y rounded-lg border border-input bg-muted/10 p-3 text-sm"
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={onApply}
          className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground"
        >
          Apply suggestion
        </button>
        <button
          onClick={onDiscard}
          className="rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-muted"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
