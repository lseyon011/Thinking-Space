import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Clock3, ExternalLink, Fingerprint, RefreshCw, ShieldCheck, TerminalSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import CodexUsageMetricChartBlock from '@/components/lego_blocks/integrations/CodexUsageMetricChartBlock'
import CodexUsageProbeBlock from '@/components/lego_blocks/integrations/CodexUsageProbeBlock'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { Card, CardContent } from '@/components/lego_blocks/units/ui/card'
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
  if (result.sessionState === 'rate_limited') return 'bg-amber-500/12 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
  if (result.sessionState === 'needs_login') return 'bg-rose-500/12 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
  if (result.sessionState === 'loading') return 'bg-sky-500/12 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300'
  if (result.sessionState === 'error') return 'bg-destructive/15 text-destructive'
  return 'bg-black/6 text-foreground/60 dark:bg-white/10 dark:text-white/70'
}

function statusAccentBlock(result: CodexUsageProbeResultBlock | null | undefined): string {
  if (!result) return ''
  if (result.sessionState === 'ready') return 'bg-emerald-500/8 dark:bg-emerald-400/10'
  if (result.sessionState === 'rate_limited') return 'bg-amber-500/8 dark:bg-amber-400/10'
  if (result.sessionState === 'needs_login') return 'bg-rose-500/8 dark:bg-rose-400/10'
  if (result.sessionState === 'loading') return 'bg-sky-500/8 dark:bg-sky-400/10'
  return ''
}

