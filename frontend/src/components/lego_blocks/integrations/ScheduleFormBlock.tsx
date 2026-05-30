import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { Switch } from '@/components/lego_blocks/units/ui/switch'
import { cn } from '@/lib/utils'
import {
  getScheduleByKeyOrch,
  saveAndSyncScheduleOrch,
} from '@/services/orchestrators/schedulesOrch'
import type {
  ScheduleSpecBlock,
  ScheduleExecutionSpecBlock,
  ScheduleTriggerSpecBlock,
  ScheduleSessionModeBlock,
} from '@/services/lego_blocks/integrations/schedulesBlock'

const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/
const LABEL_PREFIX = 'com.thinkingspace.'

interface ScheduleFormBlockProps {
  mode: 'create' | 'edit'
  editKey?: string
  /** Fires after a successful save so parents can refresh state / re-fetch. */
  onSaved?: (spec: ScheduleSpecBlock) => void
  /** Notified when the spec for editKey is loaded (lets parents render run controls). */
  onLoaded?: (spec: ScheduleSpecBlock) => void
}

type ExecutionKind = ScheduleExecutionSpecBlock['kind']
type TriggerKind = ScheduleTriggerSpecBlock['kind']

// launchd weekday numbers: 1=Mon, 2=Tue, ..., 6=Sat, 7=Sun. Empty array = every day.
const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

interface FormState {
  key: string
  title: string
  description: string
  enabled: boolean
  triggerKind: TriggerKind
  calendarEntries: Array<{ hour: number; minute: number }>
  // Weekdays apply uniformly to every calendar entry. Empty = every day.
  calendarWeekdays: number[]
  intervalSeconds: number
  windowStartHour: number
  windowStartMinute: number
  windowStopHour: number
  windowStopMinute: number
  windowWeekdays: number[]
  executionKind: ExecutionKind
  shellCommand: string
  shellArgsText: string
  shellCwd: string
  ccPrompt: string
  ccCwd: string
  ccSessionMode: ScheduleSessionModeBlock
  ccSessionId: string
  ccModel: string
  ccSkipPermissions: boolean
  ccBinary: string
}

function defaultState(): FormState {
  return {
    key: '',
    title: '',
    description: '',
    enabled: true,
    triggerKind: 'calendar',
    calendarEntries: [{ hour: 9, minute: 0 }],
    calendarWeekdays: [],
    intervalSeconds: 3600,
    windowStartHour: 9,
    windowStartMinute: 0,
    windowStopHour: 17,
    windowStopMinute: 0,
    windowWeekdays: [1, 2, 3, 4, 5],
    executionKind: 'claude-code',
    shellCommand: '',
    shellArgsText: '',
    shellCwd: '',
    ccPrompt: '',
    ccCwd: '',
    ccSessionMode: 'new',
    ccSessionId: '',
    ccModel: '',
    ccSkipPermissions: false,
    ccBinary: '',
  }
}

function stateFromSpec(spec: ScheduleSpecBlock): FormState {
  const base = defaultState()
  base.key = spec.key
  base.title = spec.title
  base.description = spec.description ?? ''
  base.enabled = spec.enabled
  if (spec.schedule.kind === 'calendar') {
    base.triggerKind = 'calendar'
    // Collapse per-entry weekdays into a uniform global set if all entries
    // agree; otherwise drop and warn (rare; happens only for hand-edited JSON
    // with heterogeneous weekday configuration).
    const uniqueTimes = new Map<string, { hour: number; minute: number; weekdays: Set<number> }>()
    for (const e of spec.schedule.entries) {
      const key = `${e.hour}:${e.minute}`
      const slot = uniqueTimes.get(key) ?? { hour: e.hour, minute: e.minute, weekdays: new Set<number>() }
      if (typeof e.weekday === 'number') slot.weekdays.add(e.weekday)
      uniqueTimes.set(key, slot)
    }
    base.calendarEntries = Array.from(uniqueTimes.values()).map((s) => ({ hour: s.hour, minute: s.minute }))
    const weekdaySets = Array.from(uniqueTimes.values()).map((s) => Array.from(s.weekdays).sort().join(','))
    const allMatch = weekdaySets.every((s) => s === weekdaySets[0])
    base.calendarWeekdays = allMatch && weekdaySets[0] ? weekdaySets[0].split(',').map(Number) : []
  } else if (spec.schedule.kind === 'interval') {
    base.triggerKind = 'interval'
    base.intervalSeconds = spec.schedule.seconds
  } else {
    base.triggerKind = 'window'
    base.windowStartHour = spec.schedule.start.hour
    base.windowStartMinute = spec.schedule.start.minute
    base.windowStopHour = spec.schedule.stop.hour
    base.windowStopMinute = spec.schedule.stop.minute
    base.windowWeekdays = spec.schedule.weekdays ?? []
  }
  if (spec.execution.kind === 'shell') {
    base.executionKind = 'shell'
    base.shellCommand = spec.execution.command
    base.shellArgsText = spec.execution.args.join('\n')
    base.shellCwd = spec.execution.cwd ?? ''
  } else {
    base.executionKind = 'claude-code'
    base.ccPrompt = spec.execution.prompt
    base.ccCwd = spec.execution.cwd
    base.ccSessionMode = spec.execution.session?.mode ?? 'new'
    base.ccSessionId = spec.execution.session?.id ?? ''
    base.ccModel = spec.execution.model ?? ''
    base.ccSkipPermissions = spec.execution.skipPermissions ?? false
    base.ccBinary = spec.execution.claudeBinary ?? ''
  }
  return base
}

