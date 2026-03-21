import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, TerminalSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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

export default function CodexUsageDashboardOrch() {
  const navigate = useNavigate()
  const [data, setData] = useState<CodexProfileDashboardDataOrch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busySiteId, setBusySiteId] = useState<string | null>(null)
  const [activationNote, setActivationNote] = useState<string | null>(null)

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
      setActivationNote(
        result.warning
          ? `Activated ${siteName} for new Thinking Space terminals. macOS launchd update failed: ${result.warning}`
          : `Activated ${siteName}. New Thinking Space terminals and newly launched macOS Terminal/iTerm sessions will use ${result.profile.homePath}.`,
      )
      await reload()
      navigate(buildCodexTerminalRouteBlock(siteId, siteName))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate Codex profile.')
    } finally {
      setBusySiteId(null)
    }
  }, [navigate, reload])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading usage dashboard…
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Usage Dashboard</h2>
          <p className="text-xs text-muted-foreground">
            Source profiles from one web group, then activate the matching `CODEX_HOME` for Thinking Space and new macOS terminal sessions.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
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
                  return (
                    <div
                      key={site.id}
                      className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-foreground">{site.name}</h3>
                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', stateToneClassName(runtime))}>
                              {formatCodexProfileStateLabelBlock(runtime)}
                            </span>
                            {runtime?.launchctlMatches && (
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
                                launchd
                              </span>
                            )}
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">{formatHostname(site.url)}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleUseInTerminal(site.id, site.name)}
                            disabled={busy}
                          >
                            <TerminalSquare className="mr-1.5 h-3.5 w-3.5" />
                            {runtime?.hasAuthFile ? 'Use in Terminal' : 'Set Up in Terminal'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/web?site=${encodeURIComponent(site.id)}`)}
                            disabled={busy}
                          >
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Open in Web
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <div className="uppercase tracking-[0.08em] text-muted-foreground/70">Profile Home</div>
                          <div className="truncate font-mono text-[11px] text-foreground/80">
                            {runtime?.homePath ?? 'Unavailable'}
                          </div>
                        </div>
                        <div>
                          <div className="uppercase tracking-[0.08em] text-muted-foreground/70">Account ID</div>
                          <div className="truncate text-foreground/80">{runtime?.accountId ?? 'Unknown'}</div>
                        </div>
                        <div>
                          <div className="uppercase tracking-[0.08em] text-muted-foreground/70">Last Refresh</div>
                          <div className="truncate text-foreground/80">{lastRefresh ?? 'Never'}</div>
                        </div>
                        <div>
                          <div className="uppercase tracking-[0.08em] text-muted-foreground/70">Expires</div>
                          <div className="truncate text-foreground/80">{expiresAt ?? 'Unknown'}</div>
                        </div>
                      </div>

                      {(authUpdated || runtime?.error || runtime?.authMode) && (
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground/80">
                          {runtime?.authMode && <span>Auth mode: {runtime.authMode}</span>}
                          {authUpdated && <span>Auth file updated: {authUpdated}</span>}
                          {runtime?.error && <span className="text-destructive">Status warning: {runtime.error}</span>}
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
    </div>
  )
}
