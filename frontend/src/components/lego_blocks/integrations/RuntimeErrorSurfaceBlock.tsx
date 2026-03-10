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
  return new Date(value).toLocaleString()
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
  return (
    <div className="rounded-xl border border-border/70 bg-background/95 p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
            {report.title}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{report.message}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {formatCapturedAt(report.capturedAt)}
            {report.location ? ` · ${report.location}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" size="sm" variant="outline" onClick={onCopy}>
            {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          {onDismiss ? (
            <Button type="button" size="sm" variant="ghost" onClick={onDismiss} aria-label="Dismiss error">
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-muted/60 p-2 text-[11px] text-foreground">
        <p className="font-semibold uppercase tracking-[0.12em] text-muted-foreground">Details</p>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5">
          {report.detail}
          {report.stack ? `\n\n${report.stack}` : ''}
          {report.componentStack ? `\n\n${report.componentStack}` : ''}
        </pre>
      </div>
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
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/95 p-4">
        <div className="w-full max-w-2xl rounded-3xl border border-amber-200 bg-background p-5 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                Runtime failure
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">
                The app hit an unrecoverable error.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The details below can be copied and shared directly from the app.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <RuntimeErrorDetailsBlock
              report={latestReport}
              copied={copiedToken === latestReport.id}
              onCopy={() => onCopyReport(latestReport.id)}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              {reports.length > 1 ? `${reports.length} errors captured in this session.` : '1 error captured in this session.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onCopyAll}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy all
              </Button>
              {onReloadApp ? (
                <Button type="button" size="sm" onClick={onReloadApp}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Reload app
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!latestReport) return null

  return (
    <div className="fixed bottom-3 right-3 z-[95] w-[min(34rem,calc(100vw-1.5rem))] rounded-2xl border border-amber-200 bg-background/98 shadow-2xl backdrop-blur-sm">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                Runtime error captured
              </p>
              <p className="mt-1 truncate text-sm font-medium text-foreground">{latestReport.message}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {reports.length} error{reports.length === 1 ? '' : 's'} captured
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setExpanded(prev => !prev)}
              aria-label={expanded ? 'Collapse runtime errors' : 'Expand runtime errors'}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border/60 px-4 py-3">
        <Button type="button" size="sm" variant="outline" onClick={() => onCopyReport(latestReport.id)}>
          {copiedToken === latestReport.id ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          {copiedToken === latestReport.id ? 'Copied latest' : 'Copy latest'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCopyAll}>
          {copiedToken === 'all' ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          {copiedToken === 'all' ? 'Copied all' : 'Copy all'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClearReports}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Clear
        </Button>
      </div>

      {expanded ? (
        <div className="max-h-[55vh] space-y-3 overflow-auto border-t border-border/60 px-4 py-3">
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
      ) : null}
    </div>
  )
}
