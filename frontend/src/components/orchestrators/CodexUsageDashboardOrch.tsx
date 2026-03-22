import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Clock3, ExternalLink, Fingerprint, RefreshCw, ShieldCheck, TerminalSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import CodexUsageMetricChartBlock from '@/components/lego_blocks/integrations/CodexUsageMetricChartBlock'
import CodexUsageProbeBlock from '@/components/lego_blocks/integrations/CodexUsageProbeBlock'
import { Button } from '@/components/lego_blocks/units/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/lego_blocks/units/ui/select'
import {
  buildCodexTerminalRouteBlock,
  formatCodexProfileStateLabelBlock,
  type CodexProfileRuntimeStatusBlock,
} from '@/services/lego_blocks/units/codexProfileBlock'
import {
  extractCodexUsageMetricsBlock,
  extractCodexUsageResetTextBlock,
  type CodexUsageProbeResultBlock,
} from '@/services/lego_blocks/units/codexUsageProbeBlock'
import {
  getInMemoryProbeCache,
  isProbeResultFreshBlock,
  loadProbeResultsFromVaultBlock,
  seedInMemoryProbeCache,
  updateInMemoryProbeCache,
} from '@/services/lego_blocks/units/codexUsageCacheBlock'
import {
  activateCodexProfileOrch,
  listCodexProfileDashboardDataOrch,
  saveCodexProfileDashboardPreferencesOrch,
  type CodexProfileDashboardDataOrch,
} from '@/services/orchestrators/codexProfileOrch'
import { cn } from '@/lib/utils'

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleString()
}

function formatHostname(value: string): string {
  try {
    return new URL(value).hostname
  } catch {
    return value
  }
}

function stateToneClassName(status: CodexProfileRuntimeStatusBlock | null): string {
  if (!status) return 'bg-black/6 text-foreground/60 dark:bg-white/10 dark:text-white/70'
  if (status.active && status.hasAuthFile) return 'bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
  if (status.hasAuthFile) return 'bg-blue-500/12 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'
  if (status.exists) return 'bg-amber-500/12 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
  return 'bg-black/6 text-foreground/60 dark:bg-white/10 dark:text-white/70'
}

function probeToneClassName(result: CodexUsageProbeResultBlock | null | undefined): string {
  if (!result) return 'bg-black/6 text-foreground/60 dark:bg-white/10 dark:text-white/70'
  if (result.sessionState === 'ready') return 'bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
  if (result.sessionState === 'rate_limited') return 'bg-black/6 text-foreground/60 dark:bg-white/10 dark:text-white/70'
  if (result.sessionState === 'needs_login') return 'bg-rose-500/12 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
  if (result.sessionState === 'loading') return 'bg-black/6 text-foreground/50 dark:bg-white/10 dark:text-white/60'
  if (result.sessionState === 'error') return 'bg-destructive/15 text-destructive'
  return 'bg-black/6 text-foreground/60 dark:bg-white/10 dark:text-white/70'
}

