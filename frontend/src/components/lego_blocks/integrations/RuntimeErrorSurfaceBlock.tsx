import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, Copy, RefreshCw, Trash2, X } from 'lucide-react'
import { Button } from '@/components/lego_blocks/units/ui/button'
import type { RuntimeErrorReportBlock } from '@/services/lego_blocks/units/runtimeErrorBlock'

interface RuntimeErrorSurfaceBlockProps {
  reports: readonly RuntimeErrorReportBlock[]
  fatalReport?: RuntimeErrorReportBlock | null
  copiedToken?: string | null
  onCopyReport: (reportId: string) => void
  onCopyAll: () => void
  onDismissReport: (reportId: string) => void
  onClearReports: () => void
  onReloadApp?: () => void
}

function formatCapturedAt(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function humanizeReportMessageBlock(message: string): string {
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

function RuntimeErrorDetailsBlock({
  report,
  copied,
  onCopy,
  onDismiss,
}: {
  report: RuntimeErrorReportBlock
  copied: boolean
  onCopy: () => void
  onDismiss?: () => void
}) {
  const [showStack, setShowStack] = useState(false)
  const message = humanizeReportMessageBlock(report.message)
  const detail = humanizeReportMessageBlock(report.detail || '')
  const hasStack = !!(report.stack || report.componentStack)

  return (
    <div className="relative overflow-hidden rounded-lg border border-border/60 bg-background text-sm">
      <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-amber-500" aria-hidden />
      <div className="flex items-start gap-3 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-400">
              {report.title}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
              {formatCapturedAt(report.capturedAt)}
            </span>
            {report.location && (
              <span className="truncate font-mono text-[10px] text-muted-foreground/70">
                · {report.location}
              </span>
            )}
          </div>
          <p className="mt-1 break-words text-[13px] leading-snug text-foreground/90">{message}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onCopy}
            aria-label="Copy error"
            className="rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss error"
              className="rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {(detail || hasStack) && (
        <div className="border-t border-border/40 px-3.5 py-2">
          <button
            type="button"
            onClick={() => setShowStack(v => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showStack ? 'rotate-180' : '-rotate-90'}`} />
            {showStack ? 'Hide details' : 'Show details'}
          </button>
          {showStack && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/40 bg-muted/30 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {detail}
              {report.stack ? `\n\n${report.stack}` : ''}
              {report.componentStack ? `\n\n${report.componentStack}` : ''}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export default function RuntimeErrorSurfaceBlock({
  reports,
  fatalReport = null,
  copiedToken = null,
  onCopyReport,
  onCopyAll,
  onDismissReport,
  onClearReports,
  onReloadApp,
}: RuntimeErrorSurfaceBlockProps) {
  const [expanded, setExpanded] = useState(true)
  const latestReport = useMemo(
    () => fatalReport ?? reports[0] ?? null,
    [fatalReport, reports],
  )

  if (fatalReport && latestReport) {
    const message = humanizeReportMessageBlock(latestReport.message)
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl ring-1 ring-black/5">
          <div className="flex items-start gap-3 border-b border-border/50 px-5 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-400">
                Runtime failure
              </p>
              <h2 className="mt-0.5 text-base font-semibold text-foreground">
                The app hit an unrecoverable error
              </h2>
              <p className="mt-1 break-words text-sm text-muted-foreground">{message}</p>
            </div>
          </div>

          <div className="px-5 py-4">
            <RuntimeErrorDetailsBlock
              report={latestReport}
              copied={copiedToken === latestReport.id}
              onCopy={() => onCopyReport(latestReport.id)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-muted/20 px-5 py-3">
            <p className="text-[11px] text-muted-foreground">
              {reports.length} error{reports.length === 1 ? '' : 's'} captured this session
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onCopyAll}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy all
              </Button>
              {onReloadApp ? (
                <Button type="button" size="sm" onClick={onReloadApp}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Reload
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!latestReport) return null

  const latestMessage = humanizeReportMessageBlock(latestReport.message)

  return (
    <div
      className="fixed right-3 z-[95] w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-lg shadow-black/5 ring-1 ring-black/5 backdrop-blur-xl"
      style={{ bottom: 'calc(var(--ltm-safe-bottom, 0px) + 5.5rem)' }}
    >
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-amber-500" aria-hidden />
      <div className="flex items-start gap-2.5 px-3.5 py-3 pl-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-400">
              Runtime error
            </span>
            <span className="rounded-md bg-muted/60 px-1.5 py-px font-mono text-[10px] text-muted-foreground">
              {reports.length}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 break-words text-[13px] leading-snug text-foreground/90">
            {latestMessage}
          </p>
        </div>
        <button
          type="button"
          className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground"
          onClick={() => setExpanded(prev => !prev)}
          aria-label={expanded ? 'Collapse runtime errors' : 'Expand runtime errors'}
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <>
          <div className="border-t border-border/40 bg-muted/10">
            <div className="ltm-nav-scroll max-h-[50vh] space-y-2 overflow-auto px-3.5 py-3">
              {reports.map((report) => (
                <RuntimeErrorDetailsBlock
                  key={report.id}
                  report={report}
                  copied={copiedToken === report.id}
                  onCopy={() => onCopyReport(report.id)}
                  onDismiss={() => onDismissReport(report.id)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/40 px-3.5 py-2">
            <button
              type="button"
              onClick={onCopyAll}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {copiedToken === 'all' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              {copiedToken === 'all' ? 'Copied all' : 'Copy all'}
            </button>
            <button
              type="button"
              onClick={onClearReports}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </button>
          </div>
        </>
      )}
    </div>
  )
}
