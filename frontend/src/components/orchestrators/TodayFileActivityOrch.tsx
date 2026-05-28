import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Lightbulb, Brain } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import ClickablePath from '@/components/lego_blocks/units/ClickablePathBlock'
import MetricBlock from '@/components/lego_blocks/units/MetricBlock'
import { getDayActivity } from '@/services/orchestrators/fileActivityOrch'
import type { DayDetail } from '@/services/lego_blocks/units/typesBlock'
import type { DashboardHighlights } from '@/services/lego_blocks/integrations/dashboardActivityBlock'
import { getVaultFS, getPlatformName } from '@/services/lego_blocks/integrations/fsBlock'
import { loadHomeSnapshot } from '@/services/lego_blocks/integrations/homeSnapshotBlock'

interface TodayFileActivityOrchProps {
  highlights?: DashboardHighlights | null
  highlightsLoading?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileName(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

function formatLongDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function todayDateStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatRelativeDay(dateStr: string, today: string): string {
  if (dateStr === today) return 'Today'
  const d = new Date(dateStr + 'T12:00:00')
  const t = new Date(today + 'T12:00:00')
  const diff = Math.round((t.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 1) return 'Yesterday'
  if (diff > 1 && diff < 7) return `${diff} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TodayFileActivityOrch({
  highlights,
  highlightsLoading,
}: TodayFileActivityOrchProps = {}) {
  const [data, setData] = useState<DayDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = todayDateStr()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const platform = getPlatformName()
    const preferSnapshot = platform !== 'electron'

    const live = () =>
      getDayActivity(today)
        .then((d) => {
          if (cancelled) return
          setData(d)
        })
        .catch((err) => {
          if (cancelled) return
          setError(err.message || 'Failed to load activity')
        })
        .finally(() => {
          if (cancelled) return
          setLoading(false)
        })

    if (preferSnapshot) {
      // iPhone/iPad/web: avoid the cross-iCloud vault walk when the desktop
      // snapshot has propagated. Fall back to live compute on miss/stale.
      loadHomeSnapshot(getVaultFS())
        .then((snapshot) => {
          if (cancelled) return
          if (snapshot && snapshot.today.date === today) {
            setData(snapshot.today)
            setLoading(false)
            return
          }
          void live()
        })
        .catch(() => {
          if (cancelled) return
          void live()
        })
    } else {
      void live()
    }

    return () => {
      cancelled = true
    }
  }, [today])

  const total = (data?.created_count ?? 0) + (data?.modified_count ?? 0)

  const sections = useMemo(() => {
    if (!data) return []
    return Object.entries(data.sections)
      .map(([name, payload]) => ({
        name,
        created: payload.created,
        modified: payload.modified,
        total: payload.created.length + payload.modified.length,
      }))
      .sort((a, b) => b.total - a.total)
  }, [data])

  return (
    <div className="min-w-0 w-full space-y-4 overflow-x-hidden">
      <Card className="min-w-0 w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Day Summary</CardTitle>
          <div className="text-sm text-muted-foreground">
            {formatLongDate(today)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricBlock label="Total files" value={total} />
            <MetricBlock label="Created" value={data?.created_count ?? 0} className="text-emerald-600" />
            <MetricBlock label="Modified" value={data?.modified_count ?? 0} className="text-blue-600" />
            <MetricBlock label="Active sections" value={sections.length} />
            <MetricBlock
              label="Insights today"
              value={highlights?.todayInsightsCount ?? 0}
              className="text-amber-600"
            />
            <MetricBlock
              label="Memorized today"
              value={highlights?.todayMemorizedCount ?? 0}
              className="text-violet-600"
            />
          </div>

          {(highlights?.mostRecentInsight || highlights?.mostRecentMemorized || highlightsLoading) && (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <HighlightRow
                icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
                label="Most recent insight"
                loading={!!highlightsLoading && !highlights}
                primary={highlights?.mostRecentInsight?.text}
                secondary={
                  highlights?.mostRecentInsight
                    ? formatRelativeDay(highlights.mostRecentInsight.date, today)
                    : undefined
                }
                href={highlights?.mostRecentInsight?.filePath}
                emptyText="No insights logged yet"
              />
              <HighlightRow
                icon={<Brain className="h-4 w-4 text-violet-500" />}
                label="Most recent memorized"
                loading={!!highlightsLoading && !highlights}
                primary={highlights?.mostRecentMemorized?.title}
                secondary={
                  highlights?.mostRecentMemorized
                    ? formatRelativeDay(highlights.mostRecentMemorized.date, today)
                    : undefined
                }
                href={highlights?.mostRecentMemorized?.filePath}
                emptyText="No memorization sessions yet"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="min-w-0 w-full">
              <CardContent className="pt-5 space-y-2">
                <div className="h-5 w-28 animate-pulse rounded bg-muted/40" />
                <div className="h-4 w-full animate-pulse rounded bg-muted/30" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted/30" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && data && sections.length > 0 && (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {sections.map(section => (
            <Card key={section.name} className="min-w-0 w-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{section.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {section.created.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Created</div>
                    <div className="space-y-0.5 text-sm">
                      {section.created.map(f => (
                        <div key={`c:${f.path}`} className="flex min-w-0 items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <ClickablePath path={f.path} className="block min-w-0 flex-1 truncate text-foreground/80">
                              {fileName(f.path)}
                            </ClickablePath>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatBytes(f.size_bytes)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {section.modified.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Modified</div>
                    <div className="space-y-0.5 text-sm">
                      {section.modified.map(f => (
                        <div key={`m:${f.path}`} className="flex min-w-0 items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                            <ClickablePath path={f.path} className="block min-w-0 flex-1 truncate text-foreground/80">
                              {fileName(f.path)}
                            </ClickablePath>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatBytes(f.size_bytes)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && data && sections.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No file activity yet today.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface HighlightRowProps {
  icon: ReactNode
  label: string
  primary?: string
  secondary?: string
  href?: string
  loading?: boolean
  emptyText: string
}

function HighlightRow({ icon, label, primary, secondary, href, loading, emptyText }: HighlightRowProps) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-md border border-border/40 bg-background/40 p-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          {secondary && (
            <div className="text-xs text-muted-foreground shrink-0">{secondary}</div>
          )}
        </div>
        {loading ? (
          <div className="mt-1.5 h-4 w-3/4 animate-pulse rounded bg-muted/40" />
        ) : primary ? (
          href ? (
            <ClickablePath
              path={href}
              className="mt-1 block truncate text-sm text-foreground/90"
            >
              {primary}
            </ClickablePath>
          ) : (
            <div className="mt-1 truncate text-sm text-foreground/90">{primary}</div>
          )
        ) : (
          <div className="mt-1 text-sm text-muted-foreground">{emptyText}</div>
        )}
      </div>
    </div>
  )
}
