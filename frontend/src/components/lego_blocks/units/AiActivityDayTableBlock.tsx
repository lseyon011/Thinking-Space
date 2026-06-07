import { Fragment, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ActivityChain } from '@/services/lego_blocks/units/aiActivityParserBlock'
import { getProjectColor } from '@/components/lego_blocks/units/aiActivityColorsBlock'
import {
  estimateCostUsd,
  formatTokens,
  formatUsd,
  sumTokens,
} from '@/services/lego_blocks/units/aiPriceTableBlock'

interface AiActivityDayTableBlockProps {
  /** Title shown above the table (e.g. day or range label). */
  title: string
  /** Chains to display, in display order. */
  chains: ActivityChain[]
  /** Optional summary line above the table (e.g. "14 sessions · 176 msgs"). */
  summary?: string
  /** When set, rows whose project matches get a tinted background — mirrors the
   *  chip filter so the user can see which rows the filter is highlighting. */
  highlightProject?: string | null
  /** When set, rows whose calendar date doesn't match get a day-divider above
   *  them so the user can see when the table crosses midnight (overnight tail). */
  anchorDateIso?: string | null
  onBack?: () => void
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const suffix = h < 12 ? 'am' : 'pm'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

function fmtSpan(startIso: string, endIso: string): string {
  const a = fmtTime(startIso)
  const b = fmtTime(endIso)
  if (a === b) return a
  // If the end is on a later calendar day, suffix the end with +Nd so it's
  // unambiguous the session crossed midnight (or multiple). Otherwise "4:48pm–
  // 9:14am" reads like a 16-hour single sitting when it's really "started at
  // 4:48pm, came back the next morning."
  const sd = new Date(startIso)
  const ed = new Date(endIso)
  const startDay = Date.UTC(sd.getFullYear(), sd.getMonth(), sd.getDate())
  const endDay = Date.UTC(ed.getFullYear(), ed.getMonth(), ed.getDate())
  const dayDelta = Math.round((endDay - startDay) / 86_400_000)
  if (dayDelta > 0) return `${a}–${b} +${dayDelta}d`
  return `${a}–${b}`
}

function isoDayLocal(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtDividerDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function AiActivityDayTableBlock({
  title,
  chains,
  summary,
  highlightProject = null,
  anchorDateIso = null,
  onBack,
}: AiActivityDayTableBlockProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  // Sort by start time, oldest first for chronological reading.
  const sorted = useMemo(
    () => [...chains].sort((a, b) => Date.parse(a.startedIso) - Date.parse(b.startedIso)),
    [chains],
  )

  // Day totals across every chain — used for the footer line. Tokens come from
  // the underlying sessions; cost is summed per-model so each chain uses the
  // right price tier (opus/sonnet/gpt-5 differ a lot).
  const dayTotals = useMemo(() => {
    let totalCostUsd = 0
    // Split tokens into "real" usage (fresh input + output) vs cached (cache
    // reads + writes). Cached tokens are the bulk of the volume but the cheap
    // part of the bill — surfacing them as one blob hid the actual work being
    // done. Footer now shows fresh / cached separately.
    let totalFreshTokens = 0
    let totalCachedTokens = 0
    let chainsWithTokens = 0
    for (const c of sorted) {
      const chainTokens = sumTokens(c.sessions.map(s => s.tokens))
      const hasTokens =
        chainTokens.input + chainTokens.output + chainTokens.cacheRead + chainTokens.cacheCreation > 0
      if (hasTokens) {
        chainsWithTokens += 1
        const chainModel = c.sessions.find(s => s.model)?.model
        totalCostUsd += estimateCostUsd(chainTokens, chainModel)
        totalFreshTokens += chainTokens.input + chainTokens.output
        totalCachedTokens += chainTokens.cacheRead + chainTokens.cacheCreation
      }
    }
    return { totalCostUsd, totalFreshTokens, totalCachedTokens, chainsWithTokens }
  }, [sorted])

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          {summary && (
            <p className="text-[11px] text-muted-foreground/80">{summary}</p>
          )}
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-border/40 bg-card/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-border/70 hover:text-foreground"
          >
            ← back
          </button>
        )}
      </div>
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-4 text-xs text-muted-foreground/70">
          No sessions on this day.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/40 bg-card/40">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30 text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-3 py-1.5 font-medium">Time</th>
                <th className="px-3 py-1.5 font-medium">Project</th>
                <th className="px-3 py-1.5 text-right font-medium">Msgs</th>
                <th className="px-3 py-1.5 font-medium">Topic</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Track the last calendar date emitted so we can drop a divider
                // when the table crosses midnight. Initialise with anchor (the
                // day the user clicked) so the very first row doesn't get a
                // divider unless it's already on a different day.
                let lastDate = anchorDateIso ?? (sorted[0] ? isoDayLocal(sorted[0].startedIso) : null)
                return sorted.map(c => {
                  const rowDate = isoDayLocal(c.startedIso)
                  const showDivider = rowDate !== lastDate
                  lastDate = rowDate
                  const color = getProjectColor(c.project)
                  const isHighlighted = highlightProject != null && c.project === highlightProject
                  const isExpanded = expandedKey === c.key
                  const chainTokens = sumTokens(c.sessions.map(s => s.tokens))
                  const hasTokens =
                    chainTokens.input + chainTokens.output + chainTokens.cacheRead + chainTokens.cacheCreation > 0
                  const chainModel = c.sessions.find(s => s.model)?.model
                  const costUsd = hasTokens ? estimateCostUsd(chainTokens, chainModel) : 0
                  return (
                    <Fragment key={c.key}>
                      {showDivider && (
                        <tr className="border-y border-border/30 bg-muted/20">
                          <td colSpan={4} className="px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            {fmtDividerDate(rowDate)}
                            {anchorDateIso && rowDate > anchorDateIso && (
                              <span className="ml-1.5 text-muted-foreground/60">· overnight tail</span>
                            )}
                          </td>
                        </tr>
                      )}
                  <tr
                    className={cn(
                      'cursor-pointer border-b border-border/20 transition-colors last:border-0',
                      'hover:bg-foreground/[0.04]',
                      isHighlighted && 'ring-1 ring-inset ring-foreground/15',
                      isExpanded && 'bg-foreground/[0.04]',
                    )}
                    style={isHighlighted ? { background: color.chipBg } : undefined}
                    onClick={() => setExpandedKey(prev => (prev === c.key ? null : c.key))}
                  >
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-foreground/80">
                      {fmtSpan(c.startedIso, c.endedIso)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <span className="inline-flex items-center gap-1.5" style={{ color: color.stroke }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color.stroke }} />
                        {c.project}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-foreground/80">
                      {c.msgCount}
                    </td>
                    <td className="max-w-0 truncate px-3 py-1.5 text-foreground/70" title={c.topic}>
                      {c.topic}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-border/20 bg-foreground/[0.02]">
                      <td colSpan={4} className="px-3 py-2 text-[11px] text-muted-foreground">
                        {hasTokens ? (
                          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                            <span>
                              <strong className="tabular-nums text-foreground/80">
                                {formatTokens(chainTokens.input + chainTokens.cacheRead + chainTokens.cacheCreation)}
                              </strong>{' '}
                              input
                              <span className="ml-1 text-muted-foreground/70">
                                ({formatTokens(chainTokens.input)} fresh ·{' '}
                                {formatTokens(chainTokens.cacheRead)} cached ·{' '}
                                {formatTokens(chainTokens.cacheCreation)} writes)
                              </span>
                            </span>
                            <span>
                              <strong className="tabular-nums text-foreground/80">
                                {formatTokens(chainTokens.output)}
                              </strong>{' '}
                              output
                            </span>
                            <span>
                              ~<strong className="tabular-nums text-foreground/80">{formatUsd(costUsd)}</strong>{' '}
                              est.
                            </span>
                            {chainModel && (
                              <span className="rounded bg-muted/40 px-1.5 py-0.5 text-foreground/70">
                                {chainModel}
                              </span>
                            )}
                            <span className="text-muted-foreground/60">
                              · {c.sessions.length} session{c.sessions.length === 1 ? '' : 's'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60">
                            No token data — this chain came from the vault markdown source only.
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                    </Fragment>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
      )}
      {dayTotals.chainsWithTokens > 0 && (
        <div className="flex items-baseline justify-end gap-3 px-1 text-[11px] text-muted-foreground">
          <span title="Fresh input + output tokens — the real work, billed at full rate.">
            <strong className="tabular-nums text-foreground/80">
              {formatTokens(dayTotals.totalFreshTokens)}
            </strong>{' '}
            fresh
          </span>
          <span
            className="text-muted-foreground/70"
            title="Cache reads + cache writes — high volume, low cost."
          >
            +{formatTokens(dayTotals.totalCachedTokens)} cached
          </span>
          <span>
            ~<strong className="tabular-nums text-foreground/80">{formatUsd(dayTotals.totalCostUsd)}</strong>{' '}
            est.
          </span>
          {dayTotals.chainsWithTokens < sorted.length && (
            <span className="text-muted-foreground/60">
              (across {dayTotals.chainsWithTokens} of {sorted.length} chains)
            </span>
          )}
        </div>
      )}
    </div>
  )
}
