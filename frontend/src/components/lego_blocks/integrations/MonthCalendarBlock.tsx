import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface DayData {
  date: string
  intensity: number
  indicators?: Array<{ color: string; label: string }>
}

export interface MonthCalendarProps {
  year: number
  month: number
  days: DayData[]
  selectedDate?: string | null
  onSelectDate: (date: string) => void
  onMonthChange: (year: number, month: number) => void
  loading?: boolean
  maxMonth?: { year: number; month: number }
  colorScale?: string
  /** Compact mode renders smaller cells for sidebar use */
  compact?: boolean
}

const WEEKDAY_LABELS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WEEKDAY_LABELS_FULL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function getColorForIntensity(intensity: number, colorScale: string): string {
  if (intensity === 0) return 'transparent'
  const colors: Record<string, [number, number, number]> = {
    emerald: [16, 185, 129],
    blue: [59, 130, 246],
    violet: [139, 92, 246],
    amber: [245, 158, 11],
  }
  const [r, g, b] = colors[colorScale] ?? colors.emerald
  const alpha = 0.15 + intensity * 0.55
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function MonthCalendar({
  year,
  month,
  days,
  selectedDate,
  onSelectDate,
  onMonthChange,
  loading = false,
  maxMonth,
  colorScale = 'emerald',
  compact = false,
}: MonthCalendarProps) {
  const dayMap = useMemo(() => {
    const m = new Map<string, DayData>()
    for (const d of days) m.set(d.date, d)
    return m
  }, [days])

  const grid = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6

    const cells: Array<{ day: number; dateStr: string } | null> = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ day: d, dateStr })
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [year, month])

  const today = new Date().toISOString().slice(0, 10)

  const maxY = maxMonth?.year ?? new Date().getFullYear()
  const maxM = maxMonth?.month ?? (new Date().getMonth() + 1)
  const canGoForward = year < maxY || (year === maxY && month < maxM)

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    const years: number[] = []
    for (let y = current; y >= 2020; y--) years.push(y)
    return years
  }, [])

  const goPrev = () => {
    if (month === 1) onMonthChange(year - 1, 12)
    else onMonthChange(year, month - 1)
  }

  const goNext = () => {
    if (!canGoForward) return
    if (month === 12) onMonthChange(year + 1, 1)
    else onMonthChange(year, month + 1)
  }

  const weekdayLabels = compact ? WEEKDAY_LABELS_SHORT : WEEKDAY_LABELS_FULL
  const gap = compact ? 'gap-0.5' : 'gap-1.5'
  const cellH = compact ? 'h-8' : 'h-14 sm:h-16'

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-5 w-28 animate-pulse rounded bg-muted/60" />
          <div className="flex gap-0.5">
            <div className="h-7 w-7 animate-pulse rounded bg-muted/40" />
            <div className="h-7 w-7 animate-pulse rounded bg-muted/40" />
          </div>
        </div>
        <div className={`grid grid-cols-7 ${gap}`}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-muted/30" />
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className={`${cellH} animate-pulse rounded-md bg-muted/20`} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {/* Header: month/year nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            className={`rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground ${compact ? 'p-0.5' : 'p-1'}`}
          >
            <ChevronLeft className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </button>

          <div className={`flex items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
            <select
              value={month}
              onChange={e => onMonthChange(year, Number(e.target.value))}
              className={`
                appearance-none bg-muted/40 border border-border/30 rounded-lg font-semibold
                cursor-pointer hover:bg-muted/60 transition-colors
                focus:outline-none focus:ring-1 focus:ring-primary/50
                ${compact ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}
              `}
            >
              {(compact ? MONTH_SHORT : MONTH_NAMES).map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={e => onMonthChange(Number(e.target.value), month)}
              className={`
                appearance-none bg-muted/40 border border-border/30 rounded-lg font-semibold
                cursor-pointer hover:bg-muted/60 transition-colors
                focus:outline-none focus:ring-1 focus:ring-primary/50
                ${compact ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}
              `}
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button
            onClick={goNext}
            disabled={!canGoForward}
            className={`rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed ${compact ? 'p-0.5' : 'p-1'}`}
          >
            <ChevronRight className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </button>
        </div>
      </div>

      {/* Weekday labels */}
      <div className={`grid grid-cols-7 ${gap}`}>
        {weekdayLabels.map((label, i) => (
          <div
            key={i}
            className={`text-center font-medium text-muted-foreground ${
              compact ? 'text-[10px] py-0.5' : 'text-xs py-1'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={`grid grid-cols-7 ${gap}`}>
        {grid.map((cell, i) => {
          if (!cell) {
            return <div key={`empty-${i}`} className={cellH} />
          }

          const dayData = dayMap.get(cell.dateStr)
          const intensity = dayData?.intensity ?? 0
          const isSelected = selectedDate === cell.dateStr
          const isToday = cell.dateStr === today
          const bg = getColorForIntensity(intensity, colorScale)

          if (compact) {
            return (
              <button
                key={cell.dateStr}
                onClick={() => onSelectDate(cell.dateStr)}
                className={`
                  relative h-8 rounded-md text-center transition-all
                  hover:ring-1 hover:ring-foreground/20
                  ${isSelected
                    ? 'ring-2 ring-primary shadow-sm'
                    : isToday
                      ? 'ring-1 ring-foreground/20'
                      : ''
                  }
                `}
                style={{ background: bg }}
              >
                <span
                  className={`text-[11px] tabular-nums leading-none ${
                    isToday
                      ? 'font-bold text-primary'
                      : intensity > 0
                        ? 'font-medium text-foreground/90'
                        : 'text-foreground/50'
                  }`}
                >
                  {cell.day}
                </span>
                {dayData?.indicators && dayData.indicators.length > 0 && (
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {dayData.indicators.map((ind, j) => (
                      <span
                        key={j}
                        className="block h-1 w-1 rounded-full"
                        style={{ backgroundColor: ind.color }}
                      />
                    ))}
                  </div>
                )}
              </button>
            )
          }

          return (
            <button
              key={cell.dateStr}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`
                relative ${cellH} rounded-lg border text-left p-1.5 transition-all
                hover:border-foreground/30
                ${isSelected
                  ? 'ring-2 ring-primary border-primary/50'
                  : isToday
                    ? 'border-foreground/20'
                    : 'border-border/30'
                }
              `}
              style={{ background: bg }}
            >
              <span
                className={`text-xs tabular-nums ${
                  isToday ? 'font-bold text-primary' : 'text-foreground/70'
                }`}
              >
                {cell.day}
              </span>

              {dayData?.indicators && dayData.indicators.length > 0 && (
                <div className="absolute bottom-1 right-1.5 flex gap-1">
                  {dayData.indicators.map((ind, j) => (
                    <span
                      key={j}
                      className="text-[10px] font-semibold tabular-nums leading-none"
                      style={{ color: ind.color }}
                    >
                      {ind.label}
                    </span>
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
