import { useCallback, useEffect, useState } from 'react'
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
  if (!status) return 'bg-white/10 text-white/70'
  if (status.active && status.hasAuthFile) return 'bg-emerald-500/15 text-emerald-300'
  if (status.hasAuthFile) return 'bg-blue-500/15 text-blue-300'
  if (status.exists) return 'bg-amber-500/15 text-amber-300'
  return 'bg-white/10 text-white/70'
}

function probeToneClassName(result: CodexUsageProbeResultBlock | null | undefined): string {
  if (!result) return 'bg-white/10 text-white/70'
  if (result.sessionState === 'ready') return 'bg-emerald-500/15 text-emerald-300'
  if (result.sessionState === 'rate_limited') return 'bg-amber-500/15 text-amber-300'
  if (result.sessionState === 'needs_login') return 'bg-rose-500/15 text-rose-300'
  if (result.sessionState === 'loading') return 'bg-sky-500/15 text-sky-300'
  if (result.sessionState === 'error') return 'bg-destructive/15 text-destructive'
  return 'bg-white/10 text-white/70'
}

function statusAccentBlock(result: CodexUsageProbeResultBlock | null | undefined): string {
  if (!result) return 'from-slate-500/20 via-slate-400/10 to-transparent'
  if (result.sessionState === 'ready') return 'from-emerald-400/25 via-emerald-300/10 to-transparent'
  if (result.sessionState === 'rate_limited') return 'from-amber-400/25 via-amber-300/10 to-transparent'
  if (result.sessionState === 'needs_login') return 'from-rose-400/25 via-rose-300/10 to-transparent'
  if (result.sessionState === 'loading') return 'from-sky-400/25 via-sky-300/10 to-transparent'
  return 'from-slate-500/20 via-slate-400/10 to-transparent'
}

