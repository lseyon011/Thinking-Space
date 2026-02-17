interface MetricBlockProps {
  label: string
  value: string | number
  className?: string
}

export default function MetricBlock({ label, value, className }: MetricBlockProps) {
  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${className ?? ''}`}>{value}</div>
    </div>
  )
}
