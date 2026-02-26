import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import MonthCalendar, { type DayData } from '@/components/lego_blocks/integrations/MonthCalendarBlock'
import MetricBlock from '@/components/lego_blocks/units/MetricBlock'
import ClickablePath from '@/components/lego_blocks/units/ClickablePathBlock'
import { Button } from '@/components/lego_blocks/units/ui/button'

export interface IdeaThoughtActivityItem {
  thought_id: string
  title: string | null
  file_path: string
  linked_at: string
  created_ts: number
  modified_ts: number
}

interface IdeaThoughtActivityBlockProps {
  ideaTitle: string
  items: IdeaThoughtActivityItem[]
}

type CalendarViewMode = 'month' | 'year'

interface YearMonthCell {
  month: number
  touchedThoughts: number
  events: number
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toLocalDateKey(ts: number): string {
  const d = new Date(ts * 1000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateKeyPrefix(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function formatDateLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function fileName(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

function sortByNewest<T extends { modified_ts: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.modified_ts - a.modified_ts)
}

function monthDaysFromItems(items: IdeaThoughtActivityItem[], year: number, month: number): DayData[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const createdByDay = new Map<string, number>()
  const modifiedByDay = new Map<string, number>()
  const prefix = dateKeyPrefix(year, month)

  for (const item of items) {
    const createdDate = toLocalDateKey(item.created_ts)
    const modifiedDate = toLocalDateKey(item.modified_ts)

    if (createdDate.startsWith(prefix)) {
      createdByDay.set(createdDate, (createdByDay.get(createdDate) ?? 0) + 1)
    }
    if (modifiedDate.startsWith(prefix) && modifiedDate !== createdDate) {
      modifiedByDay.set(modifiedDate, (modifiedByDay.get(modifiedDate) ?? 0) + 1)
    }
  }

  let maxTotal = 1
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${prefix}-${String(day).padStart(2, '0')}`
    const total = (createdByDay.get(key) ?? 0) + (modifiedByDay.get(key) ?? 0)
    if (total > maxTotal) maxTotal = total
  }

  const output: DayData[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${prefix}-${String(day).padStart(2, '0')}`
    const created = createdByDay.get(key) ?? 0
    const modified = modifiedByDay.get(key) ?? 0
    const total = created + modified
    const indicators: DayData['indicators'] = []
    if (created > 0) indicators.push({ color: '#10b981', label: String(created) })
    if (modified > 0) indicators.push({ color: '#3b82f6', label: String(modified) })
    output.push({
      date: key,
      intensity: total / maxTotal,
      indicators,
    })
  }

  return output
}

function yearCellsFromItems(items: IdeaThoughtActivityItem[], year: number): YearMonthCell[] {
  const cells: YearMonthCell[] = []

  for (let month = 1; month <= 12; month++) {
    const prefix = dateKeyPrefix(year, month)
    const touchedIds = new Set<string>()
    let events = 0

    for (const item of items) {
      const createdDate = toLocalDateKey(item.created_ts)
      const modifiedDate = toLocalDateKey(item.modified_ts)
      let touched = false

      if (createdDate.startsWith(prefix)) {
        events += 1
        touched = true
      }
      if (modifiedDate.startsWith(prefix) && modifiedDate !== createdDate) {
        events += 1
        touched = true
      }
      if (touched) {
        touchedIds.add(item.thought_id)
      }
    }

    cells.push({
      month,
      touchedThoughts: touchedIds.size,
      events,
    })
  }

  return cells
}

export default function IdeaThoughtActivityBlock({ ideaTitle, items }: IdeaThoughtActivityBlockProps) {
  const now = new Date()
  const [calendarMode, setCalendarMode] = useState<CalendarViewMode>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const sortedItems = useMemo(() => sortByNewest(items), [items])
  const monthDays = useMemo(() => monthDaysFromItems(items, year, month), [items, month, year])
  const monthPrefix = dateKeyPrefix(year, month)
  const monthLabel = formatMonthLabel(year, month)

  const mostRecent = useMemo(() => sortedItems[0] ?? null, [sortedItems])

  const activeDaysThisMonth = useMemo(
    () => monthDays.filter(day => (day.indicators?.length ?? 0) > 0).length,
    [monthDays],
  )

  const touchedThisMonth = useMemo(() => {
    const ids = new Set<string>()
    for (const item of items) {
      const createdDate = toLocalDateKey(item.created_ts)
      const modifiedDate = toLocalDateKey(item.modified_ts)
      if (createdDate.startsWith(monthPrefix) || modifiedDate.startsWith(monthPrefix)) {
        ids.add(item.thought_id)
      }
    }
    return ids.size
  }, [items, monthPrefix])

  const touchedThisYear = useMemo(() => {
    const prefix = `${year}-`
    const ids = new Set<string>()
    for (const item of items) {
      const createdDate = toLocalDateKey(item.created_ts)
      const modifiedDate = toLocalDateKey(item.modified_ts)
      if (createdDate.startsWith(prefix) || modifiedDate.startsWith(prefix)) {
        ids.add(item.thought_id)
      }
    }
    return ids.size
  }, [items, year])

  const bySelectedDate = useMemo(() => {
    if (!selectedDate) return []
    return sortedItems.filter(item => {
      const createdDate = toLocalDateKey(item.created_ts)
      const modifiedDate = toLocalDateKey(item.modified_ts)
      return createdDate === selectedDate || modifiedDate === selectedDate
    })
  }, [selectedDate, sortedItems])

  const yearCells = useMemo(() => yearCellsFromItems(items, year), [items, year])
  const maxYearTouched = useMemo(
    () => Math.max(1, ...yearCells.map(cell => cell.touchedThoughts)),
    [yearCells],
  )

  const currentYear = new Date().getFullYear()
  const canGoNextYear = year < currentYear

  const visibleItems = selectedDate ? bySelectedDate : sortedItems

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[clamp(240px,28vw,360px)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Activity Calendar</CardTitle>
            <CardDescription>
              {calendarMode === 'month'
                ? `${monthLabel}`
                : `${year} overview`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {calendarMode === 'month' ? (
              <>
                <MonthCalendar
                  year={year}
                  month={month}
                  days={monthDays}
                  selectedDate={selectedDate}
                  onSelectDate={date => {
                    setSelectedDate(prev => (prev === date ? null : date))
                  }}
                  onMonthChange={(nextYear, nextMonth) => {
                    setYear(nextYear)
                    setMonth(nextMonth)
                    setSelectedDate(null)
                  }}
                  colorScale="blue"
                  compact
                />
                <div className="flex items-center gap-3 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-emerald-500" />
                    Created
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-blue-500" />
                    Modified
                  </span>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      setYear(prev => prev - 1)
                      setSelectedDate(null)
                    }}
                    title="Previous year"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-sm font-medium">{year}</div>
                  <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                    onClick={() => {
                      if (!canGoNextYear) return
                      setYear(prev => prev + 1)
                      setSelectedDate(null)
                    }}
                    disabled={!canGoNextYear}
                    title="Next year"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {yearCells.map(cell => {
                    const intensity = cell.touchedThoughts / maxYearTouched
                    const bg = `rgba(59, 130, 246, ${0.08 + intensity * 0.32})`
                    return (
                      <button
                        key={`year-cell-${year}-${cell.month}`}
                        type="button"
                        className="rounded-lg border border-border/60 px-2 py-2 text-left transition-colors hover:bg-muted/40"
                        style={{ background: bg }}
                        onClick={() => {
                          setMonth(cell.month)
                          setCalendarMode('month')
                          setSelectedDate(null)
                        }}
                        title={`${MONTH_SHORT[cell.month - 1]} ${year}`}
                      >
                        <div className="text-[11px] font-medium">{MONTH_SHORT[cell.month - 1]}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {cell.touchedThoughts} touched
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{ideaTitle}</CardTitle>
            <CardDescription>
              All tagged thoughts for this level and its subtree.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricBlock label="Tagged thoughts" value={items.length} />
              <MetricBlock label="Touched this month" value={touchedThisMonth} />
              <MetricBlock label="Touched this year" value={touchedThisYear} />
              <MetricBlock label="Active days this month" value={activeDaysThisMonth} />
            </div>

            {selectedDate ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                <span className="font-medium text-foreground">{formatDateLabel(selectedDate)}</span>
                <span className="ml-2 text-muted-foreground">
                  {bySelectedDate.length} thought{bySelectedDate.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  className="ml-3 text-xs text-primary hover:underline"
                  onClick={() => setSelectedDate(null)}
                >
                  Clear day filter
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                Showing all tagged thoughts. Pick a day to filter.
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={calendarMode === 'month' ? 'default' : 'outline'}
                onClick={() => setCalendarMode('month')}
              >
                Month
              </Button>
              <Button
                size="sm"
                variant={calendarMode === 'year' ? 'default' : 'outline'}
                onClick={() => setCalendarMode('year')}
              >
                Year
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Tagged Thoughts</CardTitle>
          <CardDescription>
            {selectedDate
              ? `${visibleItems.length} thoughts for ${formatDateLabel(selectedDate)}`
              : `${visibleItems.length} total thoughts tagged at this level`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {visibleItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tagged thoughts found.</p>
          ) : (
            <div className="space-y-2">
              {visibleItems.map(item => (
                <div
                  key={`${item.thought_id}-${item.file_path}`}
                  className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {item.title || fileName(item.file_path)}
                      </div>
                      <ClickablePath path={item.file_path} className="text-xs text-muted-foreground">
                        {item.file_path}
                      </ClickablePath>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                      <div className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        {new Date(item.modified_ts * 1000).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <div>
                        {new Date(item.modified_ts * 1000).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {mostRecent && !selectedDate && (
        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          Most recent update: {formatDateLabel(toLocalDateKey(mostRecent.modified_ts))}
        </div>
      )}
    </div>
  )
}
