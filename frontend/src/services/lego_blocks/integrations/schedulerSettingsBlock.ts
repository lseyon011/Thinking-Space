import {
  STORAGE_KEYS,
  getJsonStorageItem,
  setJsonStorageItem,
} from '@/services/lego_blocks/units/storageKeyBlock'

export type ScheduledTaskActionBlock = 'vault_sync'

export interface ScheduledTaskBlock {
  id: string
  action: ScheduledTaskActionBlock
  enabled: boolean
  timesOfDay: string[]
}

export interface SchedulerSettingsBlock {
  tasks: ScheduledTaskBlock[]
}

export interface ScheduledTaskActionOptionBlock {
  id: ScheduledTaskActionBlock
  label: string
  description: string
}

const DEFAULT_TASK_ID_BY_ACTION_BLOCK: Record<ScheduledTaskActionBlock, string> = {
  vault_sync: 'vault-sync',
}

export const SCHEDULED_TASK_ACTION_OPTIONS_BLOCK: ScheduledTaskActionOptionBlock[] = [
  {
    id: 'vault_sync',
    label: 'Vault Sync',
    description: 'Runs the standard smart sync path to refresh the IndexedDB cache from your vault.',
  },
]

function defaultScheduledTaskBlock(action: ScheduledTaskActionBlock): ScheduledTaskBlock {
  return {
    id: DEFAULT_TASK_ID_BY_ACTION_BLOCK[action],
    action,
    enabled: false,
    timesOfDay: ['03:00'],
  }
}

const DEFAULT_SCHEDULER_SETTINGS_BLOCK: SchedulerSettingsBlock = {
  tasks: SCHEDULED_TASK_ACTION_OPTIONS_BLOCK.map((option) => defaultScheduledTaskBlock(option.id)),
}

