import { useEffect, useState } from 'react'
import {
  subscribeActivities,
  type BackgroundActivity,
} from '../../../services/lego_blocks/units/backgroundActivityBlock'

/**
 * Top-of-viewport banner that surfaces in-flight background work. Activities
 * shorter than `visibilityDelayMs` never render — prevents flicker for fast
 * reads. When the work has known total/completed, shows a determinate bar;
 * otherwise an indeterminate shimmer.
 */

interface Props {
  visibilityDelayMs?: number
}

export default function BackgroundActivityBannerBlock({ visibilityDelayMs = 300 }: Props) {
  const [activities, setActivities] = useState<BackgroundActivity[]>([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => subscribeActivities(setActivities), [])

  useEffect(() => {
    if (activities.length === 0) return
    // Tick once a second so the elapsed-time gate eventually allows late-arriving
    // long activities to render even if their state never updates.
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [activities.length])

  const visible = activities.filter(a => now - a.startedAt >= visibilityDelayMs)
  if (visible.length === 0) return null

  const primary = visible[0]
  const extras = visible.length - 1
  const hasDeterminate =
    typeof primary.total === 'number' &&
    primary.total > 0 &&
    typeof primary.completed === 'number'
  const pct = hasDeterminate
    ? Math.min(100, Math.max(0, ((primary.completed ?? 0) / (primary.total ?? 1)) * 100))
    : null

  return (
    <div
      className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[90]"
      style={{ top: 'calc(var(--ltm-safe-top, 0px) + 0.5rem)' }}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto rounded-full bg-zinc-900/90 backdrop-blur px-4 py-2 shadow-lg border border-zinc-700 text-zinc-100 text-xs flex items-center gap-3 min-w-[220px] max-w-[80vw]">
        <span
          className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{primary.label}</span>
            {extras > 0 && (
              <span className="text-[10px] text-zinc-400 whitespace-nowrap">+{extras} more</span>
            )}
          </div>
          {primary.detail && (
            <div className="truncate text-[10px] text-zinc-400">{primary.detail}</div>
          )}
          <div className="mt-1 h-1 rounded-full bg-zinc-700 overflow-hidden">
            {pct !== null ? (
              <div
                className="h-full bg-emerald-400 transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            ) : (
              <div className="h-full bg-emerald-400/70 animate-[ltm-bg-shimmer_1.2s_ease-in-out_infinite]" />
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes ltm-bg-shimmer {
          0% { transform: translateX(-100%); width: 40%; }
          50% { transform: translateX(120%); width: 40%; }
          100% { transform: translateX(260%); width: 40%; }
        }
      `}</style>
    </div>
  )
}
