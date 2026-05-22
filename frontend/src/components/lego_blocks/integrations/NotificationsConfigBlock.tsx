// Tiny config UI for ntfy.sh failure notifications. Lives at the top of the
// schedules list page when no schedule is selected. Topic is a public
// namespace on ntfy.sh — encourage a hard-to-guess suffix.

import { useCallback, useEffect, useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { Switch } from '@/components/lego_blocks/units/ui/switch'
import { cn } from '@/lib/utils'
import {
  getNotificationsConfigBlock,
  setNotificationsConfigBlock,
  testNotificationBlock,
  type NotificationsConfigBlock,
} from '@/services/lego_blocks/integrations/schedulesBlock'

const FIELD_LABEL = 'text-xs font-medium text-muted-foreground mb-1'
const INPUT_BASE = 'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function NotificationsConfigBlock() {
  const [cfg, setCfg] = useState<NotificationsConfigBlock | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<'ok' | 'err'>('ok')

  useEffect(() => {
    getNotificationsConfigBlock().then(setCfg).catch(() => setCfg(null))
  }, [])

  const save = useCallback(async (next: Partial<NotificationsConfigBlock>) => {
    setBusy(true)
    setFeedback(null)
    try {
      const updated = await setNotificationsConfigBlock(next)
      setCfg(updated)
    } catch (err) {
      setFeedbackTone('err')
      setFeedback(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }, [])

  const handleTest = useCallback(async () => {
    setBusy(true)
    setFeedback(null)
    try {
      const res = await testNotificationBlock()
      if (res.sent) {
        setFeedbackTone('ok')
        setFeedback('Test sent — check your ntfy app.')
      } else {
        setFeedbackTone('err')
        setFeedback(`Not sent: ${res.reason ?? 'unknown'}`)
      }
    } catch (err) {
      setFeedbackTone('err')
      setFeedback(err instanceof Error ? err.message : 'Test failed')
    } finally {
      setBusy(false)
    }
  }, [])

  if (!cfg) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Loading notifications config…
      </div>
    )
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Failure notifications (ntfy.sh)</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Get a push notification on your phone when a scheduled run fails. Install{' '}
        <a href="https://ntfy.sh" target="_blank" rel="noreferrer" className="underline">
          ntfy
        </a>{' '}
        on your device, subscribe to the topic below.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <div className={FIELD_LABEL}>Topic (keep it hard-to-guess)</div>
          <input
            className={INPUT_BASE}
            value={cfg.ntfy.topic ?? ''}
            onChange={(e) => setCfg({ ...cfg, ntfy: { ...cfg.ntfy, topic: e.target.value } })}
            onBlur={() => save({ ntfy: { ...cfg.ntfy, topic: cfg.ntfy.topic?.trim() || null } })}
            placeholder="anurag-thinkspc-a8f3c2"
          />
        </div>
        <div>
          <div className={FIELD_LABEL}>Server</div>
          <input
            className={INPUT_BASE}
            value={cfg.ntfy.server}
            onChange={(e) => setCfg({ ...cfg, ntfy: { ...cfg.ntfy, server: e.target.value } })}
            onBlur={() => save({ ntfy: { ...cfg.ntfy, server: cfg.ntfy.server.trim() || 'ntfy.sh' } })}
            placeholder="ntfy.sh"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          <Switch
            checked={cfg.ntfy.onFailure}
            onCheckedChange={(v) => save({ ntfy: { ...cfg.ntfy, onFailure: v } })}
            disabled={busy}
          />
          Notify on failure
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <Switch
            checked={cfg.ntfy.onSuccess}
            onCheckedChange={(v) => save({ ntfy: { ...cfg.ntfy, onSuccess: v } })}
            disabled={busy}
          />
          Notify on success
        </label>
        <Button size="sm" variant="ghost" onClick={handleTest} disabled={busy || !cfg.ntfy.topic} className="ml-auto">
          {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Send test
        </Button>
      </div>
      {feedback && (
        <div className={cn('text-xs', feedbackTone === 'err' ? 'text-destructive' : 'text-muted-foreground')}>
          {feedback}
        </div>
      )}
    </section>
  )
}
