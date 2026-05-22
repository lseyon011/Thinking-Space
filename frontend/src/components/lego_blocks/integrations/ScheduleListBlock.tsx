import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Play, Trash2, AlertCircle, RefreshCw, Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { Switch } from '@/components/lego_blocks/units/ui/switch'
import { cn } from '@/lib/utils'
import {
  listSchedulesWithStatusOrch,
  listExternalLaunchdAgentsOrch,
  saveAndSyncScheduleOrch,
  deleteAndUnloadScheduleOrch,
  fireScheduleNowOrch,
  type ScheduleWithStatusBlock,
  type ExternalLaunchdAgentBlock,
} from '@/services/orchestrators/schedulesOrch'
import type {
  ScheduleSpecBlock,
  ScheduleTriggerSpecBlock,
  ScheduleExecutionSpecBlock,
} from '@/services/lego_blocks/integrations/schedulesBlock'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function summarizeSchedule(trigger: ScheduleTriggerSpecBlock): string {
  if (trigger.kind === 'interval') {
    const s = trigger.seconds
    if (s >= 3600 && s % 3600 === 0) return `Every ${s / 3600}h`
    if (s >= 60 && s % 60 === 0) return `Every ${s / 60}m`
    return `Every ${s}s`
  }
  const times = trigger.entries
    .map((e) => `${pad2(e.hour)}:${pad2(e.minute)}`)
    .join(' · ')
  return `Daily ${times}`
}

function summarizeExecution(exec: ScheduleExecutionSpecBlock): string {
  if (exec.kind === 'shell') {
    const tail = exec.command.split('/').pop() ?? exec.command
    return `shell: ${tail}${exec.args.length > 0 ? ' …' : ''}`
  }
  const mode = exec.session?.mode ?? 'new'
  return `claude-code (${mode})`
}

interface RunIndicator {
  state: 'idle' | 'running' | 'error'
  message?: string
}

interface ScheduleRowProps {
  row: ScheduleWithStatusBlock
  onAfterChange: () => void
}

function ScheduleRow({ row, onAfterChange }: ScheduleRowProps) {
  const [busy, setBusy] = useState<RunIndicator>({ state: 'idle' })
  const [enabled, setEnabled] = useState<boolean>(row.spec.enabled)

  useEffect(() => {
    setEnabled(row.spec.enabled)
  }, [row.spec.enabled])

  const handleFire = useCallback(async () => {
    setBusy({ state: 'running' })
    try {
      const result = await fireScheduleNowOrch(row.spec)
      const note = result.exitCode === 0
        ? `Fired · exit ${result.exitCode}`
        : `Fired · exit ${result.exitCode ?? 'null'}`
      setBusy({ state: result.exitCode === 0 ? 'idle' : 'error', message: note })
    } catch (err) {
      setBusy({ state: 'error', message: err instanceof Error ? err.message : 'Fire failed' })
    } finally {
      onAfterChange()
    }
  }, [row.spec, onAfterChange])

  const handleToggle = useCallback(async (next: boolean) => {
    setEnabled(next)
    setBusy({ state: 'running' })
    try {
      const updated: ScheduleSpecBlock = { ...row.spec, enabled: next, updatedAt: new Date().toISOString() }
      await saveAndSyncScheduleOrch(updated)
      setBusy({ state: 'idle' })
    } catch (err) {
      setEnabled(!next)
      setBusy({ state: 'error', message: err instanceof Error ? err.message : 'Toggle failed' })
    } finally {
      onAfterChange()
    }
  }, [row.spec, onAfterChange])

  const handleDelete = useCallback(async () => {
    if (!confirm(`Delete schedule "${row.spec.title}"? This removes the launchd plist.`)) return
    setBusy({ state: 'running' })
    try {
      await deleteAndUnloadScheduleOrch(row.spec.key)
    } catch (err) {
      setBusy({ state: 'error', message: err instanceof Error ? err.message : 'Delete failed' })
    } finally {
      onAfterChange()
    }
  }, [row.spec, onAfterChange])

  const statusPill = (() => {
    if (!enabled) return { text: 'Disabled', tone: 'muted' as const }
    if (row.status.loaded) return { text: 'Loaded', tone: 'good' as const }
    return { text: 'Not loaded', tone: 'warn' as const }
  })()

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{row.spec.title}</span>
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                statusPill.tone === 'good' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                statusPill.tone === 'warn' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
                statusPill.tone === 'muted' && 'bg-muted text-muted-foreground',
              )}
            >
              {statusPill.text}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {summarizeSchedule(row.spec.schedule)} · {summarizeExecution(row.spec.execution)}
          </div>
          {row.spec.description && (
            <div className="mt-1 truncate text-xs text-muted-foreground/80">{row.spec.description}</div>
          )}
          {busy.state === 'error' && busy.message && (
            <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {busy.message}
            </div>
          )}
          {busy.state === 'idle' && busy.message && (
            <div className="mt-2 text-xs text-muted-foreground">{busy.message}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={busy.state === 'running'}
            aria-label={`Enable ${row.spec.title}`}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFire}
            disabled={!enabled || busy.state === 'running'}
            title="Fire now"
          >
            {busy.state === 'running' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Link
            to={`/ai/schedules/${row.spec.key}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
            title="Edit"
          >
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={busy.state === 'running'}
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ScheduleListBlock() {
  const [rows, setRows] = useState<ScheduleWithStatusBlock[]>([])
  const [external, setExternal] = useState<ExternalLaunchdAgentBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [next, ext] = await Promise.all([
        listSchedulesWithStatusOrch(),
        listExternalLaunchdAgentsOrch(),
      ])
      setRows(next)
      setExternal(ext.filter((e) => e.managed === 'external'))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const handle = setInterval(refresh, 15000)
    return () => clearInterval(handle)
  }, [refresh])

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Managed schedules
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={refresh} title="Refresh" disabled={loading}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
            <Link
              to="/ai/schedules/new"
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              New schedule
            </Link>
          </div>
        </div>
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && rows.length === 0 && !error && (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            No schedules yet. Click <strong>New schedule</strong> to create one.
          </div>
        )}
        <div className="space-y-2">
          {rows.map((row) => (
            <ScheduleRow key={row.spec.key} row={row} onAfterChange={refresh} />
          ))}
        </div>
      </section>

      {external.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            External launch agents (read-only)
          </h2>
          <div className="space-y-1">
            {external.map((agent) => (
              <div
                key={agent.label}
                className="rounded border border-border/60 bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground"
              >
                {agent.label}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