function validate(s: FormState): string | null {
  if (!s.key.trim()) return 'Key is required'
  if (!KEY_PATTERN.test(s.key)) return 'Key must be lowercase letters, digits, hyphens (max 63 chars, no leading hyphen)'
  if (!s.title.trim()) return 'Title is required'
  if (s.triggerKind === 'calendar') {
    if (s.calendarEntries.length === 0) return 'At least one calendar entry is required'
    for (const e of s.calendarEntries) {
      if (!Number.isFinite(e.hour) || e.hour < 0 || e.hour > 23) return 'Hour must be 0–23'
      if (!Number.isFinite(e.minute) || e.minute < 0 || e.minute > 59) return 'Minute must be 0–59'
    }
  } else if (s.triggerKind === 'interval') {
    if (!Number.isFinite(s.intervalSeconds) || s.intervalSeconds <= 0) return 'Interval seconds must be positive'
  } else {
    if (!Number.isFinite(s.windowStartHour) || s.windowStartHour < 0 || s.windowStartHour > 23) return 'Start hour must be 0–23'
    if (!Number.isFinite(s.windowStartMinute) || s.windowStartMinute < 0 || s.windowStartMinute > 59) return 'Start minute must be 0–59'
    if (!Number.isFinite(s.windowStopHour) || s.windowStopHour < 0 || s.windowStopHour > 23) return 'Stop hour must be 0–23'
    if (!Number.isFinite(s.windowStopMinute) || s.windowStopMinute < 0 || s.windowStopMinute > 59) return 'Stop minute must be 0–59'
    const startMin = s.windowStartHour * 60 + s.windowStartMinute
    const stopMin = s.windowStopHour * 60 + s.windowStopMinute
    if (stopMin <= startMin) return 'Stop time must be after start time (overnight windows not supported)'
  }
  if (s.executionKind === 'shell') {
    if (!s.shellCommand.trim()) return 'Shell command is required'
  } else {
    if (!s.ccPrompt.trim()) return 'Prompt is required'
    if (!s.ccCwd.trim()) return 'Working directory is required for claude-code'
    if (s.ccSessionMode === 'resume' && !s.ccSessionId.trim()) return 'Session id is required for resume mode'
  }
  return null
}