export default function CodexUsageDashboardOrch() {
  const navigate = useNavigate()
  const [data, setData] = useState<CodexProfileDashboardDataOrch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busySiteId, setBusySiteId] = useState<string | null>(null)
  const [activationNote, setActivationNote] = useState<string | null>(null)
  const [probeRefreshToken, setProbeRefreshToken] = useState(0)
  const [probeResults, setProbeResults] = useState<Record<string, CodexUsageProbeResultBlock>>(
    () => getInMemoryProbeCache(),
  )
  const vaultLoadedRef = useRef(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextData = await listCodexProfileDashboardDataOrch()
      setData(nextData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Codex profile dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    if (vaultLoadedRef.current) return
    vaultLoadedRef.current = true
    void loadProbeResultsFromVaultBlock().then((vaultData) => {
      if (Object.keys(vaultData).length === 0) return
      seedInMemoryProbeCache(vaultData)
      setProbeResults((prev) => {
        const merged = { ...vaultData }
        for (const [siteId, result] of Object.entries(prev)) merged[siteId] = result
        return merged
      })
    })
  }, [])

  useEffect(() => {
    if (!data) return
    const allowedSiteIds = new Set(data.rows.map((row) => row.site.id))
    setProbeResults((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([siteId]) => allowedSiteIds.has(siteId))),
    )
  }, [data])

  const handleProbeResult = useCallback((result: CodexUsageProbeResultBlock) => {
    updateInMemoryProbeCache(result)
    setProbeResults((prev) => {
      const existing = prev[result.siteId]
      if (
        existing
        && existing.sessionState === result.sessionState
        && existing.summary === result.summary
        && existing.usageLabel === result.usageLabel
        && existing.detectedAt === result.detectedAt
        && existing.accountLabel === result.accountLabel
        && existing.error === result.error
      ) return prev
      return { ...prev, [result.siteId]: result }
    })
  }, [])

  const freshResultSiteIds = useMemo(() => new Set(
    Object.values(probeResults)
      .filter((r) => isProbeResultFreshBlock(r) && r.sessionState !== 'loading')
      .map((r) => r.siteId),
  ), [probeResults])

  const handleGroupChange = useCallback(async (groupId: string) => {
    if (!data) return
    setBusySiteId('__group__')
    setActivationNote(null)
    try {
      await saveCodexProfileDashboardPreferencesOrch({ sourceGroupId: groupId })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dashboard source group.')
    } finally {
      setBusySiteId(null)
    }
  }, [data, reload])

  const handleUseInTerminal = useCallback(async (siteId: string, siteName: string) => {
    setBusySiteId(siteId)
    setActivationNote(null)
    setError(null)
    try {
      const result = await activateCodexProfileOrch(siteId)
      const needsLogin = !result.profile.hasAuthFile
      setActivationNote(
        needsLogin
          ? `Activated ${siteName} — terminal will run \`codex login\` inside ${result.profile.homePath}.`
          : result.warning
            ? `Activated ${siteName}. macOS launchd update failed: ${result.warning}`
            : `Activated ${siteName}. New terminals will use ${result.profile.homePath}.`,
      )
      await reload()
      navigate(buildCodexTerminalRouteBlock(siteId, siteName, {
        homePath: result.profile.homePath,
        initialCommand: needsLogin ? 'codex login' : null,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate Codex profile.')
    } finally {
      setBusySiteId(null)
    }
  }, [navigate, reload])

  const handleRefresh = useCallback(() => {
    setProbeRefreshToken((v) => v + 1)
    void reload()
  }, [reload])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading usage dashboard…
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-4 py-3">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Usage Dashboard</h2>
          <p className="text-xs text-muted-foreground">
            Source sessions from one web group and probe their visible page state.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {data && (
        <>
          {/* Source group + CODEX_HOME — flat, no card */}
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={data.sourceGroupId ?? ''}
              onValueChange={handleGroupChange}
              disabled={busySiteId === '__group__' || data.groups.length === 0}
            >
              <SelectTrigger className="h-8 w-52 text-xs">
                <SelectValue placeholder="Select a web group" />
              </SelectTrigger>
              <SelectContent>
                {data.groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name} ({group.bookmarkCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {data.activeHomePath && (
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {data.activeHomePath}
              </span>
            )}
          </div>

          {activationNote && (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-200">
              {activationNote}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {data.rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
              No web bookmarks found in the selected group.
            </div>
          ) : (
            <div className="grid gap-2">
              {data.rows.map(({ site, runtime }) => {
                const busy = busySiteId === site.id
                const lastRefresh = formatTimestamp(runtime?.lastRefresh)
                const expiresAt = formatTimestamp(runtime?.expiresAt)
                const authUpdated = formatTimestamp(runtime?.authFileUpdatedAt)
                const probe = probeResults[site.id] ?? null
                const probeDetectedAt = formatTimestamp(probe?.detectedAt)
                const usageMetrics = extractCodexUsageMetricsBlock(probe)
                const resetText = extractCodexUsageResetTextBlock(probe)
                const headlineMetric = usageMetrics
                  .slice()
                  .sort((a, b) => a.remainingPercent - b.remainingPercent)[0] ?? null

                return (
                  <div
                    key={site.id}
                    className="overflow-hidden rounded-xl border border-black/8 bg-white dark:border-white/10 dark:bg-[#08111f]"
                  >
                    {/* Header row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-semibold text-foreground dark:text-white">{site.name}</h3>
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', probeToneClassName(probe))}>
                          {probe?.sessionLabel ?? 'Checking…'}
                        </span>
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', stateToneClassName(runtime))}>
                          CLI {formatCodexProfileStateLabelBlock(runtime)}
                        </span>
                        {runtime?.launchctlMatches && (
                          <span className="rounded-full bg-black/6 px-2 py-0.5 text-[10px] text-foreground/55 dark:bg-white/10 dark:text-white/60">
                            launchd
                          </span>
                        )}
                        <span className="text-[10px] text-foreground/35 dark:text-white/35">{formatHostname(site.url)}</span>
                        {probeDetectedAt && (
                          <span className="text-[10px] text-foreground/25 dark:text-white/25">· {probeDetectedAt}</span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleUseInTerminal(site.id, site.name)}
                          disabled={busy}
                          className="h-7 border-0 bg-foreground px-2.5 text-xs text-background hover:bg-foreground/90 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                        >
                          <TerminalSquare className="mr-1 h-3 w-3" />
                          {runtime?.hasAuthFile ? 'Use in Terminal' : 'Codex Login'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/web?site=${encodeURIComponent(site.id)}`)}
                          disabled={busy}
                          className="h-7 border-border bg-transparent px-2.5 text-xs text-foreground hover:bg-muted dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Open
                        </Button>
                      </div>
                    </div>

                    {/* Body — flat, no inner boxes */}
                    <div className="border-t border-black/6 px-4 py-3 dark:border-white/8">
                      <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                        {/* Left: usage + chart */}
                        <div>
                          {usageMetrics.length > 0 ? (
                            <div className="flex items-start gap-4">
                              <div className="shrink-0">
                                <div className={cn(
                                  'text-2xl font-semibold tabular-nums',
                                  headlineMetric && headlineMetric.tone === 'critical'
                                    ? 'text-rose-500 dark:text-rose-400'
                                    : headlineMetric && headlineMetric.tone === 'warning'
                                      ? 'text-amber-500 dark:text-amber-400'
                                      : 'text-foreground dark:text-white',
                                )}>
                                  {headlineMetric?.remainingPercent ?? 0}%
                                </div>
                                <div className="text-[10px] text-foreground/45 dark:text-white/45">
                                  {headlineMetric?.label ?? ''} remaining
                                </div>
                                {resetText && (
                                  <div className="mt-1 text-[10px] text-foreground/40 dark:text-white/40">{resetText}</div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <CodexUsageMetricChartBlock metrics={usageMetrics} />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-foreground/50 dark:text-white/50">
                                {probe?.usageLabel ?? probe?.summary ?? 'No usage data yet'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Right: metadata as plain key/value pairs */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <div>
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-foreground/35 dark:text-white/35">
                              <Fingerprint className="h-2.5 w-2.5" />
                              Account
                            </div>
                            <div className="mt-0.5 truncate text-xs text-foreground/80 dark:text-white/80">
                              {probe?.accountLabel ?? runtime?.accountId ?? '—'}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-foreground/35 dark:text-white/35">
                              <ShieldCheck className="h-2.5 w-2.5" />
                              CLI Profile
                            </div>
                            <div className="mt-0.5 truncate text-xs text-foreground/80 dark:text-white/80">
                              {formatCodexProfileStateLabelBlock(runtime)}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-foreground/35 dark:text-white/35">
                              <Clock3 className="h-2.5 w-2.5" />
                              CLI Refresh
                            </div>
                            <div className="mt-0.5 text-xs text-foreground/80 dark:text-white/80">{lastRefresh ?? '—'}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-foreground/35 dark:text-white/35">
                              <BarChart3 className="h-2.5 w-2.5" />
                              Probed
                            </div>
                            <div className="mt-0.5 text-xs text-foreground/80 dark:text-white/80">{probeDetectedAt ?? '—'}</div>
                            {expiresAt && (
                              <div className="text-[10px] text-foreground/35 dark:text-white/35">exp {expiresAt}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer — only when there's extra debug info */}
                    {(authUpdated || runtime?.error || runtime?.authMode || probe?.error) && (
                      <div className="border-t border-black/6 px-4 py-1.5 text-[10px] text-foreground/35 dark:border-white/8 dark:text-white/35">
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {runtime?.authMode && <span>Auth: {runtime.authMode}</span>}
                          {authUpdated && <span>Updated: {authUpdated}</span>}
                          {runtime?.error && <span className="text-rose-500 dark:text-rose-400">{runtime.error}</span>}
                          {probe?.error && <span className="text-rose-500 dark:text-rose-400">{probe.error}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {data && (
        <CodexUsageProbeBlock
          sites={data.rows.map((row) => row.site)}
          refreshToken={probeRefreshToken}
          freshResultSiteIds={freshResultSiteIds}
          onResult={handleProbeResult}
        />
      )}
    </div>
  )
}
