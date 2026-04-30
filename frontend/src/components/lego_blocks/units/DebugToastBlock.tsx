import { X, AlertCircle, AlertTriangle, Info, ExternalLink } from 'lucide-react'
import type { DebugLogEntryBlock } from '@/services/lego_blocks/units/debugLogBlock'

interface DebugToastBlockProps {
  entry: DebugLogEntryBlock
  onDismiss: () => void
  onOpenPanel: () => void
}

const LEVEL_CONFIG = {
  error: {
    icon: AlertCircle,
    accentClass: 'before:bg-red-500',
    iconClass: 'text-red-500 dark:text-red-400',
    labelClass: 'text-red-600 dark:text-red-300',
    label: 'Error',
  },
  warn: {
    icon: AlertTriangle,
    accentClass: 'before:bg-amber-500',
    iconClass: 'text-amber-600 dark:text-amber-400',
    labelClass: 'text-amber-700 dark:text-amber-300',
    label: 'Warning',
  },
  info: {
    icon: Info,
    accentClass: 'before:bg-blue-500',
    iconClass: 'text-blue-600 dark:text-blue-400',
    labelClass: 'text-blue-700 dark:text-blue-300',
    label: 'Info',
  },
  debug: {
    icon: Info,
    accentClass: 'before:bg-muted-foreground/40',
    iconClass: 'text-muted-foreground',
    labelClass: 'text-muted-foreground',
    label: 'Debug',
  },
} as const

// Capacitor and other plugins emit file:// URIs full of percent-encoded
// segments. Show those as plain readable paths in the toast instead of
// a wall of "%20" / "%3F" noise.
function humanizeMessageBlock(message: string): string {
  if (!message) return message
  return message.replace(/file:\/\/[^\s'"]+/g, uri => {
    try {
      const decoded = decodeURI(uri).replace(/^file:\/\/+/, '')
      return decoded || uri
    } catch {
      return uri
    }
  })
}

export default function DebugToastBlock({ entry, onDismiss, onOpenPanel }: DebugToastBlockProps) {
  const cfg = LEVEL_CONFIG[entry.level] ?? LEVEL_CONFIG.info
  const Icon = cfg.icon
  const message = humanizeMessageBlock(entry.message)

  return (
    <div
      className={`ltm-animate-slide-up pointer-events-auto relative flex w-[380px] max-w-[calc(100vw-2rem)] items-start gap-3 overflow-hidden rounded-xl border border-border/70 bg-background/95 px-3.5 py-3 pl-4 shadow-lg shadow-black/5 ring-1 ring-black/5 backdrop-blur-xl before:absolute before:inset-y-0 before:left-0 before:w-1 ${cfg.accentClass}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconClass}`} />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${cfg.labelClass}`}>
            {cfg.label}
          </span>
          {entry.source && (
            <span className="rounded bg-muted/60 px-1.5 py-px font-mono text-[10px] text-muted-foreground">
              {entry.source}
            </span>
          )}
        </div>
        <p className="line-clamp-3 break-words text-[13px] leading-snug text-foreground/90">
          {message}
        </p>
        <button
          type="button"
          onClick={onOpenPanel}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          Open debug panel
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