function buildSpec(s: FormState, originalCreatedAt?: string): ScheduleSpecBlock {
  const now = new Date().toISOString()
  let schedule: ScheduleTriggerSpecBlock
  if (s.triggerKind === 'calendar') {
    const days = s.calendarWeekdays
    const entries = s.calendarEntries.flatMap((e) =>
      days.length === 0
        ? [{ hour: e.hour, minute: e.minute }]
        : days.map((wd) => ({ hour: e.hour, minute: e.minute, weekday: wd })),
    )
    schedule = { kind: 'calendar', entries }
  } else if (s.triggerKind === 'interval') {
    schedule = { kind: 'interval', seconds: s.intervalSeconds }
  } else {
    schedule = {
      kind: 'window',
      start: { hour: s.windowStartHour, minute: s.windowStartMinute },
      stop: { hour: s.windowStopHour, minute: s.windowStopMinute },
      ...(s.windowWeekdays.length > 0 ? { weekdays: s.windowWeekdays } : {}),
    }
  }

  const execution: ScheduleExecutionSpecBlock = s.executionKind === 'shell'
    ? {
      kind: 'shell',
      command: s.shellCommand.trim(),
      args: s.shellArgsText.split('\n').map((line) => line.trim()).filter(Boolean),
      cwd: s.shellCwd.trim() || null,
    }
    : {
      kind: 'claude-code',
      prompt: s.ccPrompt,
      cwd: s.ccCwd.trim(),
      session: { mode: s.ccSessionMode, id: s.ccSessionMode === 'resume' ? s.ccSessionId.trim() : null },
      model: s.ccModel.trim() || null,
      skipPermissions: s.ccSkipPermissions,
      claudeBinary: s.ccBinary.trim() || null,
    }

  return {
    key: s.key.trim(),
    label: `${LABEL_PREFIX}${s.key.trim()}`,
    title: s.title.trim(),
    description: s.description.trim() || undefined,
    enabled: s.enabled,
    schedule,
    execution,
    managedBy: 'thinking-space',
    createdAt: originalCreatedAt ?? now,
    updatedAt: now,
  }
}

