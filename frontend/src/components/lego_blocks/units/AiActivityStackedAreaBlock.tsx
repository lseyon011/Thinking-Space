import { useMemo, useRef, useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  ActivityDay,
  ActivityProject,
} from '@/components/lego_blocks/hooks/shared/useAiActivityBlock'
import { getProjectColor } from '@/components/lego_blocks/units/aiActivityColorsBlock'

interface AiActivityStackedAreaBlockProps {
  days: ActivityDay[]
  projects: ActivityProject[]
  /** When set, only that project's series is plotted (solo view). */
  filterProject?: string | null
  /** Hide noise buckets ([auto-commit], [telegram]). */
  hideNoise?: boolean
  /** Currently selected day — for visual selection state if we want it later. */
  selectedDate?: string | null
  /** Click on a data point selects/unselects that day. Mirrors the heatmap. */
  onSelectDate?: (date: string | null) => void
  /** Render the per-day session count as a small pill above each peak. */
  showSessionCounts?: boolean
}

function formatTickDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTooltipDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function AiActivityStackedAreaBlock({
  days,
  projects,
  filterProject = null,
  hideNoise = true,
  selectedDate = null,
  onSelectDate,
  showSessionCounts = false,
}: AiActivityStackedAreaBlockProps) {
  const visibleProjects = useMemo(() => {
    let list = projects
    if (hideNoise) list = list.filter(p => !p.isNoise)
    if (filterProject) list = list.filter(p => p.name === filterProject)
    return list
  }, [projects, hideNoise, filterProject])

  // Chain count per day — surfaced in the tooltip so a hover shows how many
  // distinct sessions ran that day on top of the per-project msg breakdown.
  // Key by date, not stuffed into the row, so recharts doesn't try to plot it.
  const chainsByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of days) m.set(d.date, d.totalChains)
    return m
  }, [days])

  const data = useMemo(() => {
    return days.map(d => {
      const row: Record<string, number | string> = {
        date: d.date,
        // Session count stashed on the row so the invisible "labels line"
        // below can pull it via dataKey for the per-day numeric label.
        __sessionCount: d.totalChains,
      }
      for (const p of visibleProjects) {
        row[p.name] = d.byProject[p.name] ?? 0
      }
      return row
    })
  }, [days, visibleProjects])

  const yMax = useMemo(() => {
    let max = 0
    for (const row of data) {
      let sum = 0
      for (const p of visibleProjects) sum += (row[p.name] as number) ?? 0
      if (sum > max) max = sum
    }
    return Math.max(1, Math.ceil(max * 1.15))
  }, [data, visibleProjects])

  // Anchor each session-count label just above that day's stacked peak —
  // following the curve so labels hover over the silhouette, not pinned to the
  // chart top. The anchor is the sum of visible project msgs for the day; the
  // LabelList offset (`position="top"`) lifts it a few px above the area.
  const dataWithAnchor = useMemo(
    () =>
      data.map(row => {
        let stack = 0
        for (const p of visibleProjects) stack += (row[p.name] as number) ?? 0
        return { ...row, __topAnchor: stack }
      }),
    [data, visibleProjects],
  )

  const hostRef = useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const node = hostRef.current
    if (!node) return
    const tick = () => setReady(node.clientWidth > 0 && node.clientHeight > 0)
    tick()
    const obs = new ResizeObserver(tick)
    obs.observe(node)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={hostRef} className="h-44 min-w-0">
      {ready && (
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <AreaChart
            data={dataWithAnchor}
            margin={{ top: 18, right: 4, bottom: 0, left: -22 }}
            onClick={evt => {
              if (!onSelectDate) return
              // Recharts passes the active payload's row in `activeLabel`. Toggle:
              // clicking the already-selected day clears it (matches heatmap UX).
              const payload = evt as { activeLabel?: string } | null
              const clicked = payload?.activeLabel
              if (!clicked) return
              onSelectDate(selectedDate === clicked ? null : clicked)
            }}
            style={{ cursor: onSelectDate ? 'pointer' : 'default' }}
          >
            <defs>
              {visibleProjects.map(p => {
                const color = getProjectColor(p.name)
                const id = `claude-act-grad-${p.name.replace(/[^a-z0-9]/gi, '-')}`
                return (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color.fill} />
                    <stop offset="100%" stopColor={color.fill.replace(/[\d.]+\)/, '0)')} />
                  </linearGradient>
                )
              })}
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tickFormatter={formatTickDate}
              minTickGap={24}
            />
            <YAxis
              domain={[0, yMax]}
              tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.7)' }}
              tickLine={false}
              axisLine={false}
              width={28}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(148,163,184,0.4)', strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null
                const rows = payload
                  .filter(p => typeof p.value === 'number' && (p.value as number) > 0)
                  .reverse()
                const dateIso = String(label)
                const sessions = chainsByDate.get(dateIso) ?? 0
                if (rows.length === 0 && sessions === 0) return null
                return (
                  <div className="rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
                    <div className="flex items-baseline gap-2 text-foreground/70">
                      <span>{formatTooltipDate(dateIso)}</span>
                      <span className="ml-auto tabular-nums text-foreground/60">
                        {sessions} session{sessions === 1 ? '' : 's'}
                      </span>
                    </div>
                    {rows.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {rows.map(row => {
                          const color = getProjectColor(String(row.dataKey))
                          return (
                            <div key={String(row.dataKey)} className="flex items-baseline gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: color.stroke }}
                              />
                              <span className="text-foreground/80">{String(row.dataKey)}</span>
                              <span
                                className="ml-auto tabular-nums"
                                style={{ color: color.stroke }}
                              >
                                {row.value as number}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }}
            />
            {selectedDate && (
              <ReferenceLine
                x={selectedDate}
                stroke="rgba(148,163,184,0.9)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                ifOverflow="extendDomain"
              />
            )}
            {visibleProjects.map(p => {
              const color = getProjectColor(p.name)
              const id = `claude-act-grad-${p.name.replace(/[^a-z0-9]/gi, '-')}`
              return (
                <Area
                  key={p.name}
                  type="monotone"
                  dataKey={p.name}
                  stackId="1"
                  stroke={color.stroke}
                  strokeWidth={1.5}
                  fill={`url(#${id})`}
                  isAnimationActive
                  animationDuration={550}
                  animationEasing="ease-out"
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0, fill: color.stroke }}
                />
              )
            })}
            {/* Session-count labels — plotted as an invisible line that
                follows each day's stacked peak, with a LabelList rendering a
                small pill above each point. Toggled off by default; opt-in via
                the "counts" button in the panel header. Days with 0 sessions
                are suppressed regardless. */}
            {showSessionCounts && (
            <Line
              type="monotone"
              dataKey="__topAnchor"
              stroke="transparent"
              dot={false}
              isAnimationActive={false}
              activeDot={false}
              legendType="none"
            >
              <LabelList
                dataKey="__sessionCount"
                position="top"
                content={(props) => {
                  const { x, y, value } = props as {
                    x?: number
                    y?: number
                    value?: number | string
                  }
                  const n = typeof value === 'number' ? value : 0
                  if (n <= 0 || x == null || y == null) return null
                  // Pill badge: small rounded rect with the count inside.
                  // Width grows with digit count so '12' and '8' both look
                  // balanced.
                  const text = String(n)
                  const charW = 5.5
                  const padX = 4
                  const w = Math.max(14, text.length * charW + padX * 2)
                  const h = 13
                  const cx = x
                  const top = y - h - 2
                  return (
                    <g>
                      <rect
                        x={cx - w / 2}
                        y={top}
                        width={w}
                        height={h}
                        rx={h / 2}
                        ry={h / 2}
                        fill="rgba(241,245,249,0.92)"
                        stroke="rgba(148,163,184,0.25)"
                        strokeWidth={0.5}
                      />
                      <text
                        x={cx}
                        y={top + h / 2 + 3}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight={500}
                        fill="rgba(148,163,184,0.95)"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {text}
                      </text>
                    </g>
                  )
                }}
              />
            </Line>
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
