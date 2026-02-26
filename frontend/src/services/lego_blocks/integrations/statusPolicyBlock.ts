import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import type { NodeStatus } from '@/services/lego_blocks/units/yamlNoteBlock'

const TASK_STATUS_ALIASES: Record<string, string> = {
  inprogress: 'in_progress',
  in_progress: 'in_progress',
  doing: 'in_progress',
  underway: 'in_progress',
  open: 'ready',
  todo: 'ready',
  to_do: 'ready',
  pending: 'ready',
  backlog: 'ready',
  blocked: 'blocked',
  stuck: 'blocked',
  waiting: 'blocked',
  on_hold: 'blocked',
  paused: 'blocked',
  done: 'done',
  complete: 'done',
  completed: 'done',
  closed: 'done',
  resolved: 'done',
  shipped: 'done',
  archived: 'cancelled',
  canceled: 'cancelled',
  cancelled: 'cancelled',
  dropped: 'cancelled',
}

const TERMINAL_DONE = new Set(['done'])
const TERMINAL_ARCHIVED = new Set(['cancelled'])
const NON_TERMINAL_ACTIVE = new Set(['ready', 'in_progress', 'blocked'])

export function normalizeTaskStatus(taskStatus: string | undefined): string | undefined {
  if (!taskStatus) return undefined
  const canonical = taskStatus.trim().toLowerCase().replace(/\s+/g, '_')
  if (!canonical) return undefined
  return TASK_STATUS_ALIASES[canonical] ?? canonical
}

export function isTaskLikeNode(
  node: Pick<NodeRecord, 'recordKind' | 'taskStatus'> & { type?: NodeRecord['type'] },
): boolean {
  return node.type === 'task' || node.recordKind === 'task' || !!normalizeTaskStatus(node.taskStatus)
}

export function nodeStatusFromTaskStatus(taskStatus: string | undefined): NodeStatus {
  const normalized = normalizeTaskStatus(taskStatus)
  if (!normalized) return 'active'
  if (TERMINAL_ARCHIVED.has(normalized)) return 'cancelled'
  if (TERMINAL_DONE.has(normalized)) return 'completed'
  if (normalized === 'blocked') return 'paused'
  return 'active'
}

export function taskStatusFromNodeStatus(status: NodeStatus): string {
  if (status === 'completed') return 'done'
  if (status === 'archived' || status === 'cancelled') return 'cancelled'
  if (status === 'incomplete') return 'ready'
  if (status === 'paused') return 'blocked'
  return 'in_progress'
}

export function deriveEpicStatusFromTaskStatuses(taskStatuses: Array<string | undefined>): NodeStatus | null {
  const normalized = taskStatuses
    .map(status => normalizeTaskStatus(status))
    .filter((value): value is string => !!value)

  if (normalized.length === 0) return null

  const hasNonTerminal = normalized.some(status => NON_TERMINAL_ACTIVE.has(status))
  if (hasNonTerminal) return 'active'

  const allArchived = normalized.every(status => TERMINAL_ARCHIVED.has(status))
  if (allArchived) return 'cancelled'

  return 'completed'
}
