import { useEffect, useRef, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { type CodexUsageMetricBlock } from '@/services/lego_blocks/units/codexUsageProbeBlock'

const CHART_TONE_BLOCK: Record<CodexUsageMetricBlock['tone'], string> = {
  healthy: '#3ecf8e',
  warning: '#f4b860',
  critical: '#ef6b73',
}

const BAR_HEIGHT_PX = 10
const BAR_GAP_PX = 12
const CHART_PADDING_PX = 8

function useIsDarkBlock(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    obs.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

// Custom tick that truncates long label strings so they never wrap
function CustomTickBlock(props: Record<string, unknown> & { fill: string }) {
  const { x, y, payload, fill } = props
  const label = (payload as { value?: string } | undefined)?.value ?? ''
  const truncated = label.length > 20 ? `${label.slice(0, 18)}…` : label
  return (
    <text x={x as number} y={y as number} fill={fill} fontSize={11} textAnchor="end" dominantBaseline="middle">
      {truncated}
    </text>
  )
}

export interface CodexUsageMetricChartBlockProps {
  metrics: CodexUsageMetricBlock[]
}

export default function CodexUsageMetricChartBlock({ metrics }: CodexUsageMetricChartBlockProps) {
  const isDark = useIsDarkBlock()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hasPositiveSize, setHasPositiveSize] = useState(false)
  if (metrics.length === 0) return null

  const tickColor = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.50)'
  const barBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
  const chartHeight = metrics.length * (BAR_HEIGHT_PX + BAR_GAP_PX) + CHART_PADDING_PX

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const updateSizeState = () => {
      setHasPositiveSize(node.clientWidth > 0 && node.clientHeight > 0)
    }

    updateSizeState()
    const observer = new ResizeObserver(() => updateSizeState())
    observer.observe(node)
    return () => observer.disconnect()
  }, [chartHeight, metrics.length])

  return (
    <div ref={containerRef} style={{ height: chartHeight }} className="min-w-0 w-full">
      {hasPositiveSize && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={metrics}
            layout="vertical"
            margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
            barCategoryGap={BAR_GAP_PX}
            barSize={BAR_HEIGHT_PX}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="label"
              width={112}
              axisLine={false}
              tickLine={false}
              tick={(props) => <CustomTickBlock {...(props as Record<string, unknown>)} fill={tickColor} />}
            />
            <Bar dataKey="remainingPercent" radius={[3, 3, 3, 3]} background={{ fill: barBg, radius: 3 }}>
              {metrics.map((metric) => (
                <Cell key={`${metric.label}:${metric.remainingPercent}`} fill={CHART_TONE_BLOCK[metric.tone]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
