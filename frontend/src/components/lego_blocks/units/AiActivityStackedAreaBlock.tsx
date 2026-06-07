import { useMemo, useRef, useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
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
}: AiActivityStackedAreaBlockProps) {
  const visibleProjects = useMemo(() => {
    let list = projects
    if (hideNoise) list = list.filter(p => !p.isNoise)
    if (filterProject) list = list.filter(p => p.name === filterProject)
    return list
  }, [projects, hideNoise, filterProject])

  const data = useMemo(() => {
    return days.map(d => {
      const row: Record<string, number | string> = { date: d.date }
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
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
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
                if (rows.length === 0) return null
                return (
                  <div className="rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
                    <div className="text-foreground/70">{formatTooltipDate(label as string)}</div>
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
                  </div>
                )
              }}
            />
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
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
