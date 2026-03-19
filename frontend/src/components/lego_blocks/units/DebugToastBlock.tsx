import { X, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { DebugLogEntryBlock } from '@/services/lego_blocks/units/debugLogBlock'

interface DebugToastBlockProps {
  entry: DebugLogEntryBlock
  onDismiss: () => void
  onOpenPanel: () => void
}

const LEVEL_CONFIG = {
  error: {
    icon: AlertCircle,
    containerClass: 'border-red-500/40 bg-red-950/90',
    iconClass: 'text-red-400',
    labelClass: 'text-red-300',
    label: 'Error',
  },
  warn: {
    icon: AlertTriangle,
    containerClass: 'border-yellow-500/40 bg-yellow-950/90',
    iconClass: 'text-yellow-400',
    labelClass: 'text-yellow-300',
    label: 'Warning',
  },
  info: {
    icon: Info,
    containerClass: 'border-blue-500/40 bg-blue-950/90',
    iconClass: 'text-blue-400',
    labelClass: 'text-blue-300',
    label: 'Info',
  },
  debug: {
    icon: Info,
    containerClass: 'border-border/60 bg-background/95',
    iconClass: 'text-muted-foreground',
    labelClass: 'text-muted-foreground',
    label: 'Debug',
  },
} as const

export default function DebugToastBlock({ entry, onDismiss, onOpenPanel }: DebugToastBlockProps) {
  const cfg = LEVEL_CONFIG[entry.level] ?? LEVEL_CONFIG.info
  const Icon = cfg.icon

  return (
    <div
      className={`ltm-animate-slide-up pointer-events-auto flex w-[360px] max-w-[calc(100vw-2rem)] items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg backdrop-blur-md ${cfg.containerClass}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconClass}`} />
      <div className="min-w-0 flex-1">
        <div className={`mb-0.5 text-[11px] font-semibold uppercase tracking-wide ${cfg.labelClass}`}>
          {cfg.label}{entry.source ? ` · ${entry.source}` : ''}
        </div>
        <p className="line-clamp-2 text-xs text-foreground/90 leading-relaxed">{entry.message}</p>
        <button
          type="button"
          onClick={onOpenPanel}
          className="mt-1.5 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Open debug panel
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
