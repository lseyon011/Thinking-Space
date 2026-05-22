// Renderer-side bridge to the electron schedules IPC channels.
// Types mirror the electron contract in
// frontend/electron/src/lego_blocks/scheduleStorageBlock.ts
//
// The bridge accessor uses a local typed cast to avoid mutating the global
// ElectronAPI declaration in fsBlock.ts — schedules methods are optional on
// the window.electronAPI surface and only present when running in Electron.

export type ScheduleExecutionSpecBlock = {
  kind: 'shell'
  command: string
  args: string[]
  env?: Record<string, string>
  cwd?: string | null
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
  durationMs: number
  errorMessage?: string
}

export interface ScheduleStatusBlock {
  loaded: boolean
  pid: number | null
  lastExitCode: number | null
}

export interface ScheduleServerInfoBlock {
  port: number
  secret: string
  baseUrl: string
}

interface ScheduleBridgeApi {
  schedulesList?(): Promise<ScheduleSpecBlock[]>
  schedulesGet?(key: string): Promise<ScheduleSpecBlock | null>
  schedulesSave?(spec: ScheduleSpecBlock): Promise<ScheduleSpecBlock>
  schedulesDelete?(key: string): Promise<boolean>
  schedulesServerInfo?(): Promise<ScheduleServerInfoBlock | null>
  schedulesKickstart?(label: string): Promise<void>
  schedulesStatus?(label: string): Promise<ScheduleStatusBlock>
  schedulesListLaunchdLabels?(): Promise<string[]>
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
