import { useEffect, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { type CodexUsageMetricBlock } from '@/services/lego_blocks/units/codexUsageProbeBlock'

const CHART_TONE_BLOCK: Record<CodexUsageMetricBlock['tone'], string> = {
  healthy: '#3ecf8e',
  warning: '#f4b860',
  critical: '#ef6b73',
}

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

export interface CodexUsageMetricChartBlockProps {
  metrics: CodexUsageMetricBlock[]
}

export default function CodexUsageMetricChartBlock({ metrics }: CodexUsageMetricChartBlockProps) {
  const isDark = useIsDarkBlock()
  if (metrics.length === 0) return null

  const tickColor = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.55)'
  const barBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'

  return (
    <div className="h-[96px] w-full rounded-lg border border-black/8 bg-black/[0.04] px-2 py-2 dark:border-white/10 dark:bg-black/20">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={metrics}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
          barCategoryGap={14}
        >
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={96}
            axisLine={false}
            tickLine={false}
            tick={{ fill: tickColor, fontSize: 11 }}
          />
          <Bar dataKey="remainingPercent" radius={[7, 7, 7, 7]} background={{ fill: barBg, radius: 7 }}>
            {metrics.map((metric) => (
              <Cell key={`${metric.label}:${metric.remainingPercent}`} fill={CHART_TONE_BLOCK[metric.tone]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
