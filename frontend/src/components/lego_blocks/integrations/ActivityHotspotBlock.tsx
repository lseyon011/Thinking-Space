import { useMemo, useState } from 'react'
import type { DashboardDay } from '@/services/lego_blocks/integrations/dashboardActivityBlock'
import { cn } from '@/lib/utils'

interface ActivityHotspotBlockProps {
  days: DashboardDay[]
  loading?: boolean
  startIso: string
  endIso: string
  onSelectDate?: (date: string) => void
}

interface CellModel {
  date: string
  files: number
  insights: number
  memorized: number
  intensity: number
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

function activityScore(d: { files: number; insights: number; memorized: number }): number {
  return d.files + d.insights * 2 + d.memorized * 3
}

function colorForIntensity(intensity: number): string {
  if (intensity <= 0) return 'rgba(148,163,184,0.10)'
  const alpha = 0.18 + intensity * 0.62
  return `rgba(56,189,248,${alpha.toFixed(3)})`
}

function fmtDateLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function mondayOf(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay() // 0=Sun..6=Sat
  const delta = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + delta)
  d.setHours(0, 0, 0, 0)
  return d
}

function isoDayLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ActivityHotspotBlock({
  days,
  loading = false,
  startIso,
  endIso,
  onSelectDate,
}: ActivityHotspotBlockProps) {
  const [hoverDate, setHoverDate] = useState<string | null>(null)

  const dayMap = useMemo(() => {
    const m = new Map<string, DashboardDay>()
    for (const d of days) m.set(d.date, d)
    return m
  }, [days])

  const weeks = useMemo(() => {
    const start = new Date(startIso + 'T00:00:00')
    const end = new Date(endIso + 'T00:00:00')
    const firstMonday = mondayOf(start)

    // Collect models with raw score, then normalize.
    const cellList: CellModel[] = []
    const cursor = new Date(firstMonday)
    while (cursor <= end || cursor.getDay() !== 1) {
      const dateStr = isoDayLocal(cursor)
      const data = dayMap.get(dateStr)
      const score = data ? activityScore({
        files: data.files_modified,
        insights: data.insights_logged,
        memorized: data.memorized_sessions,
      }) : 0
      cellList.push({
        date: dateStr,
        files: data?.files_modified ?? 0,
        insights: data?.insights_logged ?? 0,
        memorized: data?.memorized_sessions ?? 0,
        intensity: score, // raw — normalized below
      })
      cursor.setDate(cursor.getDate() + 1)
      if (cellList.length > 53 * 7) break
    }

    const maxScore = cellList.reduce((m, c) => (c.intensity > m ? c.intensity : m), 0)
    for (const c of cellList) {
      c.intensity = maxScore > 0 ? Math.min(1, c.intensity / maxScore) : 0
    }

    // Group into weeks (columns) of 7 (rows: Mon..Sun)
    const w: CellModel[][] = []
    for (let i = 0; i < cellList.length; i += 7) {
      w.push(cellList.slice(i, i + 7))
    }
    return w
  }, [dayMap, startIso, endIso])

  const monthHeaders = useMemo(() => {
    const headers: Array<{ col: number; label: string }> = []
    let lastMonth = -1
    weeks.forEach((week, idx) => {
      const first = week[0]
      if (!first) return
      const m = new Date(first.date + 'T00:00:00').getMonth()
      if (m !== lastMonth) {
        headers.push({ col: idx, label: MONTH_LABELS[m] })
        lastMonth = m
      }
    })
    return headers
  }, [weeks])

  const hovered = hoverDate ? dayMap.get(hoverDate) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Hotspot</h3>
          <p className="text-xs text-muted-foreground">
            How much you worked across the range. Brighter = more activity.
          </p>
        </div>
        <Legend />
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/40 p-4 shadow-sm backdrop-blur">
        {loading ? (
          <div className="h-32 w-full animate-pulse rounded-lg bg-muted/20" />
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Month labels */}
              <div className="ml-7 mb-1 flex" style={{ gap: 3 }}>
                {weeks.map((_, idx) => {
                  const header = monthHeaders.find((h) => h.col === idx)
                  return (
                    <div key={idx} className="w-[12px] text-[10px] text-muted-foreground">
                      {header?.label ?? ''}
                    </div>
                  )
                })}
              </div>

              <div className="flex">
                {/* Weekday labels */}
                <div className="mr-1 flex flex-col" style={{ gap: 3 }}>
                  {WEEKDAY_LABELS.map((label, i) => (
                    <div
                      key={i}
                      className="flex h-[12px] w-6 items-center text-[10px] text-muted-foreground"
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Cells grid */}
                <div className="flex" style={{ gap: 3 }}>
                  {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col" style={{ gap: 3 }}>
                      {week.map((cell) => {
                        const isHover = hoverDate === cell.date
                        const inRange = cell.date >= startIso && cell.date <= endIso
                        return (
                          <button
                            key={cell.date}
                            type="button"
                            onClick={() => onSelectDate?.(cell.date)}
                            onMouseEnter={() => setHoverDate(cell.date)}
                            onMouseLeave={() => setHoverDate((d) => (d === cell.date ? null : d))}
                            className={cn(
                              'h-[12px] w-[12px] rounded-[3px] transition-all',
                              isHover && 'ring-1 ring-foreground/60',
                              !inRange && 'opacity-30',
                            )}
                            style={{ background: colorForIntensity(cell.intensity) }}
                            aria-label={cell.date}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hover detail line */}
        <div className="mt-3 min-h-[1.5rem] text-xs">
          {hovered ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-muted-foreground">
              <span className="font-medium text-foreground/80">{fmtDateLong(hovered.date)}</span>
              <span><strong className="tabular-nums text-foreground/80">{hovered.files_modified}</strong> files</span>
              <span><strong className="tabular-nums text-foreground/80">{hovered.insights_logged}</strong> insights</span>
              <span><strong className="tabular-nums text-foreground/80">{hovered.memorized_sessions}</strong> memorized</span>
            </div>
          ) : (
            <span className="text-muted-foreground/60">Hover a day for details.</span>
          )}
        </div>
      </div>
    </div>
  )
}

function Legend() {
  const stops = [0, 0.2, 0.4, 0.6, 0.85]
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span>Less</span>
      <div className="flex" style={{ gap: 3 }}>
        {stops.map((s) => (
          <div
            key={s}
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ background: colorForIntensity(s) }}
          />
        ))}
      </div>
      <span>More</span>
    </div>
  )
}
