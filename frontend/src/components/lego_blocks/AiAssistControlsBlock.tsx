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
  helperText?: string
}

export default function AiAssistControlsBlock({
  selectedProvider,
  selectedModel,
  runningAction,
  loading = false,
  disabled = false,
  onRun,
  helperText = 'Preview-first only. Suggestions never auto-save until you explicitly apply and save.',
}: AiAssistControlsBlockProps) {
  const unavailable = !selectedProvider || !selectedModel
  const actionDisabled = disabled || loading || unavailable || !!runningAction

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
      <div className="mt-2 text-xs text-muted-foreground">
        {helperText}
      </div>
    </div>
  )
}