export default function CodexUsageDashboardOrch() {
  const navigate = useNavigate()
  const [data, setData] = useState<CodexProfileDashboardDataOrch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busySiteId, setBusySiteId] = useState<string | null>(null)
  const [activationNote, setActivationNote] = useState<string | null>(null)
  const [probeRefreshToken, setProbeRefreshToken] = useState(0)
  const [probeResults, setProbeResults] = useState<Record<string, CodexUsageProbeResultBlock>>({})

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
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Usage Dashboard</h2>
          <p className="text-xs text-muted-foreground">
            Source sessions from one web group, probe their visible page state, and keep the linked CLI profile switcher next to that live signal.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {data && (
        <Card className="border-border/70 bg-background/70">
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-[16rem] flex-1 flex-col gap-1.5 text-xs text-muted-foreground">
                <span className="font-medium uppercase tracking-[0.12em] text-muted-foreground/80">Source Web Group</span>
                <Select
                  value={data.sourceGroupId ?? ''}
                  onValueChange={handleGroupChange}
                  disabled={busySiteId === '__group__' || data.groups.length === 0}
                >
                  <SelectTrigger className="h-9">
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
              <div className="min-w-[12rem] flex-1 text-xs text-muted-foreground">
                <div>Profile root</div>
                <div className="truncate font-mono text-[11px] text-foreground/80">
                  {data.profileRootPath ?? 'Desktop app only'}
                </div>
              </div>
              <div className="min-w-[12rem] flex-1 text-xs text-muted-foreground">
                <div>Active `CODEX_HOME`</div>
                <div className="truncate font-mono text-[11px] text-foreground/80">
                  {data.activeHomePath ?? 'Unavailable'}
                </div>
              </div>
            </div>

            {data.launchctlHomePath && (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                macOS launchd `CODEX_HOME`: <span className="font-mono text-[11px] text-foreground/80">{data.launchctlHomePath}</span>
              </div>
            )}

            {activationNote && (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
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
              <div className="grid gap-3">
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
                      className="overflow-hidden rounded-[28px] border border-white/10 bg-[#08111f] shadow-[0_24px_80px_-32px_rgba(4,8,20,0.9)]"
                    >
                      <div className={cn('bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.14),_transparent_48%)] px-5 py-5', statusAccentBlock(probe))}>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-semibold text-white">{site.name}</h3>
                              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', probeToneClassName(probe))}>
                                {probe?.sessionLabel ?? 'Checking…'}
                              </span>
                              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', stateToneClassName(runtime))}>
                                CLI {formatCodexProfileStateLabelBlock(runtime)}
                              </span>
                              {runtime?.launchctlMatches && (
                                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/70">
                                  launchd
                                </span>
                              )}
                              {resetText && (
                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                                  {resetText}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/58">
                              <span>{formatHostname(site.url)}</span>
                              {probeDetectedAt && <span>Probed {probeDetectedAt}</span>}
                              {usageMetrics.length > 0 && <span>{usageMetrics.length} tracked quotas</span>}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleUseInTerminal(site.id, site.name)}
                              disabled={busy}
                              className="border-0 bg-white text-slate-950 hover:bg-white/90"
                            >
                              <TerminalSquare className="mr-1.5 h-3.5 w-3.5" />
                              {runtime?.hasAuthFile ? 'Use in Terminal' : 'Start Codex Login'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/web?site=${encodeURIComponent(site.id)}`)}
                              disabled={busy}
                              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                            >
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                              Open in Web
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(270px,0.95fr)]">
                        <div className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,170px)_minmax(0,1fr)]">
                            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                              <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">Visible Usage</div>
                              {headlineMetric ? (
                                <>
                                  <div className="mt-3 text-4xl font-semibold tracking-tight text-white">
                                    {headlineMetric.remainingPercent}%
                                  </div>
                                  <div className="mt-1 text-sm text-white/72">{headlineMetric.label} remaining</div>
                                </>
                              ) : (
                                <>
                                  <div className="mt-3 text-lg font-semibold text-white">
                                    {probe?.sessionLabel ?? 'Checking…'}
                                  </div>
                                  <div className="mt-1 text-sm text-white/60">
                                    {probe?.usageLabel ?? 'No structured usage metrics were detected yet.'}
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                              {usageMetrics.length > 0 ? (
                                <CodexUsageMetricChartBlock metrics={usageMetrics} />
                              ) : (
                                <div className="flex h-[148px] items-center rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 text-sm text-white/52">
                                  {probe?.summary ?? 'Loading visible session state…'}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/40">
                              <BarChart3 className="h-3.5 w-3.5" />
                              Session Summary
                            </div>
                            <div className="mt-3 text-sm leading-6 text-white/76">
                              {usageMetrics.length > 0
                                ? probe?.sessionState === 'rate_limited'
                                  ? 'The page is exposing quota breakdowns and at least one tracked quota is exhausted or limited.'
                                  : 'The page is exposing structured usage quotas. The chart highlights the currently visible remaining percentages.'
                                : probe?.summary ?? 'Loading visible session state…'}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/38">
                              <Fingerprint className="h-3.5 w-3.5" />
                              Account
                            </div>
                            <div className="mt-3 text-sm font-medium text-white">
                              {probe?.accountLabel ?? runtime?.accountId ?? 'Unknown'}
                            </div>
                            <div className="mt-1 text-xs text-white/48">Visible session identity</div>
                          </div>
                          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/38">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              CLI Profile
                            </div>
                            <div className="mt-3 text-sm font-medium text-white">
                              {formatCodexProfileStateLabelBlock(runtime)}
                            </div>
                            <div className="mt-1 truncate text-xs text-white/48">{runtime?.homePath ?? 'Unavailable'}</div>
                          </div>
                          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/38">
                              <Clock3 className="h-3.5 w-3.5" />
                              Refresh
                            </div>
                            <div className="mt-3 text-sm font-medium text-white">{lastRefresh ?? 'Never'}</div>
                            <div className="mt-1 text-xs text-white/48">CLI token refresh</div>
                          </div>
                          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/38">
                              <Clock3 className="h-3.5 w-3.5" />
                              Probe
                            </div>
                            <div className="mt-3 text-sm font-medium text-white">{probeDetectedAt ?? 'Waiting for load'}</div>
                            <div className="mt-1 text-xs text-white/48">{expiresAt ? `CLI expiry ${expiresAt}` : 'Visible web session scan time'}</div>
                          </div>
                        </div>
                      </div>

                      {(probe?.usageDetail || authUpdated || runtime?.error || runtime?.authMode || probe?.error) && (
                        <div className="border-t border-white/10 bg-black/20 px-5 py-3 text-[11px] text-white/48">
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {probe?.usageDetail && <span>{probe.usageDetail}</span>}
                            {runtime?.authMode && <span>Auth mode: {runtime.authMode}</span>}
                            {authUpdated && <span>Auth file updated: {authUpdated}</span>}
                            {runtime?.error && <span className="text-rose-300">Status warning: {runtime.error}</span>}
                            {probe?.error && <span className="text-rose-300">Probe warning: {probe.error}</span>}
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
          onResult={handleProbeResult}
        />
      )}
    </div>
  )
}