function sanitizeTimeOfDayBlock(value: unknown): string {
  if (typeof value !== 'string') return '03:00'
  const trimmed = value.trim()
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return '03:00'
  const [hourRaw, minuteRaw] = trimmed.split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return '03:00'
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '03:00'
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

function sanitizeTimesOfDayBlock(value: unknown): string[] {
  if (Array.isArray(value) && value.length > 0) {
    const sanitized = value.map(v => sanitizeTimeOfDayBlock(v))
    // Deduplicate and sort
    return [...new Set(sanitized)].sort()
  }
  return ['03:00']
}

function sanitizeScheduledTaskActionBlock(value: unknown): ScheduledTaskActionBlock | null {
  return SCHEDULED_TASK_ACTION_OPTIONS_BLOCK.some((option) => option.id === value)
    ? value as ScheduledTaskActionBlock
    : null
}

function parseTimeOfDayToMinutesBlock(timeOfDay: string): number {
  const [hourRaw, minuteRaw] = sanitizeTimeOfDayBlock(timeOfDay).split(':')
  return (Number(hourRaw) * 60) + Number(minuteRaw)
}

export function sanitizeScheduledTaskBlock(
  value: Partial<ScheduledTaskBlock> & { timeOfDay?: string; frequencyHours?: number } | null | undefined,
): ScheduledTaskBlock | null {
  const action = sanitizeScheduledTaskActionBlock(value?.action)
  if (!action) return null
  const fallback = defaultScheduledTaskBlock(action)
  const id = typeof value?.id === 'string' && value.id.trim()
    ? value.id.trim()
    : fallback.id

  // Migrate legacy single timeOfDay + frequencyHours → timesOfDay
  let timesOfDay: string[]
  if (Array.isArray(value?.timesOfDay) && value.timesOfDay.length > 0) {
    timesOfDay = sanitizeTimesOfDayBlock(value.timesOfDay)
  } else if (typeof value?.timeOfDay === 'string') {
    const anchor = sanitizeTimeOfDayBlock(value.timeOfDay)
    const freq = typeof value?.frequencyHours === 'number' ? value.frequencyHours : 24
    if (freq < 24 && freq > 0) {
      // Expand legacy frequency into explicit times: e.g. anchor 03:00 + every 6h → 03:00, 09:00, 15:00, 21:00
      const anchorMinutes = parseTimeOfDayToMinutesBlock(anchor)
      const intervalMinutes = freq * 60
      const times: string[] = []
      for (let i = 0; i < Math.floor(1440 / intervalMinutes); i++) {
        const m = (anchorMinutes + i * intervalMinutes) % 1440
        times.push(`${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`)
      }
      timesOfDay = [...new Set(times)].sort()
    } else {
      timesOfDay = [anchor]
    }
  } else {
    timesOfDay = fallback.timesOfDay
  }

  return {
    id,
    action,
    enabled: value?.enabled ?? fallback.enabled,
    timesOfDay,
  }
}

export function sanitizeSchedulerSettingsBlock(
  value: Partial<SchedulerSettingsBlock> | null | undefined,
): SchedulerSettingsBlock {
  const normalizedByAction = new Map<ScheduledTaskActionBlock, ScheduledTaskBlock>()
  for (const rawTask of Array.isArray(value?.tasks) ? value.tasks : []) {
    const task = sanitizeScheduledTaskBlock(rawTask)
    if (!task) continue
    if (normalizedByAction.has(task.action)) continue
    normalizedByAction.set(task.action, task)
  }

  const tasks = SCHEDULED_TASK_ACTION_OPTIONS_BLOCK.map((option) => (
    normalizedByAction.get(option.id) ?? defaultScheduledTaskBlock(option.id)
  ))

  return { tasks }
}

export function getDefaultSchedulerSettingsBlock(): SchedulerSettingsBlock {
  return sanitizeSchedulerSettingsBlock(DEFAULT_SCHEDULER_SETTINGS_BLOCK)
}

export function readSchedulerSettingsBlock(): SchedulerSettingsBlock {
  const raw = getJsonStorageItem<Partial<SchedulerSettingsBlock> | null>(
    STORAGE_KEYS.schedulerSettings,
    null,
  )
  return sanitizeSchedulerSettingsBlock(raw)
}

export function writeSchedulerSettingsBlock(settings: SchedulerSettingsBlock): SchedulerSettingsBlock {
  const sanitized = sanitizeSchedulerSettingsBlock(settings)
  setJsonStorageItem(STORAGE_KEYS.schedulerSettings, sanitized)
  return sanitized
}

export function readScheduledTaskLastAttemptByIdBlock(): Record<string, number> {
  const raw = getJsonStorageItem<Record<string, unknown> | null>(
    STORAGE_KEYS.schedulerTaskLastAttemptById,
    null,
  )
  if (!raw || typeof raw !== 'object') return {}
  const normalized: Record<string, number> = {}
  for (const [taskId, timestamp] of Object.entries(raw)) {
    const parsed = Number(timestamp)
    if (!Number.isFinite(parsed) || parsed <= 0) continue
    normalized[taskId] = Math.floor(parsed)
  }
  return normalized
}

export function writeScheduledTaskLastAttemptByIdBlock(lastAttemptById: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {}
  for (const [taskId, timestamp] of Object.entries(lastAttemptById)) {
    if (!taskId.trim()) continue
    const parsed = Number(timestamp)
    if (!Number.isFinite(parsed) || parsed <= 0) continue
    normalized[taskId.trim()] = Math.floor(parsed)
  }
  setJsonStorageItem(STORAGE_KEYS.schedulerTaskLastAttemptById, normalized)
  return normalized
}

export function writeScheduledTaskLastAttemptAtBlock(taskId: string, timestampMs: number): Record<string, number> {
  const normalizedTaskId = taskId.trim()
  if (!normalizedTaskId) return readScheduledTaskLastAttemptByIdBlock()
  const next = {
    ...readScheduledTaskLastAttemptByIdBlock(),
    [normalizedTaskId]: Math.floor(Number.isFinite(timestampMs) && timestampMs > 0 ? timestampMs : Date.now()),
  }
  return writeScheduledTaskLastAttemptByIdBlock(next)
}

// ── Scheduling math ──

/** Get all scheduled run timestamps for today, sorted ascending. */
function getTodayRunTimestampsBlock(task: ScheduledTaskBlock, referenceMs: number): number[] {
  const ref = new Date(referenceMs)
  return task.timesOfDay.map(time => {
    const minutes = parseTimeOfDayToMinutesBlock(time)
    return new Date(
      ref.getFullYear(),
      ref.getMonth(),
      ref.getDate(),
      Math.floor(minutes / 60),
      minutes % 60,
      0,
      0,
    ).getTime()
  }).sort((a, b) => a - b)
}

export function getPreviousScheduledTaskRunAtBlock(
  task: ScheduledTaskBlock,
  nowMs = Date.now(),
): number | null {
  if (!task.enabled || task.timesOfDay.length === 0) return null
  const todayRuns = getTodayRunTimestampsBlock(task, nowMs)
  // Find the latest run that's <= now
  for (let i = todayRuns.length - 1; i >= 0; i--) {
    if (todayRuns[i] <= nowMs) return todayRuns[i]
  }
  // All today's runs are in the future — previous was the last run yesterday
  const yesterdayRuns = getTodayRunTimestampsBlock(task, nowMs - 86_400_000)
  return yesterdayRuns.length > 0 ? yesterdayRuns[yesterdayRuns.length - 1] : null
}

export function getNextScheduledTaskRunAtBlock(
  task: ScheduledTaskBlock,
  nowMs = Date.now(),
): number | null {
  if (!task.enabled || task.timesOfDay.length === 0) return null
  const todayRuns = getTodayRunTimestampsBlock(task, nowMs)
  // Find the earliest run that's > now
  for (const runAt of todayRuns) {
    if (runAt > nowMs) return runAt
  }
  // All today's runs have passed — next is the first run tomorrow
  const tomorrowRuns = getTodayRunTimestampsBlock(task, nowMs + 86_400_000)
  return tomorrowRuns.length > 0 ? tomorrowRuns[0] : null
}

/** @deprecated Use timesOfDay-based scheduling. Kept for callers that still reference it. */
export function getScheduledTaskIntervalMsBlock(_task: ScheduledTaskBlock): number {
  return 86_400_000 // 24h fallback
}