const FIELD_LABEL = 'text-xs font-medium text-muted-foreground mb-1'
const INPUT_BASE = 'w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function WeekdayPicker({ selected, onChange }: { selected: number[]; onChange: (next: number[]) => void }) {
  const set = new Set(selected)
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAY_OPTIONS.map(({ value, label }) => {
        const active = set.has(value)
        return (
          <button
            key={value}
            type="button"
            onClick={() => {
              const next = new Set(set)
              if (active) next.delete(value); else next.add(value)
              onChange(Array.from(next).sort((a, b) => a - b))
            }}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input bg-background text-muted-foreground hover:bg-accent',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default function ScheduleFormBlock({ mode, editKey, onSaved, onLoaded }: ScheduleFormBlockProps) {
  const navigate = useNavigate()
  const [state, setState] = useState<FormState>(defaultState)
  const [loading, setLoading] = useState(mode === 'edit')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [originalCreatedAt, setOriginalCreatedAt] = useState<string | undefined>()

  useEffect(() => {
    if (mode !== 'edit' || !editKey) return
    let cancelled = false
    setLoading(true)
    getScheduleByKeyOrch(editKey)
      .then((spec) => {
        if (cancelled) return
        if (!spec) {
          setError(`Schedule "${editKey}" not found`)
        } else {
          setState(stateFromSpec(spec))
          setOriginalCreatedAt(spec.createdAt)
          onLoaded?.(spec)
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [mode, editKey])

  const previewLabel = useMemo(() => state.key.trim() ? `${LABEL_PREFIX}${state.key.trim()}` : `${LABEL_PREFIX}…`, [state.key])

  const handleSave = useCallback(async () => {
    const problem = validate(state)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setBusy(true)
    try {
      const spec = buildSpec(state, originalCreatedAt)
      const saved = await saveAndSyncScheduleOrch(spec)
      onSaved?.(saved)
      if (mode === 'create') {
        navigate(`/ai/schedules/${saved.key}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }, [state, originalCreatedAt, mode, navigate, onSaved])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Label: <code className="font-mono">{previewLabel}</code>
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Basics ── */}
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Basics</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={FIELD_LABEL}>Key (slug)</div>
            <input
              className={INPUT_BASE}
              value={state.key}
              onChange={(e) => setState((s) => ({ ...s, key: e.target.value }))}
              disabled={mode === 'edit'}
              placeholder="my-schedule"
            />
          </div>
          <div>
            <div className={FIELD_LABEL}>Title</div>
            <input
              className={INPUT_BASE}
              value={state.title}
              onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
              placeholder="Nightly autocommit"
            />
          </div>
        </div>
        <div>
          <div className={FIELD_LABEL}>Description (optional)</div>
          <textarea
            className={cn(INPUT_BASE, 'min-h-[3rem]')}
            value={state.description}
            onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
            rows={2}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={state.enabled}
            onCheckedChange={(checked) => setState((s) => ({ ...s, enabled: checked }))}
          />
          Enabled (bootstrap into launchd on save)
        </label>
      </section>

      {/* ── Schedule trigger ── */}
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Schedule</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={state.triggerKind === 'calendar'}
              onChange={() => setState((s) => ({ ...s, triggerKind: 'calendar' }))}
            />
            Calendar (specific times)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={state.triggerKind === 'interval'}
              onChange={() => setState((s) => ({ ...s, triggerKind: 'interval' }))}
            />
            Interval (every N seconds)
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={state.triggerKind === 'window'}
              onChange={() => setState((s) => ({ ...s, triggerKind: 'window' }))}
            />
            Window (run from start to stop)
          </label>
        </div>

        {state.triggerKind === 'calendar' ? (
          <div className="space-y-2">
            {state.calendarEntries.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  className={cn(INPUT_BASE, 'w-20')}
                  type="number"
                  min={0}
                  max={23}
                  value={entry.hour}
                  onChange={(e) => {
                    const hour = Number.parseInt(e.target.value, 10)
                    setState((s) => ({
                      ...s,
                      calendarEntries: s.calendarEntries.map((x, i) => i === idx ? { ...x, hour } : x),
                    }))
                  }}
                />
                <span className="text-muted-foreground">:</span>
                <input
                  className={cn(INPUT_BASE, 'w-20')}
                  type="number"
                  min={0}
                  max={59}
                  value={entry.minute}
                  onChange={(e) => {
                    const minute = Number.parseInt(e.target.value, 10)
                    setState((s) => ({
                      ...s,
                      calendarEntries: s.calendarEntries.map((x, i) => i === idx ? { ...x, minute } : x),
                    }))
                  }}
                />
                {state.calendarEntries.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setState((s) => ({
                      ...s,
                      calendarEntries: s.calendarEntries.filter((_, i) => i !== idx),
                    }))}
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setState((s) => ({
                ...s,
                calendarEntries: [...s.calendarEntries, { hour: 0, minute: 0 }],
              }))}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add time
            </Button>
            <div className="pt-2">
              <div className={FIELD_LABEL}>Days (leave all unchecked for every day)</div>
              <WeekdayPicker
                selected={state.calendarWeekdays}
                onChange={(weekdays) => setState((s) => ({ ...s, calendarWeekdays: weekdays }))}
              />
            </div>
          </div>
        ) : state.triggerKind === 'interval' ? (
          <div>
            <div className={FIELD_LABEL}>Seconds between fires</div>
            <input
              className={cn(INPUT_BASE, 'w-40')}
              type="number"
              min={1}
              value={state.intervalSeconds}
              onChange={(e) => setState((s) => ({ ...s, intervalSeconds: Number.parseInt(e.target.value, 10) }))}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Window jobs spawn the command at start time and SIGTERM it at stop time.
              Suitable for long-running processes that should only run during a daily window.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={FIELD_LABEL}>Start (HH:MM)</div>
                <div className="flex items-center gap-2">
                  <input
                    className={cn(INPUT_BASE, 'w-20')}
                    type="number" min={0} max={23}
                    value={state.windowStartHour}
                    onChange={(e) => setState((s) => ({ ...s, windowStartHour: Number.parseInt(e.target.value, 10) }))}
                  />
                  <span className="text-muted-foreground">:</span>
                  <input
                    className={cn(INPUT_BASE, 'w-20')}
                    type="number" min={0} max={59}
                    value={state.windowStartMinute}
                    onChange={(e) => setState((s) => ({ ...s, windowStartMinute: Number.parseInt(e.target.value, 10) }))}
                  />
                </div>
              </div>
              <div>
                <div className={FIELD_LABEL}>Stop (HH:MM)</div>
                <div className="flex items-center gap-2">
                  <input
                    className={cn(INPUT_BASE, 'w-20')}
                    type="number" min={0} max={23}
                    value={state.windowStopHour}
                    onChange={(e) => setState((s) => ({ ...s, windowStopHour: Number.parseInt(e.target.value, 10) }))}
                  />
                  <span className="text-muted-foreground">:</span>
                  <input
                    className={cn(INPUT_BASE, 'w-20')}
                    type="number" min={0} max={59}
                    value={state.windowStopMinute}
                    onChange={(e) => setState((s) => ({ ...s, windowStopMinute: Number.parseInt(e.target.value, 10) }))}
                  />
                </div>
              </div>
            </div>
            <div>
              <div className={FIELD_LABEL}>Days (leave all unchecked for every day)</div>
              <WeekdayPicker
                selected={state.windowWeekdays}
                onChange={(weekdays) => setState((s) => ({ ...s, windowWeekdays: weekdays }))}
              />
            </div>
          </div>
        )}
      </section>

      {/* ── Execution ── */}
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Execution</h3>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={state.executionKind === 'shell'}
              onChange={() => setState((s) => ({ ...s, executionKind: 'shell' }))}
            />
            Shell command
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={state.executionKind === 'claude-code'}
              onChange={() => setState((s) => ({ ...s, executionKind: 'claude-code' }))}
            />
            Claude Code
          </label>
        </div>

        {state.executionKind === 'shell' ? (
          <div className="space-y-3">
            <div>
              <div className={FIELD_LABEL}>Command (absolute path)</div>
              <input
                className={INPUT_BASE}
                value={state.shellCommand}
                onChange={(e) => setState((s) => ({ ...s, shellCommand: e.target.value }))}
                placeholder="/Users/you/.cc-anchor/autocommit.sh"
              />
            </div>
            <div>
              <div className={FIELD_LABEL}>Arguments (one per line)</div>
              <textarea
                className={cn(INPUT_BASE, 'min-h-[4rem] font-mono text-xs')}
                value={state.shellArgsText}
                onChange={(e) => setState((s) => ({ ...s, shellArgsText: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <div className={FIELD_LABEL}>Working directory (optional)</div>
              <input
                className={INPUT_BASE}
                value={state.shellCwd}
                onChange={(e) => setState((s) => ({ ...s, shellCwd: e.target.value }))}
                placeholder="/Volumes/.../Thinking-Space"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className={FIELD_LABEL}>Prompt</div>
              <textarea
                className={cn(INPUT_BASE, 'min-h-[6rem]')}
                value={state.ccPrompt}
                onChange={(e) => setState((s) => ({ ...s, ccPrompt: e.target.value }))}
                placeholder="What should Claude do?"
                rows={5}
              />
            </div>
            <div>
              <div className={FIELD_LABEL}>Working directory</div>
              <input
                className={INPUT_BASE}
                value={state.ccCwd}
                onChange={(e) => setState((s) => ({ ...s, ccCwd: e.target.value }))}
                placeholder="/Volumes/.../Thinking-Space"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={FIELD_LABEL}>Session mode</div>
                <select
                  className={INPUT_BASE}
                  value={state.ccSessionMode}
                  onChange={(e) => setState((s) => ({ ...s, ccSessionMode: e.target.value as ScheduleSessionModeBlock }))}
                >
                  <option value="new">New (fresh context)</option>
                  <option value="continue">Continue (last session in cwd)</option>
                  <option value="resume">Resume (specific id)</option>
                </select>
              </div>
              {state.ccSessionMode === 'resume' && (
                <div>
                  <div className={FIELD_LABEL}>Session id</div>
                  <input
                    className={INPUT_BASE}
                    value={state.ccSessionId}
                    onChange={(e) => setState((s) => ({ ...s, ccSessionId: e.target.value }))}
                    placeholder="01H…"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={FIELD_LABEL}>Model (optional)</div>
                <input
                  className={INPUT_BASE}
                  value={state.ccModel}
                  onChange={(e) => setState((s) => ({ ...s, ccModel: e.target.value }))}
                  placeholder="opus / sonnet / haiku"
                />
              </div>
              <div>
                <div className={FIELD_LABEL}>Claude binary (optional)</div>
                <input
                  className={INPUT_BASE}
                  value={state.ccBinary}
                  onChange={(e) => setState((s) => ({ ...s, ccBinary: e.target.value }))}
                  placeholder="/opt/homebrew/bin/claude"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={state.ccSkipPermissions}
                onCheckedChange={(checked) => setState((s) => ({ ...s, ccSkipPermissions: checked }))}
              />
              Skip permission prompts (<code className="font-mono">--dangerously-skip-permissions</code>)
            </label>
          </div>
        )}
      </section>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end">
        <Button onClick={handleSave} disabled={busy}>
          {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Create schedule' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
