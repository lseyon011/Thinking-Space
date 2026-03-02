import { useEffect, useState } from 'react'
import type { RunAiAssistResult } from '@/services/orchestrators/aiAssistOrch'
import TextDiffTableBlock from '@/components/lego_blocks/integrations/TextDiffTableBlock'

interface AiAssistReviewBlockProps {
  suggestion: RunAiAssistResult
  onApply: (nextContent: string) => void
  onDiscard: () => void
  onStartInlineApply?: (suggestedContent: string) => void
}

export default function AiAssistReviewBlock({ suggestion, onApply, onDiscard, onStartInlineApply }: AiAssistReviewBlockProps) {
  const [editMode, setEditMode] = useState(false)
  const [editedContent, setEditedContent] = useState(suggestion.suggestedContent)

  useEffect(() => {
    setEditMode(false)
    setEditedContent(suggestion.suggestedContent)
  }, [suggestion])

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {[suggestion.provider, suggestion.model].filter(Boolean).join(' • ')}
        {suggestion.latency_ms != null && ` • ${suggestion.latency_ms} ms`}
        {suggestion.total_tokens != null && ` • tokens ${suggestion.total_tokens}`}
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
        {!editMode && onStartInlineApply && (
          <button
            type="button"
            onClick={() => onStartInlineApply(editedContent)}
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-foreground hover:bg-muted"
          >
            Inline apply in editor
          </button>
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

      <TextDiffTableBlock
        originalContent={suggestion.originalContent}
        suggestedContent={editedContent}
        maxRows={4000}
        includeUnchanged
      />

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