export default function CodexUsageDashboardOrch() {
  const navigate = useNavigate()
  const [data, setData] = useState<CodexProfileDashboardDataOrch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busySiteId, setBusySiteId] = useState<string | null>(null)
  const [activationNote, setActivationNote] = useState<string | null>(null)
  const [probeRefreshToken, setProbeRefreshToken] = useState(0)
  // Initialize from module-level in-memory cache so tab switches show instant results
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

  useEffect(() => {
    void reload()
  }, [reload])

  // On first mount: seed in-memory cache from vault (cross-device persistence)
  useEffect(() => {
    if (vaultLoadedRef.current) return
    vaultLoadedRef.current = true
    void loadProbeResultsFromVaultBlock().then((vaultData) => {
      if (Object.keys(vaultData).length === 0) return
      seedInMemoryProbeCache(vaultData)
      setProbeResults((prev) => {
        const merged = { ...vaultData }
        for (const [siteId, result] of Object.entries(prev)) {
          merged[siteId] = result
        }
        return merged
      })
    })
  }, [])

  useEffect(() => {
    if (!data) return
    const allowedSiteIds = new Set(data.rows.map((row) => row.site.id))
    setProbeResults((prev) => {
      return Object.fromEntries(
        Object.entries(prev).filter(([siteId]) => allowedSiteIds.has(siteId)),
      )
    })
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
        && existing.usageDetail === result.usageDetail
        && existing.usageSourceText === result.usageSourceText
        && existing.accountLabel === result.accountLabel
        && existing.currentUrl === result.currentUrl
        && existing.pageTitle === result.pageTitle
        && existing.detectedAt === result.detectedAt
        && existing.error === result.error
      ) {
        return prev
      }
      return { ...prev, [result.siteId]: result }
    })
  }, [])

  // Sites whose cached result is still fresh — probe block skips immediate re-probe for these
  const freshResultSiteIds = useMemo(() => {
    return new Set(
      Object.values(probeResults)
        .filter((r) => isProbeResultFreshBlock(r) && r.sessionState !== 'loading')
        .map((r) => r.siteId),
    )
  }, [probeResults])

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
          ? `Activated ${siteName} and opened a terminal tab that starts \`codex login\` inside ${result.profile.homePath}. Complete that login once to set up this profile.`
          : result.warning
            ? `Activated ${siteName} for new Thinking Space terminals. macOS launchd update failed: ${result.warning}`
            : `Activated ${siteName}. Thinking Space terminals opened from here will use ${result.profile.homePath}. Newly launched macOS terminal apps may also pick it up if they inherit the updated launchd environment.`,
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
    setProbeRefreshToken((value) => value + 1)
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
        <Card className="border-border/70 bg-background/70">
          <CardContent className="flex flex-col gap-3 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
                <span className="font-medium uppercase tracking-[0.12em] text-muted-foreground/80">Source Web Group</span>
                <Select
                  value={data.sourceGroupId ?? ''}
                  onValueChange={handleGroupChange}
                  disabled={busySiteId === '__group__' || data.groups.length === 0}
                >
                  <SelectTrigger className="h-8">
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
              </label>
              <div className="min-w-[10rem] flex-1 text-xs text-muted-foreground">
                <div>Active `CODEX_HOME`</div>
                <div className="truncate font-mono text-[11px] text-foreground/80">
                  {data.activeHomePath ?? 'Unavailable'}
                </div>
              </div>
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
                No web bookmarks found in the selected group. Point the dashboard at the group that holds your account tabs.
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
                    .sort((left, right) => left.remainingPercent - right.remainingPercent)[0] ?? null
                  return (
                    <div
                      key={site.id}
                      className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm dark:border-white/10 dark:bg-[#08111f] dark:shadow-[0_12px_40px_-16px_rgba(4,8,20,0.9)]"
                    >
                      {/* Header */}
                      <div className={cn('px-4 py-3', statusAccentBlock(probe))}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                            <h3 className="truncate text-sm font-semibold text-foreground dark:text-white">{site.name}</h3>
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', probeToneClassName(probe))}>
                              {probe?.sessionLabel ?? 'Checking…'}
                            </span>
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', stateToneClassName(runtime))}>
                              CLI {formatCodexProfileStateLabelBlock(runtime)}
                            </span>
                            {runtime?.launchctlMatches && (
                              <span className="rounded-full bg-black/6 px-2 py-0.5 text-[10px] text-foreground/60 dark:bg-white/10 dark:text-white/70">
                                launchd
                              </span>
                            )}
                            {resetText && (
                              <span className="rounded-full border border-black/8 bg-black/4 px-2 py-0.5 text-[10px] text-foreground/60 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                                {resetText}
                              </span>
                            )}
                            <span className="text-[10px] text-foreground/40 dark:text-white/40">{formatHostname(site.url)}</span>
                            {probeDetectedAt && (
                              <span className="text-[10px] text-foreground/30 dark:text-white/30">· {probeDetectedAt}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
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
                      </div>

                      {/* Body */}
                      <div className="grid gap-2 border-t border-black/6 px-4 py-3 dark:border-white/8 lg:grid-cols-[minmax(0,1.45fr)_minmax(220px,0.95fr)]">
                        {/* Left: usage stat + chart */}
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)]">
                          <div className="rounded-xl border border-black/8 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]">
                            <div className="text-[10px] uppercase tracking-[0.24em] text-foreground/40 dark:text-white/40">Visible Usage</div>
                            {headlineMetric ? (
                              <>
                                <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground dark:text-white">
                                  {headlineMetric.remainingPercent}%
                                </div>
                                <div className="mt-0.5 text-xs text-foreground/65 dark:text-white/72">{headlineMetric.label} remaining</div>
                              </>
                            ) : (
                              <>
                                <div className="mt-2 text-sm font-semibold text-foreground dark:text-white">
                                  {probe?.sessionLabel ?? 'Checking…'}
                                </div>
                                <div className="mt-0.5 text-xs text-foreground/55 dark:text-white/60">
                                  {probe?.usageLabel ?? 'No usage metrics yet.'}
                                </div>
                              </>
                            )}
                          </div>
                          <div className="rounded-xl border border-black/8 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]">
                            {usageMetrics.length > 0 ? (
                              <CodexUsageMetricChartBlock metrics={usageMetrics} />
                            ) : (
                              <div className="flex h-[96px] items-center rounded-lg border border-dashed border-black/10 bg-black/[0.03] px-3 text-xs text-foreground/45 dark:border-white/10 dark:bg-black/20 dark:text-white/52">
                                {probe?.summary ?? 'Loading session state…'}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: metadata */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg border border-black/8 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]">
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-foreground/40 dark:text-white/38">
                              <Fingerprint className="h-3 w-3" />
                              Account
                            </div>
                            <div className="mt-2 truncate text-xs font-medium text-foreground dark:text-white">
                              {probe?.accountLabel ?? runtime?.accountId ?? 'Unknown'}
                            </div>
                          </div>
                          <div className="rounded-lg border border-black/8 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]">
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-foreground/40 dark:text-white/38">
                              <ShieldCheck className="h-3 w-3" />
                              CLI Profile
                            </div>
                            <div className="mt-2 truncate text-xs font-medium text-foreground dark:text-white">
                              {formatCodexProfileStateLabelBlock(runtime)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-black/8 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]">
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-foreground/40 dark:text-white/38">
                              <Clock3 className="h-3 w-3" />
                              CLI Refresh
                            </div>
                            <div className="mt-2 text-xs font-medium text-foreground dark:text-white">{lastRefresh ?? 'Never'}</div>
                          </div>
                          <div className="rounded-lg border border-black/8 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]">
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-foreground/40 dark:text-white/38">
                              <BarChart3 className="h-3 w-3" />
                              Probed
                            </div>
                            <div className="mt-2 text-xs font-medium text-foreground dark:text-white">{probeDetectedAt ?? 'Waiting'}</div>
                            {expiresAt && (
                              <div className="mt-0.5 truncate text-[10px] text-foreground/40 dark:text-white/40">Expires {expiresAt}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {(probe?.usageDetail || authUpdated || runtime?.error || runtime?.authMode || probe?.error) && (
                        <div className="border-t border-black/6 bg-black/[0.02] px-4 py-2 text-[10px] text-foreground/40 dark:border-white/10 dark:bg-black/20 dark:text-white/40">
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                            {probe?.usageDetail && <span>{probe.usageDetail}</span>}
                            {runtime?.authMode && <span>Auth: {runtime.authMode}</span>}
                            {authUpdated && <span>Auth updated: {authUpdated}</span>}
                            {runtime?.error && <span className="text-rose-500 dark:text-rose-300">Status: {runtime.error}</span>}
                            {probe?.error && <span className="text-rose-500 dark:text-rose-300">Probe: {probe.error}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
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
