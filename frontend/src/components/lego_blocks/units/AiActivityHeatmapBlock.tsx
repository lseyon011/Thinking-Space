import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ActivityDay } from '@/components/lego_blocks/hooks/shared/useAiActivityBlock'
import { getProjectColor } from '@/components/lego_blocks/units/aiActivityColorsBlock'

interface AiActivityHeatmapBlockProps {
  days: ActivityDay[]
  loading?: boolean
  startIso: string
  endIso: string
  /** When set, the heatmap tints cells by that project's color and intensity. */
  filterProject?: string | null
  /** Currently selected day (chord-clicked). */
  selectedDate?: string | null
  onSelectDate?: (date: string | null) => void
  /** Range selection — used for multi-day comparison. */
  selectedRange?: { startIso: string; endIso: string } | null
  onSelectRange?: (range: { startIso: string; endIso: string } | null) => void
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

function mondayOf(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay()
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

function fmtDateLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface CellModel {
  date: string
  msgs: number
  intensity: number
  /** Top project on that day (used for default tint when no project filter is set). */
  topProject: string | null
}

export default function AiActivityHeatmapBlock({
  days,
  loading = false,
  startIso,
  endIso,
  filterProject = null,
  selectedDate = null,
  onSelectDate,
  selectedRange = null,
  onSelectRange,
}: AiActivityHeatmapBlockProps) {
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [dragAnchor, setDragAnchor] = useState<string | null>(null)

  const dayMap = useMemo(() => {
    const m = new Map<string, ActivityDay>()
    for (const d of days) m.set(d.date, d)
    return m
  }, [days])

  const weeks = useMemo(() => {
    const start = new Date(startIso + 'T00:00:00')
    const end = new Date(endIso + 'T00:00:00')
    const firstMonday = mondayOf(start)

    const cells: CellModel[] = []
    const cursor = new Date(firstMonday)
    while (cursor <= end || cursor.getDay() !== 1) {
      const date = isoDayLocal(cursor)
      const d = dayMap.get(date)
      let msgs = 0
      let topProject: string | null = null
      if (d) {
        if (filterProject) {
          msgs = d.byProject[filterProject] ?? 0
          topProject = filterProject
        } else {
          msgs = d.totalMsgs
          // Top project by msg count; ignore noise buckets for the tint hint.
          let topMsgs = 0
          for (const [name, n] of Object.entries(d.byProject)) {
            const isNoise = name.startsWith('[') && name.endsWith(']')
            if (isNoise) continue
            if (n > topMsgs) {
              topMsgs = n
              topProject = name
            }
          }
        }
      }
      cells.push({ date, msgs, intensity: msgs, topProject })
      cursor.setDate(cursor.getDate() + 1)
      if (cells.length > 53 * 7) break
    }

    const max = cells.reduce((m, c) => (c.intensity > m ? c.intensity : m), 0)
    for (const c of cells) c.intensity = max > 0 ? Math.min(1, c.intensity / max) : 0

    const w: CellModel[][] = []
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7))
    return w
  }, [dayMap, startIso, endIso, filterProject])

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

  function cellBackground(cell: CellModel): string {
    if (cell.intensity <= 0) return 'rgba(148,163,184,0.08)'
    const colorName = filterProject ?? cell.topProject ?? 'LTM'
    const { stroke } = getProjectColor(colorName)
    // Reuse the rgb(r,g,b) channels with a computed alpha.
    const m = stroke.match(/rgb\((\d+),(\d+),(\d+)\)/)
    if (!m) return stroke
    const alpha = 0.18 + cell.intensity * 0.65
    return `rgba(${m[1]},${m[2]},${m[3]},${alpha.toFixed(3)})`
  }

  function isInActiveRange(date: string): boolean {
    if (!selectedRange) return false
    return date >= selectedRange.startIso && date <= selectedRange.endIso
  }

  function handleCellDown(date: string, e: React.MouseEvent) {
    if (e.shiftKey && selectedDate) {
      const a = selectedDate < date ? selectedDate : date
      const b = selectedDate < date ? date : selectedDate
      onSelectRange?.({ startIso: a, endIso: b })
      onSelectDate?.(null)
      return
    }
    setDragAnchor(date)
  }

  function handleCellUp(date: string) {
    if (dragAnchor && dragAnchor !== date) {
      const a = dragAnchor < date ? dragAnchor : date
      const b = dragAnchor < date ? date : dragAnchor
      onSelectRange?.({ startIso: a, endIso: b })
      onSelectDate?.(null)
    } else {
      // Single click toggles: clicking the selected day clears it.
      onSelectRange?.(null)
      onSelectDate?.(selectedDate === date ? null : date)
    }
    setDragAnchor(null)
  }

  return (
    <div className="space-y-2">
      {loading ? (
        <div className="h-32 w-full animate-pulse rounded-lg bg-muted/20" />
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="ml-7 mb-1 flex" style={{ gap: 3 }}>
              {weeks.map((_, idx) => {
                const header = monthHeaders.find(h => h.col === idx)
                return (
                  <div key={idx} className="w-[12px] text-[10px] text-muted-foreground">
                    {header?.label ?? ''}
                  </div>
                )
              })}
            </div>
            <div className="flex">
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
              <div className="flex" style={{ gap: 3 }} onMouseLeave={() => setDragAnchor(null)}>
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col" style={{ gap: 3 }}>
                    {week.map(cell => {
                      const isHover = hoverDate === cell.date
                      const inRange = cell.date >= startIso && cell.date <= endIso
                      const isSelected = selectedDate === cell.date
                      const inActiveRange = isInActiveRange(cell.date)
                      return (
                        <button
                          key={cell.date}
                          type="button"
                          onMouseDown={e => handleCellDown(cell.date, e)}
                          onMouseUp={() => handleCellUp(cell.date)}
                          onMouseEnter={() => setHoverDate(cell.date)}
                          onMouseLeave={() => setHoverDate(d => (d === cell.date ? null : d))}
                          className={cn(
                            'h-[12px] w-[12px] rounded-[3px] transition-all',
                            isHover && 'ring-1 ring-foreground/60',
                            (isSelected || inActiveRange) && 'ring-1 ring-foreground',
                            !inRange && 'opacity-30',
                          )}
                          style={{ background: cellBackground(cell) }}
                          aria-label={`${cell.date}: ${cell.msgs} messages`}
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
      <div className="min-h-[1.5rem] text-xs">
        {hovered ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-muted-foreground">
            <span className="font-medium text-foreground/80">{fmtDateLong(hovered.date)}</span>
            <span>
              <strong className="tabular-nums text-foreground/80">{hovered.totalMsgs}</strong> msgs
            </span>
            <span>
              <strong className="tabular-nums text-foreground/80">{hovered.totalChains}</strong> chains
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground/60">
            Hover for details · click a day for breakdown · shift-click for range
          </span>
        )}
      </div>
    </div>
  )
}
