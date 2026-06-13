import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useAiActivityBlock } from '@/components/lego_blocks/hooks/shared/useAiActivityBlock'
import {
  fmtDurationMsBlock,
  mergedDurationMsBlock,
  projectDigestBlock,
} from '@/services/lego_blocks/units/aiActivityStatsBlock'
import { getProjectColor } from '@/components/lego_blocks/units/aiActivityColorsBlock'

function mondayOf(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow))
  d.setHours(0, 0, 0, 0)
  return d
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtMonthDay(d: Date): string {
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
}

export default function ThisWeekDigestBlock() {
  // 30d covers the current week with the least data to parse. The card filters
  // down to Monday→now itself, so the preset only needs to be wide enough.
  const activity = useAiActivityBlock('30d')

  const weekStart = useMemo(() => mondayOf(new Date()), [])
  const weekLabel = `${fmtMonthDay(weekStart)} – ${fmtMonthDay(new Date())}`

  // This week's chains, excluding noise buckets ([auto-commit], [telegram]) so
  // the digest matches the project-grounded view in the AI activity panel.
  const weekChains = useMemo(() => {
    const startMs = weekStart.getTime()
    return activity.chains.filter(c => {
      if (c.project.startsWith('[') && c.project.endsWith(']')) return false
      const t = Date.parse(c.startedIso)
      return Number.isFinite(t) && t >= startMs
    })
  }, [activity.chains, weekStart])

  const digest = useMemo(() => projectDigestBlock(weekChains), [weekChains])

  const summary = useMemo(() => {
    const msgs = weekChains.reduce((n, c) => n + c.msgCount, 0)
    return {
      durLabel: fmtDurationMsBlock(mergedDurationMsBlock(weekChains)),
      chains: weekChains.length,
      msgs,
    }
  }, [weekChains])

  // Scroll affordance: the digest list often overflows the card, but the
  // overflow isn't visible without a hint. Track edge positions to show
  // top/bottom chevrons only when there's more content in that direction.
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [canUp, setCanUp] = useState(false)
  const [canDown, setCanDown] = useState(false)

  const syncScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanUp(el.scrollTop > 4)
    setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
  }, [])

  useEffect(() => {
    syncScroll()
    const el = scrollRef.current
    if (!el) return
    const obs = new ResizeObserver(syncScroll)
    obs.observe(el)
    return () => obs.disconnect()
  }, [syncScroll, digest])

  const scrollByPage = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ top: dir * el.clientHeight * 0.8, behavior: 'smooth' })
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">This week</h3>
          <p className="text-xs text-muted-foreground">{weekLabel} · what you worked on with AI</p>
        </div>
        {summary.chains > 0 && (
          <div className="flex items-baseline gap-3 text-xs text-muted-foreground">
            <span>
              <strong className="tabular-nums text-foreground/85">{summary.durLabel}</strong>
            </span>
            <span>
              <strong className="tabular-nums text-foreground/85">{summary.chains}</strong> chains
            </span>
            <span>
              <strong className="tabular-nums text-foreground/85">{summary.msgs.toLocaleString()}</strong> msgs
            </span>
          </div>
        )}
      </div>

      <div className="relative mt-3 flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={syncScroll}
        className="h-full overflow-y-auto rounded-2xl border border-border/40 bg-card/40 p-4 shadow-sm backdrop-blur"
      >
        {activity.loading ? (
          <div className="space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted/20" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted/20" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-muted/20" />
          </div>
        ) : digest.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">No AI activity yet this week.</p>
        ) : (
          <div className="space-y-3">
            {digest.map(d => {
              const color = getProjectColor(d.project)
              return (
                <div key={d.project} className="space-y-0.5">
                  <div className="flex items-baseline gap-2 text-[11px]">
                    <span
                      className="inline-flex items-center gap-1.5 font-medium"
                      style={{ color: color.stroke }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: color.stroke }}
                      />
                      {d.project}
                    </span>
                    <span className="tabular-nums text-foreground/70">
                      {fmtDurationMsBlock(d.durationMs)}
                    </span>
                    <span className="tabular-nums text-muted-foreground/60">
                      {d.chains} chain{d.chains === 1 ? '' : 's'} · {d.msgs.toLocaleString()} msgs
                    </span>
                  </div>
                  {d.topics.length > 0 && (
                    <ul className="space-y-0.5 pl-3.5 text-[11px] text-muted-foreground">
                      {d.topics.map((t, i) => (
                        <li key={i} className="truncate" title={t}>
                          · {t}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {canUp && (
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label="Scroll up"
          className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border/40 bg-background/85 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      )}
      {canDown && (
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label="Scroll down"
          className="absolute bottom-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border/40 bg-background/85 text-muted-foreground shadow-sm backdrop-blur transition hover:text-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
      </div>
    </div>
  )
}
