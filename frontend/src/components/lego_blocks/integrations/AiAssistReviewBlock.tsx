import { useEffect, useMemo, useState } from 'react'
import type { RunAiAssistResult } from '@/services/orchestrators/aiAssistOrch'
import { buildAiAssistDiffBlock } from '@/services/lego_blocks/units/aiAssistDiffBlock'

interface AiAssistReviewBlockProps {
  suggestion: RunAiAssistResult
  onApply: (nextContent: string) => void
  onDiscard: () => void
}

function diffRowClass(kind: 'unchanged' | 'changed' | 'added' | 'removed'): string {
  if (kind === 'unchanged') return ''
  if (kind === 'added') return 'bg-emerald-500/10'
  if (kind === 'removed') return 'bg-destructive/10'
  return 'bg-amber-500/10'
}

type WordOp = { kind: 'equal' | 'added' | 'removed'; text: string }

function tokenizeWithWhitespace(value: string): string[] {
  if (!value) return []
  return value.split(/(\s+)/).filter((token) => token.length > 0)
}

function buildWordOps(before: string, after: string): WordOp[] {
  const a = tokenizeWithWhitespace(before)
  const b = tokenizeWithWhitespace(after)
  const n = a.length
  const m = b.length
  if (n === 0 && m === 0) return []

  const matrixCellLimit = 12_000
  if (n * m > matrixCellLimit) {
    return [
      ...(before ? [{ kind: 'removed' as const, text: before }] : []),
      ...(after ? [{ kind: 'added' as const, text: after }] : []),
    ]
  }

  const width = m + 1
  const lcs = new Uint16Array((n + 1) * (m + 1))
  const idx = (i: number, j: number) => i * width + j

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        lcs[idx(i, j)] = lcs[idx(i + 1, j + 1)] + 1
      } else {
        const down = lcs[idx(i + 1, j)]
        const right = lcs[idx(i, j + 1)]
        lcs[idx(i, j)] = down >= right ? down : right
      }
    }
  }

  const ops: WordOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'equal', text: a[i] })
      i += 1
      j += 1
      continue
    }
    const down = lcs[idx(i + 1, j)]
    const right = lcs[idx(i, j + 1)]
    if (down >= right) {
      ops.push({ kind: 'removed', text: a[i] })
      i += 1
    } else {
      ops.push({ kind: 'added', text: b[j] })
      j += 1
    }
  }
  while (i < n) {
    ops.push({ kind: 'removed', text: a[i] })
    i += 1
  }
  while (j < m) {
    ops.push({ kind: 'added', text: b[j] })
    j += 1
  }

  return ops
}

function renderChangedLine(before: string, after: string, side: 'before' | 'after') {
  const ops = buildWordOps(before, after)
  const visible = ops.filter((op) => (
    op.kind === 'equal'
    || (side === 'before' && op.kind === 'removed')
    || (side === 'after' && op.kind === 'added')
  ))

  if (visible.length === 0) return '\u00a0'

  return visible.map((op, index) => {
    if (op.kind === 'equal') {
      return <span key={`${index}-eq`}>{op.text}</span>
    }
    if (side === 'before' && op.kind === 'removed') {
      return (
        <span key={`${index}-rm`} className="rounded bg-destructive/25 px-0.5 line-through">
          {op.text}
        </span>
      )
    }
    if (side === 'after' && op.kind === 'added') {
      return (
        <span key={`${index}-ad`} className="rounded bg-emerald-500/25 px-0.5">
          {op.text}
        </span>
      )
    }
    return null
  })
}

export default function AiAssistReviewBlock({ suggestion, onApply, onDiscard }: AiAssistReviewBlockProps) {
  const [editMode, setEditMode] = useState(false)
  const [editedContent, setEditedContent] = useState(suggestion.suggestedContent)

  useEffect(() => {
    setEditMode(false)
    setEditedContent(suggestion.suggestedContent)
  }, [suggestion])

  const diff = useMemo(
    () => buildAiAssistDiffBlock(
      suggestion.originalContent,
      editedContent,
      4000,
      { includeUnchanged: true },
    ),
    [editedContent, suggestion.originalContent],
  )

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {[suggestion.provider, suggestion.model].filter(Boolean).join(' • ')}
        {suggestion.latency_ms != null && ` • ${suggestion.latency_ms} ms`}
        {suggestion.total_tokens != null && ` • tokens ${suggestion.total_tokens}`}
      </div>

      <div className="text-xs text-muted-foreground">
        Diff summary:
        {' '}
        <span className="text-foreground">changed lines {diff.summary.changed}</span>
        {' • '}
        <span className="text-foreground">added lines {diff.summary.added}</span>
        {' • '}
        <span className="text-foreground">removed lines {diff.summary.removed}</span>
        {diff.truncated && ' • showing first 200 changes'}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditMode((prev) => !prev)}
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-foreground hover:bg-muted"
        >
          {editMode ? 'Done editing' : 'Edit'}
        </button>
        {editMode && (
          <span className="text-xs text-muted-foreground">Editing suggestion block (diff updates live)</span>
        )}
      </div>

      {editMode && (
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Edited suggestion</div>
          <textarea
            value={editedContent}
            onChange={(event) => setEditedContent(event.target.value)}
            className="min-h-[20vh] w-full resize-y rounded-lg border border-input bg-background p-3 text-sm"
          />
        </div>
      )}

      <div className="max-h-56 overflow-auto rounded-md border border-border/50 bg-background/70">
        {diff.rows.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">No line-level differences to display.</div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-muted-foreground">
                <th className="w-14 px-2 py-1.5 font-medium">Line</th>
                <th className="w-[43%] px-2 py-1.5 font-medium">Before</th>
                <th className="w-[43%] px-2 py-1.5 font-medium">After</th>
              </tr>
            </thead>
            <tbody>
              {diff.rows.map((row) => (
                <tr key={`${row.lineNumber}-${row.kind}`} className={`border-b border-border/40 align-top ${diffRowClass(row.kind)}`}>
                  <td className="px-2 py-1.5 font-mono text-muted-foreground">{row.lineNumber}</td>
                  <td className="px-2 py-1.5 font-mono whitespace-pre-wrap break-words text-foreground">
                    {row.kind === 'changed' ? renderChangedLine(row.before, row.after, 'before') : (row.before || '\u00a0')}
                  </td>
                  <td className="px-2 py-1.5 font-mono whitespace-pre-wrap break-words text-foreground">
                    {row.kind === 'changed' ? renderChangedLine(row.before, row.after, 'after') : (row.after || '\u00a0')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onApply(editedContent)}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground"
        >
          Apply suggestion
        </button>
        <button
          onClick={onDiscard}
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-foreground hover:bg-muted"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
