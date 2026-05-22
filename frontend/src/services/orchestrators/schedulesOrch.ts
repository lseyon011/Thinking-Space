// Workflow orchestration for the schedules system.
// Layers user-facing operations (list-with-status, fire-now-via-http, etc.)
// on top of the IPC bridge in schedulesBlock.

import {
  deleteScheduleBlock,
  getLaunchctlStatusBlock,
  getScheduleBlock,
  getScheduleServerInfoBlock,
  kickstartScheduleBlock,
  listLaunchdLabelsBlock,
  listSchedulesBlock,
  saveScheduleBlock,
  type ScheduleRunResultBlock,
  type ScheduleSpecBlock,
  type ScheduleStatusBlock,
} from '@/services/lego_blocks/integrations/schedulesBlock'

export interface ScheduleWithStatusBlock {
  spec: ScheduleSpecBlock
  status: ScheduleStatusBlock
}

export interface ExternalLaunchdAgentBlock {
  label: string
  managed: 'thinking-space' | 'external'
}

export async function listSchedulesWithStatusOrch(): Promise<ScheduleWithStatusBlock[]> {
  const specs = await listSchedulesBlock()
  if (specs.length === 0) return []
  const statuses = await Promise.all(specs.map((spec) => getLaunchctlStatusBlock(spec.label)))
  return specs.map((spec, idx) => ({ spec, status: statuses[idx] }))
}

export async function listExternalLaunchdAgentsOrch(): Promise<ExternalLaunchdAgentBlock[]> {
  const [labels, managedSpecs] = await Promise.all([listLaunchdLabelsBlock(), listSchedulesBlock()])
  const managedLabelSet = new Set(managedSpecs.map((spec) => spec.label))
  return labels.map((label) => ({
    label,
    managed: managedLabelSet.has(label) ? 'thinking-space' : 'external',
  }))
}

export async function saveAndSyncScheduleOrch(spec: ScheduleSpecBlock): Promise<ScheduleSpecBlock> {
  return saveScheduleBlock(spec)
}

export async function deleteAndUnloadScheduleOrch(key: string): Promise<boolean> {
  return deleteScheduleBlock(key)
}

export async function fireScheduleNowOrch(spec: ScheduleSpecBlock): Promise<ScheduleRunResultBlock> {
  const info = await getScheduleServerInfoBlock()
  if (!info) {
    throw new Error('Schedule HTTP server not running')
  }
  const response = await fetch(`${info.baseUrl}/schedules/${spec.key}/fire`, {
    method: 'POST',
    headers: { 'X-Schedule-Secret': info.secret },
  })
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(`Fire failed: ${response.status} ${message}`)
  }
  const body = (await response.json()) as { ok: boolean; result: ScheduleRunResultBlock }
  if (!body.ok) throw new Error('Fire returned non-ok response')
  return body.result
}

export async function kickstartScheduleViaLaunchctlOrch(label: string): Promise<void> {
  await kickstartScheduleBlock(label)
}

export async function getScheduleByKeyOrch(key: string): Promise<ScheduleSpecBlock | null> {
  return getScheduleBlock(key)
}
