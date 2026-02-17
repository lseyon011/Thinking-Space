import type { CapabilityActor } from '../lego_blocks/capabilityRegistryBlock'
import type { NodeRecord } from '../lego_blocks/dbBlock'
import { normalizeTaskStatus } from '../lego_blocks/statusPolicyBlock'
import { invokeCapabilityOrThrow } from './capabilityRouterOrch'

interface ListInProgressExecutionTasksInput {
  actor: CapabilityActor
  projectRoot?: string
  limit?: number
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

export async function listInProgressExecutionTasksOrch(
  params: ListInProgressExecutionTasksInput,
): Promise<NodeRecord[]> {
  const { nodes } = await invokeCapabilityOrThrow({
    capability: 'organizer.nodes.list_all',
    input: {},
    actor: params.actor,
  })

  const projectRoot = params.projectRoot ? normalizePath(params.projectRoot) : ''
  const limit = params.limit ?? 8

  return nodes
    .filter((node) => {
      const taskStatus = normalizeTaskStatus(node.taskStatus)
      if (taskStatus !== 'in_progress') return false
      if (!(node.type === 'task' || node.recordKind === 'task' || !!node.taskStatus)) return false
      if (!projectRoot) return true
      return normalizePath(node.projectRoot ?? '') === projectRoot
    })
    .sort((a, b) => {
      const aTs = Date.parse(a.updatedAt || '') || 0
      const bTs = Date.parse(b.updatedAt || '') || 0
      return bTs - aTs
    })
    .slice(0, Math.max(1, limit))
}
