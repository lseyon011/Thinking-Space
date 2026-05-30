// Renderer-side bridge to the electron schedules IPC channels.
// Types mirror the electron contract in
// frontend/electron/src/lego_blocks/scheduleStorageBlock.ts
//
// The bridge accessor uses a local typed cast to avoid mutating the global
// ElectronAPI declaration in fsBlock.ts — schedules methods are optional on
// the window.electronAPI surface and only present when running in Electron.

export type ScheduleSessionModeBlock = 'new' | 'continue' | 'resume'

export type ScheduleExecutionSpecBlock =
  | {
      kind: 'shell'
      command: string
      args: string[]
      env?: Record<string, string>
      cwd?: string | null
    }
  | {
      kind: 'claude-code'
      prompt: string
      cwd: string
      session?: {
        mode: ScheduleSessionModeBlock
        id?: string | null
      }
      model?: string | null
      skipPermissions?: boolean
      claudeBinary?: string | null
      env?: Record<string, string>
      // Mirrors the electron-side flag: when true, a successful run with a
      // captured sessionId auto-opens a Telegram conversation and the poller
      // resumes the session on user replies. The UI needs to know this so it
      // can render "Awaiting reply" instead of treating exit-0 as "done".
      telegramConversation?: boolean
      cleanupSession?: boolean
    }

export type ScheduleTriggerSpecBlock =
  | {
      kind: 'calendar'
      entries: Array<{ hour: number; minute: number; weekday?: number }>
    }
  | {
      kind: 'interval'
      seconds: number
    }
  | {
      kind: 'window'
      start: { hour: number; minute: number }
      stop: { hour: number; minute: number }
      weekdays?: number[]
    }

export type ScheduleManagedByBlock = 'thinking-space' | 'external'

export interface ScheduleSpecBlock {
  key: string
  label: string
  title: string
  description?: string
  enabled: boolean
  execution: ScheduleExecutionSpecBlock
  schedule: ScheduleTriggerSpecBlock
  managedBy: ScheduleManagedByBlock
  createdAt: string
  updatedAt: string
}

export interface ScheduleRunResultBlock {
  key: string
  startedAt: string
  endedAt: string
  exitCode: number | null
  signal: string | null
  transcriptPath: string
  transcriptFilename: string
  durationMs: number
  errorMessage?: string
}

export interface ScheduleRunChunkBlock {
  channel: 'stdout' | 'stderr'
  timestamp: string
  line: string
}

export interface TranscriptEntryBlock {
  filename: string
  startedAt: string
  sizeBytes: number
  modifiedAt: string
}

export interface ScheduleStatusBlock {
  loaded: boolean
  pid: number | null
  lastExitCode: number | null
}

export interface TelegramConvHistoryEntryBlock {
  direction: 'in' | 'out'
  text: string
  at: string
}

export interface TelegramConvRecordBlock {
  convId: string
  chatId: number
  scheduleKey: string
  sessionId: string
  cwd?: string
  status: 'active' | 'closed' | string
  startedAt: string
  ttlAt?: string | null
  closedAt?: string | null
  closeReason?: string | null
  history?: TelegramConvHistoryEntryBlock[]
}

export interface TelegramConvStatusBlock {
  hasConversation: boolean
  conv: TelegramConvRecordBlock | null
  isActive: boolean
  lastInboundAt: string | null
  inboundCount: number
}

export interface ScheduleServerInfoBlock {
  port: number
  secret: string
  baseUrl: string
}

export interface NotificationsConfigBlock {
  ntfy: {
    topic: string | null
    server: string
    onSuccess: boolean
    onFailure: boolean
  }
}

interface ScheduleBridgeApi {
  schedulesList?(): Promise<ScheduleSpecBlock[]>
  schedulesGet?(key: string): Promise<ScheduleSpecBlock | null>
  schedulesSave?(spec: ScheduleSpecBlock): Promise<ScheduleSpecBlock>
  schedulesDelete?(key: string): Promise<boolean>
  schedulesServerInfo?(): Promise<ScheduleServerInfoBlock | null>
  schedulesKickstart?(label: string): Promise<void>
  schedulesFireNow?(key: string, options?: { streamChannel?: string }): Promise<ScheduleRunResultBlock>
  schedulesStatus?(label: string): Promise<ScheduleStatusBlock>
  schedulesListLaunchdLabels?(): Promise<string[]>
  schedulesTelegramConvStatus?(scheduleKey: string): Promise<TelegramConvStatusBlock>
  schedulesListTranscripts?(key: string): Promise<TranscriptEntryBlock[]>
  schedulesReadTranscript?(payload: { key: string; filename: string }): Promise<string>
  onScheduleRunChunk?(streamChannel: string, handler: (chunk: ScheduleRunChunkBlock) => void): () => void
  notificationsConfigGet?(): Promise<NotificationsConfigBlock>
  notificationsConfigSet?(partial: Partial<NotificationsConfigBlock>): Promise<NotificationsConfigBlock>
  notificationsTest?(): Promise<{ sent: boolean; reason?: string }>
}

