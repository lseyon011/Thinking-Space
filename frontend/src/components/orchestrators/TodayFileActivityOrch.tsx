import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import ClickablePath from '@/components/lego_blocks/units/ClickablePathBlock'
import MetricBlock from '@/components/lego_blocks/units/MetricBlock'
import { getDayActivity } from '@/services/orchestrators/fileActivityOrch'
import type { DayDetail } from '@/services/lego_blocks/typesBlock'

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

export default function TodayFileActivityOrch() {
  const [data, setData] = useState<DayDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = todayDateStr()

  useEffect(() => {
    setLoading(true)
    setError(null)
    getDayActivity(today)
      .then(data => setData(data))
      .catch(err => setError(err.message || 'Failed to load activity'))
      .finally(() => setLoading(false))
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
    <div className="space-y-4">
      <Card>
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
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <MetricBlock label="Total files" value={total} />
            <MetricBlock label="Created" value={data?.created_count ?? 0} className="text-emerald-600" />
            <MetricBlock label="Modified" value={data?.modified_count ?? 0} className="text-blue-600" />
            <MetricBlock label="Active sections" value={sections.length} />
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
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
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map(section => (
            <Card key={section.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{section.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {section.created.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Created</div>
                    <div className="space-y-0.5 text-sm">
                      {section.created.map(f => (
                        <div key={`c:${f.path}`} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <ClickablePath path={f.path} className="truncate text-foreground/80">
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
                        <div key={`m:${f.path}`} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                            <ClickablePath path={f.path} className="truncate text-foreground/80">
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
