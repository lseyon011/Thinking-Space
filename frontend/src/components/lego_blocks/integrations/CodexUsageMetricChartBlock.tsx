import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { type CodexUsageMetricBlock } from '@/services/lego_blocks/units/codexUsageProbeBlock'

const CHART_TONE_BLOCK: Record<CodexUsageMetricBlock['tone'], string> = {
  healthy: '#3ecf8e',
  warning: '#f4b860',
  critical: '#ef6b73',
}

export interface CodexUsageMetricChartBlockProps {
  metrics: CodexUsageMetricBlock[]
}

export default function CodexUsageMetricChartBlock({ metrics }: CodexUsageMetricChartBlockProps) {
  if (metrics.length === 0) return null

  return (
    <div className="h-[148px] w-full rounded-2xl border border-white/10 bg-black/20 px-2 py-2">
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
            tick={{ fill: 'rgba(255,255,255,0.72)', fontSize: 11 }}
          />
          <Bar dataKey="remainingPercent" radius={[7, 7, 7, 7]} background={{ fill: 'rgba(255,255,255,0.08)', radius: 7 }}>
            {metrics.map((metric) => (
              <Cell key={`${metric.label}:${metric.remainingPercent}`} fill={CHART_TONE_BLOCK[metric.tone]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
