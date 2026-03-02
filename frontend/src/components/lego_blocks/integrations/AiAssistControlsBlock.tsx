import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { AiAssistAction } from '@/services/orchestrators/aiAssistOrch'

const AI_ASSIST_ACTIONS: Array<{ action: AiAssistAction; label: string }> = [
  { action: 'grammar', label: 'Grammar' },
  { action: 'clarity', label: 'Clarity' },
  { action: 'structure', label: 'Structure' },
  { action: 'tone', label: 'Tone' },
]

interface AiAssistControlsBlockProps {
  selectedProvider: string | null
  selectedModel: string | null
  runningAction: AiAssistAction | null
  loading?: boolean
  disabled?: boolean
  onRun: (action: AiAssistAction) => void
  onRunCustomPrompt: (prompt: string) => void
  helperText?: string
}

export default function AiAssistControlsBlock({
  selectedProvider,
  selectedModel,
  runningAction,
  loading = false,
  disabled = false,
  onRun,
  onRunCustomPrompt,
  helperText = 'Preview-first only. Suggestions never auto-save until you explicitly apply and save.',
}: AiAssistControlsBlockProps) {
  const [customPrompt, setCustomPrompt] = useState('')
  const unavailable = !selectedProvider || !selectedModel
  const actionDisabled = disabled || loading || unavailable || !!runningAction
  const canRunPrompt = !actionDisabled && customPrompt.trim().length > 0

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          AI assist
        </span>

        {unavailable ? (
          <span className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-muted-foreground">
            No AI provider available
          </span>
        ) : (
          <span className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground">
            {selectedProvider} / {selectedModel}
          </span>
        )}

        {AI_ASSIST_ACTIONS.map((item) => (
          <button
            key={item.action}
            onClick={() => onRun(item.action)}
            disabled={actionDisabled}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runningAction === item.action ? `${item.label}...` : item.label}
          </button>
        ))}
      </div>
      <div className="mt-2 space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Prompt
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            value={customPrompt}
            onChange={(event) => setCustomPrompt(event.target.value)}
            rows={2}
            placeholder="Ask AI what to change in this note. Example: tighten this into crisp action items."
            className="w-full rounded-md border border-border/60 bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
            disabled={actionDisabled}
          />
          <button
            type="button"
            onClick={() => onRunCustomPrompt(customPrompt.trim())}
            disabled={!canRunPrompt}
            className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runningAction === 'custom' ? 'Applying...' : 'Apply Prompt'}
          </button>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {helperText}
      </div>
    </div>
  )
}