function getBridge(): ScheduleBridgeApi | null {
  if (typeof window === 'undefined') return null
  const api = (window as unknown as { electronAPI?: ScheduleBridgeApi }).electronAPI
  return api && typeof api.schedulesList === 'function' ? api : null
}

export function isSchedulesBridgeAvailable(): boolean {
  return getBridge() !== null
}

function requireBridge(): ScheduleBridgeApi {
  const bridge = getBridge()
  if (!bridge) {
    throw new Error('Schedules bridge unavailable (not running in Electron, or app not yet ready)')
  }
  return bridge
}

export async function listSchedulesBlock(): Promise<ScheduleSpecBlock[]> {
  const bridge = requireBridge()
  return (await bridge.schedulesList?.()) ?? []
}

export async function getScheduleBlock(key: string): Promise<ScheduleSpecBlock | null> {
  const bridge = requireBridge()
  return (await bridge.schedulesGet?.(key)) ?? null
}

export async function saveScheduleBlock(spec: ScheduleSpecBlock): Promise<ScheduleSpecBlock> {
  const bridge = requireBridge()
  if (!bridge.schedulesSave) throw new Error('schedulesSave bridge unavailable')
  return bridge.schedulesSave(spec)
}

export async function deleteScheduleBlock(key: string): Promise<boolean> {
  const bridge = requireBridge()
  return (await bridge.schedulesDelete?.(key)) ?? false
}

export async function getScheduleServerInfoBlock(): Promise<ScheduleServerInfoBlock | null> {
  const bridge = requireBridge()
  return (await bridge.schedulesServerInfo?.()) ?? null
}

export async function kickstartScheduleBlock(label: string): Promise<void> {
  const bridge = requireBridge()
  if (!bridge.schedulesKickstart) throw new Error('schedulesKickstart bridge unavailable')
  await bridge.schedulesKickstart(label)
}

export async function fireScheduleByIpcBlock(
  key: string,
  options?: { streamChannel?: string },
): Promise<ScheduleRunResultBlock> {
  const bridge = requireBridge()
  if (!bridge.schedulesFireNow) throw new Error('schedulesFireNow bridge unavailable')
  return bridge.schedulesFireNow(key, options)
}

export async function listTranscriptsBlock(key: string): Promise<TranscriptEntryBlock[]> {
  const bridge = requireBridge()
  return (await bridge.schedulesListTranscripts?.(key)) ?? []
}

export async function readTranscriptBlock(key: string, filename: string): Promise<string> {
  const bridge = requireBridge()
  if (!bridge.schedulesReadTranscript) throw new Error('schedulesReadTranscript bridge unavailable')
  return bridge.schedulesReadTranscript({ key, filename })
}

export function subscribeRunChunksBlock(
  streamChannel: string,
  handler: (chunk: ScheduleRunChunkBlock) => void,
): () => void {
  const bridge = requireBridge()
  if (!bridge.onScheduleRunChunk) return () => undefined
  return bridge.onScheduleRunChunk(streamChannel, handler)
}

const DEFAULT_NOTIFICATIONS_CONFIG: NotificationsConfigBlock = {
  ntfy: { topic: null, server: 'ntfy.sh', onSuccess: false, onFailure: true },
}

export async function getNotificationsConfigBlock(): Promise<NotificationsConfigBlock> {
  const bridge = requireBridge()
  return (await bridge.notificationsConfigGet?.()) ?? DEFAULT_NOTIFICATIONS_CONFIG
}

export async function setNotificationsConfigBlock(partial: Partial<NotificationsConfigBlock>): Promise<NotificationsConfigBlock> {
  const bridge = requireBridge()
  if (!bridge.notificationsConfigSet) throw new Error('notificationsConfigSet bridge unavailable')
  return bridge.notificationsConfigSet(partial)
}

export async function testNotificationBlock(): Promise<{ sent: boolean; reason?: string }> {
  const bridge = requireBridge()
  if (!bridge.notificationsTest) throw new Error('notificationsTest bridge unavailable')
  return bridge.notificationsTest()
}

export async function getLaunchctlStatusBlock(label: string): Promise<ScheduleStatusBlock> {
  const bridge = requireBridge()
  if (!bridge.schedulesStatus) {
    return { loaded: false, pid: null, lastExitCode: null }
  }
  return bridge.schedulesStatus(label)
}

export async function listLaunchdLabelsBlock(): Promise<string[]> {
  const bridge = requireBridge()
  return (await bridge.schedulesListLaunchdLabels?.()) ?? []
}

export async function getTelegramConvStatusBlock(scheduleKey: string): Promise<TelegramConvStatusBlock> {
  const bridge = requireBridge()
  if (!bridge.schedulesTelegramConvStatus) {
    return { hasConversation: false, conv: null, isActive: false, lastInboundAt: null, inboundCount: 0 }
  }
  return bridge.schedulesTelegramConvStatus(scheduleKey)
}
