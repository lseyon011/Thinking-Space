import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { openVaultPathWithDefaultAppOrch } from '@/services/orchestrators/fileSystemOrch'
import {
  useAiActivityBlock,
  AI_ACTIVITY_PRESETS,
  type AiActivityPreset,
  type AiSourceFilter,
} from '@/components/lego_blocks/hooks/shared/useAiActivityBlock'
import AiActivityHeatmapBlock from '@/components/lego_blocks/units/AiActivityHeatmapBlock'
import AiActivityProjectChipsBlock from '@/components/lego_blocks/units/AiActivityProjectChipsBlock'
import AiActivityStackedAreaBlock from '@/components/lego_blocks/units/AiActivityStackedAreaBlock'
import AiActivityDayTableBlock from '@/components/lego_blocks/units/AiActivityDayTableBlock'
import AiActivityDayTimelineBlock from '@/components/lego_blocks/units/AiActivityDayTimelineBlock'

type ViewMode = 'heatmap' | 'trend'

function fmtDateShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function AiActivityPanelBlock() {
  const activity = useAiActivityBlock('90d')
  const [view, setView] = useState<ViewMode>('heatmap')
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedRange, setSelectedRange] = useState<{ startIso: string; endIso: string } | null>(
    null,
  )

  // Totals match what the chips show: signal projects only, noise buckets
  // ([auto-commit], [telegram]) excluded. This keeps "278 msgs" in the strip
  // equal to the sum of msgs across visible chips for the current range.
  const totals = useMemo(() => {
    let msgs = 0
    let chains = 0
    let sessions = 0
    for (const p of activity.projects) {
      if (p.isNoise) continue
      msgs += p.totalMsgs
      chains += p.totalChains
      sessions += p.totalSessions
    }
    return { msgs, chains, sessions }
  }, [activity.projects])

  const drillChains = useMemo(() => {
    if (selectedDate) {
      // Overnight-aware "day": chains starting between selectedDate 00:00 and
      // 06:00 the next morning still belong to the selected day, so a 2-3am
      // session at the end of a long night doesn't get orphaned onto tomorrow.
      const dayStart = Date.parse(selectedDate + 'T00:00:00')
      const nextMorningCutoff = dayStart + 30 * 3_600_000
      return activity.chains.filter(c => {
        const t = Date.parse(c.startedIso)
        return t >= dayStart && t < nextMorningCutoff
      })
    }
    if (selectedRange) {
      return activity.chains.filter(c => {
        const d = c.startedIso.slice(0, 10)
        return d >= selectedRange.startIso && d <= selectedRange.endIso
      })
    }
    return []
  }, [activity.chains, selectedDate, selectedRange])

  const drillTitle = selectedDate
    ? fmtDateShort(selectedDate)
    : selectedRange
      ? `${fmtDateShort(selectedRange.startIso)} → ${fmtDateShort(selectedRange.endIso)}`
      : ''

  const drillSummary = useMemo(() => {
    if (drillChains.length === 0) return undefined
    const msgs = drillChains.reduce((n, c) => n + c.msgCount, 0)
    const sessions = drillChains.reduce((n, c) => n + c.sessions.length, 0)
    return `${drillChains.length} chains · ${sessions} sessions · ${msgs} msgs`
  }, [drillChains])

  function clearDrill() {
    setSelectedDate(null)
    setSelectedRange(null)
  }

  // The canvas hides scrollbars globally on tile content, so a long drill table
  // looks cut off rather than scrollable. Track whether the inner scroll
  // container has overflow + is not at the end, and surface a bottom fade as
  // the visual "more below" affordance. Cleared when the user scrolls to the
  // bottom so the fade doesn't sit there on short days.
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [showBottomFade, setShowBottomFade] = useState(false)
  const [showTopFade, setShowTopFade] = useState(false)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      const overflow = el.scrollHeight - el.clientHeight
      if (overflow <= 1) {
        setShowBottomFade(false)
        setShowTopFade(false)
        return
      }
      setShowTopFade(el.scrollTop > 4)
      setShowBottomFade(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    // Children resizing (drill table appearing) also changes scrollHeight.
    const mo = new MutationObserver(update)
    mo.observe(el, { childList: true, subtree: true })
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
      mo.disconnect()
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Sticky header — title, range pills, totals stay visible while content
          below scrolls. Keeps the controls reachable on long drill-down tables. */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">AI activity</h3>
          <p className="text-xs text-muted-foreground">
            What you actually worked on with AI — sessions, msgs, projects over time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SourcePills
            value={activity.sourceFilter}
            onChange={next => {
              activity.setSourceFilter(next)
              clearDrill()
            }}
            counts={activity.sourceCounts}
          />
          <RangePills
            preset={activity.preset}
            onChange={p => {
              activity.setPreset(p)
              clearDrill()
            }}
          />
          <button
            type="button"
            onClick={activity.refresh}
            disabled={activity.loading}
            className="rounded-full border border-border/40 bg-muted/30 p-1.5 text-muted-foreground transition-colors hover:border-border/70 hover:text-foreground disabled:opacity-50"
            title="Refresh from vault"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', activity.loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Totals strip */}
      <div className="mt-2 flex items-baseline gap-4 text-xs text-muted-foreground">
        <span>
          <strong className="tabular-nums text-foreground/85">{totals.msgs.toLocaleString()}</strong> msgs
        </span>
        <span>
          <strong className="tabular-nums text-foreground/85">{totals.chains.toLocaleString()}</strong> chains
        </span>
        <span>
          <strong className="tabular-nums text-foreground/85">{totals.sessions.toLocaleString()}</strong> sessions
        </span>
        <LegacyArchivesLink />
        <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
          {activity.preset}
        </span>
      </div>

      {/* Everything below the header scrolls together. The canvas hides
          scrollbars globally, so the fade gradients above/below act as the
          "there's more content" affordance. */}
      <div className="relative mt-3 flex-1 min-h-0">
        {showTopFade && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b from-background to-transparent"
            aria-hidden
          />
        )}
        {showBottomFade && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-background to-transparent"
            aria-hidden
          />
        )}
        <div ref={scrollRef} className="h-full overflow-y-auto pr-1">
      <div>
        <AiActivityProjectChipsBlock
          projects={activity.projects}
          activeProject={activeProject}
          onSelect={setActiveProject}
        />
      </div>

      {activity.error && (
        <div className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {activity.error}
        </div>
      )}

      {/* Chart stays on top — heatmap or trend. Drill table appears below it
          when a day or range is selected, never replacing the chart. */}
      <div className="mt-3 space-y-3">
        <div className="flex items-center gap-1">
          <ViewToggle view={view} onChange={setView} />
          {activeProject && (
            <button
              type="button"
              onClick={() => setActiveProject(null)}
              className="ml-2 rounded-full border border-border/40 bg-card/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-border/70 hover:text-foreground"
            >
              clear filter · {activeProject}
            </button>
          )}
        </div>
        {view === 'heatmap' ? (
          <AiActivityHeatmapBlock
            days={activity.days}
            loading={activity.loading}
            startIso={activity.startIso}
            endIso={activity.endIso}
            filterProject={activeProject}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            selectedRange={selectedRange}
            onSelectRange={setSelectedRange}
          />
        ) : (
          <AiActivityStackedAreaBlock
            days={activity.days}
            projects={activity.projects}
            filterProject={activeProject}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}
      </div>

      {(selectedDate || selectedRange) && (
        <div className="mt-4 space-y-3 border-t border-border/30 pt-3">
          {selectedDate && drillChains.length > 0 && (
            <AiActivityDayTimelineBlock
              dateIso={selectedDate}
              chains={drillChains}
              highlightProject={activeProject}
            />
          )}
          <AiActivityDayTableBlock
            title={drillTitle}
            chains={drillChains}
            summary={drillSummary}
            highlightProject={activeProject}
            onBack={clearDrill}
          />
        </div>
      )}
        </div>
      </div>
    </div>
  )
}

