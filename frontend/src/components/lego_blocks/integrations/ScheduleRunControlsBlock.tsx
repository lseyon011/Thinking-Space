// Run controls panel shown above the form when editing an existing schedule.
// Holds the fire-now button, enable toggle, delete button, and a status pill.

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { Switch } from '@/components/lego_blocks/units/ui/switch'
import { cn } from '@/lib/utils'
import {
  deleteAndUnloadScheduleOrch,
  fireScheduleNowOrch,
  saveAndSyncScheduleOrch,
} from '@/services/orchestrators/schedulesOrch'
import {
  getLaunchctlStatusBlock,
  type ScheduleSpecBlock,
  type ScheduleStatusBlock,
} from '@/services/lego_blocks/integrations/schedulesBlock'

interface ScheduleRunControlsBlockProps {
  spec: ScheduleSpecBlock
  /** Called when something changes that the parent should re-fetch (toggle, fire result, etc.). */
  onChanged?: () => void
}

interface RunFeedback {
  state: 'idle' | 'running' | 'error' | 'success'
  message?: string
}

export default function ScheduleRunControlsBlock({ spec, onChanged }: ScheduleRunControlsBlockProps) {
  const navigate = useNavigate()
  const [enabled, setEnabled] = useState(spec.enabled)
  const [status, setStatus] = useState<ScheduleStatusBlock>({ loaded: false, pid: null, lastExitCode: null })
  const [feedback, setFeedback] = useState<RunFeedback>({ state: 'idle' })

  useEffect(() => { setEnabled(spec.enabled) }, [spec.enabled])

  useEffect(() => {
    let cancelled = false
    getLaunchctlStatusBlock(spec.label).then((s) => { if (!cancelled) setStatus(s) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [spec.label])

  const pill = !enabled
    ? { text: 'Disabled', tone: 'muted' as const }
    : status.loaded
      ? { text: 'Loaded', tone: 'good' as const }
      : { text: 'Not loaded', tone: 'warn' as const }

  const handleFire = useCallback(async () => {
    setFeedback({ state: 'running' })
    try {
      const result = await fireScheduleNowOrch(spec)
      const ok = result.exitCode === 0
      setFeedback({
        state: ok ? 'success' : 'error',
        message: ok ? `Exit 0 · ${result.durationMs}ms` : `Exit ${result.exitCode ?? 'null'} · see transcript`,
      })
    } catch (err) {
      setFeedback({ state: 'error', message: err instanceof Error ? err.message : 'Fire failed' })
    } finally {
      onChanged?.()
    }
  }, [spec, onChanged])

  const handleToggle = useCallback(async (next: boolean) => {
    setEnabled(next)
    setFeedback({ state: 'running' })
    try {
      await saveAndSyncScheduleOrch({ ...spec, enabled: next, updatedAt: new Date().toISOString() })
      const refreshed = await getLaunchctlStatusBlock(spec.label).catch(() => null)
      if (refreshed) setStatus(refreshed)
      setFeedback({ state: 'idle' })
    } catch (err) {
      setEnabled(!next)
      setFeedback({ state: 'error', message: err instanceof Error ? err.message : 'Toggle failed' })
    } finally {
      onChanged?.()
    }
  }, [spec, onChanged])

  const handleDelete = useCallback(async () => {
    if (!confirm(`Delete schedule "${spec.title}"? This removes the launchd plist.`)) return
    setFeedback({ state: 'running' })
    try {
      await deleteAndUnloadScheduleOrch(spec.key)
      navigate('/ai/schedules')
      onChanged?.()
    } catch (err) {
      setFeedback({ state: 'error', message: err instanceof Error ? err.message : 'Delete failed' })
    }
  }, [spec.key, spec.title, navigate, onChanged])

  return (
    <section className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
              pill.tone === 'good' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
              pill.tone === 'warn' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
              pill.tone === 'muted' && 'bg-muted text-muted-foreground',
            )}
          >
            {pill.text}
          </span>
          {status.pid && <span className="text-xs text-muted-foreground">pid {status.pid}</span>}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs">
            <Switch checked={enabled} onCheckedChange={handleToggle} disabled={feedback.state === 'running'} />
            Enabled
          </label>
          <Button
            size="sm"
            onClick={handleFire}
            disabled={!enabled || feedback.state === 'running'}
          >
            {feedback.state === 'running'
              ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              : <Play className="mr-1 h-4 w-4" />}
            Fire now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={feedback.state === 'running'}
            className="text-destructive"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {feedback.message && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs',
            feedback.state === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {feedback.state === 'error' && <AlertCircle className="h-3 w-3" />}
          {feedback.message}
        </div>
      )}
    </section>
  )
}
