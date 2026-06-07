import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActivityChain } from '@/services/lego_blocks/units/aiActivityParserBlock'
import { getProjectColor } from '@/components/lego_blocks/units/aiActivityColorsBlock'

interface AiActivityDayTimelineBlockProps {
  /** ISO day this timeline represents (anchor for the 00:00 baseline). */
  dateIso: string
  /** Chains belonging to that day (caller-filtered, already includes overnight tail). */
  chains: ActivityChain[]
  /** When set, non-matching pills dim so the active project's pills pop. */
  highlightProject?: string | null
}

const PIXELS_PER_HOUR = 32
const ROW_HEIGHT = 16
const ROW_GAP = 3
const MIN_PILL_PX = 8
const PILL_DEFAULT_DURATION_MIN = 15
// Slack: chains within this many pixels (~15 min) can share a row even if
// their bounding boxes technically overlap. Stops a flurry of short sessions
// from exploding the strip vertically.
const ROW_PACK_SLACK_PX = 14
// Cap the strip height so a busy day doesn't push everything below off-screen.
// Tall enough that ~20 stacked rows are visible without internal scrolling.
const STRIP_MAX_HEIGHT_PX = 440

function fmtHour(h: number): string {
  // h may exceed 24 for overnight tail — wrap to 0-23 for display.
  const display = ((h % 24) + 24) % 24
  const suffix = display < 12 ? 'a' : 'p'
  const hour12 = display % 12 === 0 ? 12 : display % 12
  return `${hour12}${suffix}`
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const suffix = h < 12 ? 'am' : 'pm'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

/**
 * Project chains onto a horizontal time strip for a single day. The strip
 * covers from earliest 00:00 (or first chain if it starts before 00:00 of the
 * selected day — shouldn't happen) up to 06:00 of the next day so overnight
 * sessions stay on the same row.
 */
export default function AiActivityDayTimelineBlock({
  dateIso,
  chains,
  highlightProject = null,
}: AiActivityDayTimelineBlockProps) {
  const [hoverId, setHoverId] = useState<string | null>(null)

  const dayStartMs = useMemo(
    () => Date.parse(dateIso + 'T00:00:00'),
    [dateIso],
  )

  // Compute axis: start at hour 0; end at the later of 24 and the latest
  // chain-end hour (rounded up), capped at 30 to avoid runaway widths.
  const { startHour, endHour } = useMemo(() => {
    if (chains.length === 0) return { startHour: 0, endHour: 24 }
    let latestHourFractional = 24
    for (const c of chains) {
      const startedH = (Date.parse(c.startedIso) - dayStartMs) / 3_600_000
      const endedH = (Date.parse(c.endedIso) - dayStartMs) / 3_600_000
      const lastTouched = Math.max(startedH, endedH) + PILL_DEFAULT_DURATION_MIN / 60
      if (lastTouched > latestHourFractional) latestHourFractional = lastTouched
    }
    return { startHour: 0, endHour: Math.min(30, Math.ceil(latestHourFractional)) }
  }, [chains, dayStartMs])

  const widthPx = (endHour - startHour) * PIXELS_PER_HOUR
  const hourTicks = useMemo(() => {
    const out: number[] = []
    for (let h = startHour; h <= endHour; h += 1) out.push(h)
    return out
  }, [startHour, endHour])

  // Lay chains out in rows; pack greedily so overlapping chains stack vertically.
  const placed = useMemo(() => {
    type Placed = {
      key: string
      chain: ActivityChain
      leftPx: number
      widthPx: number
      row: number
    }
    const sorted = [...chains].sort(
      (a, b) => Date.parse(a.startedIso) - Date.parse(b.startedIso),
    )
    const rowEnds: number[] = []
    const out: Placed[] = []
    for (const c of sorted) {
      const rawStartedH = (Date.parse(c.startedIso) - dayStartMs) / 3_600_000
      let rawEndedH = (Date.parse(c.endedIso) - dayStartMs) / 3_600_000
      if (rawEndedH < rawStartedH + PILL_DEFAULT_DURATION_MIN / 60) {
        rawEndedH = rawStartedH + PILL_DEFAULT_DURATION_MIN / 60
      }
      // Clamp the visible portion to the strip window. A session that started
      // before the selected day (long-running multi-day session) gets its left
      // edge pinned to the day's 0h; one that runs past the strip's end gets
      // its right edge pinned to endHour. Tooltip still shows the real times.
      const startedH = Math.max(rawStartedH, startHour)
      const endedH = Math.min(rawEndedH, endHour)
      if (endedH <= startedH) continue // entirely outside the visible window
      const leftPx = (startedH - startHour) * PIXELS_PER_HOUR
      const widthPx = Math.max(MIN_PILL_PX, (endedH - startedH) * PIXELS_PER_HOUR)
      let row = rowEnds.findIndex(end => end <= leftPx + ROW_PACK_SLACK_PX)
      if (row === -1) {
        row = rowEnds.length
        rowEnds.push(0)
      }
      rowEnds[row] = leftPx + widthPx
      out.push({ key: c.key, chain: c, leftPx, widthPx, row })
    }
    return { placed: out, rows: rowEnds.length }
  }, [chains, dayStartMs, startHour])

  if (chains.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground/70">
        No sessions on this day.
      </div>
    )
  }

  const stripHeight = placed.rows * (ROW_HEIGHT + ROW_GAP) - ROW_GAP

  // Pin hour axis below the strip; if the strip itself overflows vertically
  // (very busy day), it scrolls internally so the axis stays visible.
  const stripScrolls = stripHeight > STRIP_MAX_HEIGHT_PX

  // Horizontal-overflow affordances: chevrons + edge fades appear when there's
  // offscreen content. macOS overlay scrollbars hide the default affordance,
  // so without these the user has no idea more timeline exists to the right.
  const scrollWrapRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const el = scrollWrapRef.current
    if (!el) return
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 0)
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [widthPx, chains.length])

  const scrollBy = (direction: 'left' | 'right') => {
    const el = scrollWrapRef.current
    if (!el) return
    const delta = el.clientWidth * 0.5 * (direction === 'left' ? -1 : 1)
    el.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div className="relative">
    <div ref={scrollWrapRef} className="overflow-x-auto">
      <div className="relative" style={{ width: Math.max(widthPx, 320) }}>
        {/* Hour grid + pills */}
        <div
          className="relative"
          style={{
            height: stripScrolls ? STRIP_MAX_HEIGHT_PX : stripHeight,
            overflowY: stripScrolls ? 'auto' : 'visible',
          }}
        >
        <div className="relative" style={{ height: stripHeight }}>
          {hourTicks.slice(0, -1).map(h => {
            const x = (h - startHour) * PIXELS_PER_HOUR
            const isMidnight = h % 24 === 0 && h !== 0
            return (
              <div
                key={h}
                className="absolute top-0 bottom-0"
                style={{
                  left: x,
                  width: 1,
                  background: isMidnight
                    ? 'rgba(148,163,184,0.35)'
                    : 'rgba(148,163,184,0.10)',
                }}
              />
            )
          })}

          {placed.placed.map(({ key, chain, leftPx, widthPx, row }) => {
            const color = getProjectColor(chain.project)
            const isHover = hoverId === key
            const isHighlighted = highlightProject != null && chain.project === highlightProject
            const isDimmed = highlightProject != null && !isHighlighted
            // Pills use the project's chipBg as a soft fill with NO border —
            // borders were reading as dark outlines that fought the color
            // language. Hover/highlight states use a project-tinted ring so the
            // chrome stays in the same hue family as the pill itself.
            const ringStyle = (isHighlighted || isHover) ? color.stroke : undefined
            return (
              <button
                key={key}
                type="button"
                onMouseEnter={() => setHoverId(key)}
                onMouseLeave={() => setHoverId(h => (h === key ? null : h))}
                className={cn(
                  'absolute overflow-hidden rounded-md transition-all',
                  (isHover || isHighlighted) && 'z-10 shadow-sm',
                  isDimmed && 'opacity-30',
                )}
                style={{
                  left: leftPx,
                  width: widthPx,
                  top: row * (ROW_HEIGHT + ROW_GAP),
                  height: ROW_HEIGHT,
                  // Use the project's `fill` (≈45% alpha) instead of `chipBg`
                  // (≈15%) — chipBg was too faint to read at small pill sizes.
                  background: color.fill,
                  boxShadow: ringStyle
                    ? `inset 0 0 0 1.5px ${ringStyle}`
                    : undefined,
                }}
                title={`${fmtTime(chain.startedIso)}–${fmtTime(chain.endedIso)} · ${chain.project} · ${chain.msgCount} msgs — ${chain.topic}`}
                aria-label={`${chain.project} · ${chain.msgCount} msgs at ${fmtTime(chain.startedIso)}`}
              />
            )
          })}
        </div>
        </div>

        {/* Hour axis labels — outside the scrollable strip so they're always visible. */}
        <div className="relative mt-1" style={{ height: 12 }}>
          {hourTicks.map(h => {
            const x = (h - startHour) * PIXELS_PER_HOUR
            const isMidnight = h % 24 === 0 && h !== 0
            return (
              <div
                key={h}
                className={cn(
                  'absolute -translate-x-1/2 text-[9px] tabular-nums',
                  isMidnight ? 'font-semibold text-foreground/70' : 'text-muted-foreground/70',
                )}
                style={{ left: x }}
              >
                {fmtHour(h)}
              </div>
            )
          })}
        </div>
      </div>
    </div>

    {/* Edge fades hint at offscreen content; pointer-events-none so they don't
        block clicks on pills underneath. */}
    {canScrollLeft && (
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background/95 to-transparent"
        aria-hidden
      />
    )}
    {canScrollRight && (
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background/95 to-transparent"
        aria-hidden
      />
    )}

    {/* Chevron nav — anchored to the bottom corners so they sit on the hour
        axis row instead of overlapping pills in the strip. Smaller + softer
        than before to disappear visually when not needed. */}
    {canScrollLeft && (
      <button
        type="button"
        onClick={() => scrollBy('left')}
        className="absolute bottom-0 left-0 z-20 rounded-full border border-border/30 bg-background/85 p-0.5 text-muted-foreground shadow-sm transition-colors hover:border-border/60 hover:text-foreground"
        aria-label="Scroll timeline earlier"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
    )}
    {canScrollRight && (
      <button
        type="button"
        onClick={() => scrollBy('right')}
        className="absolute bottom-0 right-0 z-20 rounded-full border border-border/30 bg-background/85 p-0.5 text-muted-foreground shadow-sm transition-colors hover:border-border/60 hover:text-foreground"
        aria-label="Scroll timeline later"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    )}
    </div>
  )
}