function LegacyArchivesLink() {
  // ChatGPT and Grok exports live in the vault but aren't part of the active
  // dev rollup (no cwd → can't bucket by project). Surfaced as a small "open
  // in Finder" link so the panel feels complete without polluting the
  // project-grounded view.
  const [open, setOpen] = useState(false)
  const targets: Array<{ label: string; path: string }> = [
    { label: 'ChatGPT', path: 'ai_raw/raw/chatgpt' },
    { label: 'Grok', path: 'ai_raw/raw/grok' },
  ]
  const handleOpen = (path: string) => {
    setOpen(false)
    openVaultPathWithDefaultAppOrch(path).catch(err => {
      // Swallow but log — most likely cause is non-Electron platform.
      console.warn('[ai-activity] failed to open legacy archive:', err)
    })
  }
  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 rounded-full border border-border/30 bg-card/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground/80 transition-colors hover:border-border/60 hover:text-foreground"
        title="Open legacy ChatGPT / Grok archives in Finder"
      >
        <Archive className="h-3 w-3" />
        legacy
      </button>
      {open && (
        <>
          {/* Click-away catcher */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-border/50 bg-popover/95 p-1 text-xs shadow-lg backdrop-blur">
            {targets.map(t => (
              <button
                key={t.path}
                type="button"
                onClick={() => handleOpen(t.path)}
                className="block w-full rounded-md px-2 py-1 text-left text-foreground/85 hover:bg-muted/50"
              >
                Open {t.label} archive
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  )
}

function RangePills({
  preset,
  onChange,
}: {
  preset: AiActivityPreset
  onChange: (p: AiActivityPreset) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Range"
      className="flex shrink-0 items-center gap-1 rounded-full border border-border/40 bg-muted/30 p-1"
    >
      {AI_ACTIVITY_PRESETS.map(opt => {
        const active = opt.id === preset
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums transition-all',
              active
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function SourcePills({
  value,
  onChange,
  counts,
}: {
  value: AiSourceFilter
  onChange: (next: AiSourceFilter) => void
  counts: { claudeCode: number; codex: number }
}) {
  const opts: Array<{ id: AiSourceFilter; label: string; count: number | null }> = [
    { id: 'all', label: 'All', count: counts.claudeCode + counts.codex },
    { id: 'claude-code', label: 'Claude', count: counts.claudeCode },
    { id: 'codex', label: 'Codex', count: counts.codex },
  ]
  return (
    <div
      role="tablist"
      aria-label="AI source"
      className="flex shrink-0 items-center gap-1 rounded-full border border-border/40 bg-muted/30 p-1"
    >
      {opts.map(opt => {
        const active = opt.id === value
        // Disable empty single-source pills so a click can't navigate into an
        // empty view (but 'All' is always clickable even when there's no data).
        const disabled = opt.id !== 'all' && opt.count === 0
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all',
              active
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground',
            )}
            title={opt.count != null ? `${opt.count} sessions in range` : undefined}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode
  onChange: (v: ViewMode) => void
}) {
  const opts: Array<{ id: ViewMode; label: string }> = [
    { id: 'heatmap', label: 'heatmap' },
    { id: 'trend', label: 'trend' },
  ]
  return (
    <div className="flex items-center gap-1 rounded-full border border-border/40 bg-muted/30 p-0.5">
      {opts.map(o => {
        const active = view === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] transition-all',
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
