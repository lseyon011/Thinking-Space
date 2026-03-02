import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { AiAssistAction } from '@/services/orchestrators/aiAssistOrch'
import { cn } from '@/lib/utils'

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
  statusPill?: { tone: 'neutral' | 'success' | 'error'; text: string } | null
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
  statusPill = null,
  helperText = 'Preview-first only. Suggestions never auto-save until you explicitly apply and save.',
}: AiAssistControlsBlockProps) {
  const [customPrompt, setCustomPrompt] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<AiAssistAction>('clarity')
  const unavailable = !selectedProvider || !selectedModel
  const actionDisabled = disabled || loading || unavailable || !!runningAction
  const canRunPrompt = !actionDisabled && customPrompt.trim().length > 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center text-sm font-medium text-foreground">AI assist</span>
        {statusPill && (
          <span
            className={cn(
              'inline-flex h-8 items-center rounded-md border px-2 text-xs',
              statusPill.tone === 'success' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
              statusPill.tone === 'error' && 'border-destructive/40 bg-destructive/10 text-destructive',
              statusPill.tone === 'neutral' && 'border-border/60 bg-background text-muted-foreground',
            )}
          >
            {statusPill.text}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Prompt
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={customPrompt}
            onChange={(event) => setCustomPrompt(event.target.value)}
            placeholder="Ask AI what to change in this note. Example: tighten this into crisp action items."
            className="h-8 w-full rounded-md border border-border/60 bg-background px-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
            disabled={actionDisabled}
          />
          <button
            type="button"
            onClick={() => onRunCustomPrompt(customPrompt.trim())}
            disabled={!canRunPrompt}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {runningAction === 'custom' ? 'Applying...' : 'Apply Prompt'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Presets</label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-8 items-center rounded-md border border-border/60 bg-background p-0.5">
            {AI_ASSIST_ACTIONS.map((item) => (
              <button
                key={item.action}
                type="button"
                onClick={() => setSelectedPreset(item.action)}
                disabled={actionDisabled}
                className={cn(
                  'rounded px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  selectedPreset === item.action
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onRun(selectedPreset)}
            disabled={actionDisabled}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {runningAction === selectedPreset ? 'Running...' : `Run ${AI_ASSIST_ACTIONS.find((item) => item.action === selectedPreset)?.label ?? 'Preset'}`}
          </button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {helperText}
      </div>
    </div>
  )
}
