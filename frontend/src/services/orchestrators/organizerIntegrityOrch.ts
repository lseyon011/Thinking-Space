import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import { getVaultFS, type VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  deriveEpicStatusFromTaskStatuses,
  isTaskLikeNode,
  nodeStatusFromTaskStatus,
  normalizeTaskStatus,
  taskStatusFromNodeStatus,
} from '@/services/lego_blocks/integrations/statusPolicyBlock'
import { listAllYamlNodes, updateYamlNode } from '@/services/lego_blocks/integrations/yamlHierarchyBlock'

export type OrganizerIntegrityIssueKind =
  | 'missing_parent'
  | 'self_parent'
  | 'parent_cycle'
  | 'parent_type_mismatch'
  | 'parent_uuid_mismatch'
  | 'task_status_drift'
  | 'task_without_epic'
  | 'epic_status_violation'
  | 'legacy_children_field'

export interface OrganizerIntegrityIssue {
  kind: OrganizerIntegrityIssueKind
  severity: 'error' | 'warning'
  nodeKey?: string
  nodeTitle?: string
  filePath?: string
  parentKey?: string
  expected?: string
  actual?: string
  message: string
}

export interface OrganizerIntegrityReport {
  generatedAt: string
  nodeCount: number
  issueCount: number
  issues: OrganizerIntegrityIssue[]
}

export interface OrganizerStatusPolicyApplyResult {
  taskUpdates: number
  epicUpdates: number
  updatedNodeKeys: string[]
}

export async function runOrganizerIntegrityCheck(params?: {
  fs?: VaultFS
  includeLegacyFieldScan?: boolean
}): Promise<OrganizerIntegrityReport> {
  const fs = params?.fs ?? getVaultFS()
  const nodes = await listAllYamlNodes()
  const nodesByKey = new Map(nodes.map(node => [node.key, node]))
  const childrenByParent = buildChildrenByParent(nodes)

  const issues: OrganizerIntegrityIssue[] = []

  for (const node of nodes) {
    if (!node.parent) continue

    if (node.parent === node.key) {
      issues.push({
        kind: 'self_parent',
        severity: 'error',
        nodeKey: node.key,
        nodeTitle: node.title,
        filePath: node.filePath,
        parentKey: node.parent,
        message: 'Node cannot be its own parent.',
      })
      continue
    }

    const parent = nodesByKey.get(node.parent)
    if (!parent) {
      issues.push({
        kind: 'missing_parent',
        severity: 'error',
        nodeKey: node.key,
        nodeTitle: node.title,
        filePath: node.filePath,
        parentKey: node.parent,
        message: `Parent key "${node.parent}" does not exist in cache.`,
      })
      continue
    }

    if (node.parentType && node.parentType !== parent.type) {
      issues.push({
        kind: 'parent_type_mismatch',
        severity: 'warning',
        nodeKey: node.key,
        nodeTitle: node.title,
        filePath: node.filePath,
        parentKey: node.parent,
        expected: parent.type,
        actual: node.parentType,
        message: 'parent_type does not match actual parent node type.',
      })
    }

    if (node.parentUuid && node.parentUuid !== parent.uuid) {
      issues.push({
        kind: 'parent_uuid_mismatch',
        severity: 'warning',
        nodeKey: node.key,
        nodeTitle: node.title,
        filePath: node.filePath,
        parentKey: node.parent,
        expected: parent.uuid,
        actual: node.parentUuid,
        message: 'parent_uuid does not match actual parent node uuid.',
      })
    }

    if (detectCycle(node.key, nodesByKey)) {
      issues.push({
        kind: 'parent_cycle',
        severity: 'error',
        nodeKey: node.key,
        nodeTitle: node.title,
        filePath: node.filePath,
        parentKey: node.parent,
        message: 'Cycle detected in parent chain.',
      })
    }
  }

  for (const node of nodes) {
    if (!isTaskLikeNode(node)) continue

    const expectedStatus = nodeStatusFromTaskStatus(node.taskStatus)
    if (node.status !== expectedStatus) {
      issues.push({
        kind: 'task_status_drift',
        severity: 'warning',
        nodeKey: node.key,
        nodeTitle: node.title,
        filePath: node.filePath,
        expected: expectedStatus,
        actual: node.status,
        message: 'Task status drift: status should match task_status policy.',
      })
    }

    const epicAncestor = findEpicAncestor(node, nodesByKey)
    if (!epicAncestor) {
      issues.push({
        kind: 'task_without_epic',
        severity: 'warning',
        nodeKey: node.key,
        nodeTitle: node.title,
        filePath: node.filePath,
        message: 'Task node is not nested under any epic ancestor.',
      })
    }
  }

  for (const node of nodes) {
    if (node.type !== 'epic') continue
    const taskStatuses = collectDescendantTaskStatuses(node.key, childrenByParent)
    const derived = deriveEpicStatusFromTaskStatuses(taskStatuses)
    if (!derived) continue
    if (node.status === derived) continue

    issues.push({
      kind: 'epic_status_violation',
      severity: 'warning',
      nodeKey: node.key,
      nodeTitle: node.title,
      filePath: node.filePath,
      expected: derived,
      actual: node.status,
      message: 'Epic status should be derived from descendant task states.',
    })
  }

  if (params?.includeLegacyFieldScan !== false) {
    for (const node of nodes) {
      const legacyFields = await detectLegacyHierarchyFields(node.filePath, fs)
      if (legacyFields.length === 0) continue
      issues.push({
        kind: 'legacy_children_field',
        severity: 'warning',
        nodeKey: node.key,
        nodeTitle: node.title,
        filePath: node.filePath,
        actual: legacyFields.join(', '),
        message: `Legacy hierarchy YAML fields present: ${legacyFields.join(', ')}`,
      })
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    nodeCount: nodes.length,
    issueCount: issues.length,
    issues,
  }
}

export async function applyOrganizerStatusPolicy(params?: {
  fs?: VaultFS
}): Promise<OrganizerStatusPolicyApplyResult> {
  const fs = params?.fs ?? getVaultFS()
  const allNodes = await listAllYamlNodes()
  const nodesByKey = new Map(allNodes.map(node => [node.key, node]))

  let taskUpdates = 0
  let epicUpdates = 0
  const updatedNodeKeys: string[] = []

  for (const node of allNodes) {
    if (!isTaskLikeNode(node)) continue

    const normalizedTaskStatus = normalizeTaskStatus(node.taskStatus) ?? taskStatusFromNodeStatus(node.status)
    const expectedNodeStatus = nodeStatusFromTaskStatus(normalizedTaskStatus)

    if (node.status === expectedNodeStatus && normalizeTaskStatus(node.taskStatus) === normalizedTaskStatus) {
      continue
    }

    const updated = await updateYamlNode(node.uuid, {
      status: expectedNodeStatus,
      extraFields: {
        record_kind: node.recordKind ?? 'task',
        task_status: normalizedTaskStatus,
      },
    }, fs)

    nodesByKey.set(updated.key, updated)
    taskUpdates += 1
    updatedNodeKeys.push(updated.key)
  }

  const refreshedNodes = [...nodesByKey.values()]
  const childrenByParent = buildChildrenByParent(refreshedNodes)

  for (const node of refreshedNodes) {
    if (node.type !== 'epic') continue

    const taskStatuses = collectDescendantTaskStatuses(node.key, childrenByParent)
    const derivedStatus = deriveEpicStatusFromTaskStatuses(taskStatuses)
    if (!derivedStatus || derivedStatus === node.status) continue

    const updated = await updateYamlNode(node.uuid, { status: derivedStatus }, fs)
    nodesByKey.set(updated.key, updated)
    epicUpdates += 1
    updatedNodeKeys.push(updated.key)
  }

  return {
    taskUpdates,
    epicUpdates,
    updatedNodeKeys,
  }
}

function buildChildrenByParent(nodes: NodeRecord[]): Map<string, NodeRecord[]> {
  const byParent = new Map<string, NodeRecord[]>()
  for (const node of nodes) {
    if (!node.parent) continue
    const children = byParent.get(node.parent) ?? []
    children.push(node)
    byParent.set(node.parent, children)
  }
  return byParent
}

function collectDescendantTaskStatuses(
  rootKey: string,
  childrenByParent: Map<string, NodeRecord[]>,
): Array<string | undefined> {
  const result: Array<string | undefined> = []
  const stack = [...(childrenByParent.get(rootKey) ?? [])]
  const seen = new Set<string>()

  while (stack.length > 0) {
    const current = stack.pop()!
    if (seen.has(current.key)) continue
    seen.add(current.key)

    if (isTaskLikeNode(current)) {
      result.push(current.taskStatus)
    }

    const children = childrenByParent.get(current.key)
    if (!children) continue
    for (const child of children) stack.push(child)
  }

  return result
}

function findEpicAncestor(node: NodeRecord, nodesByKey: Map<string, NodeRecord>): NodeRecord | null {
  let cursor = node.parent
  const seen = new Set<string>()
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor)
    const parent = nodesByKey.get(cursor)
    if (!parent) return null
    if (parent.type === 'epic') return parent
    cursor = parent.parent
  }
  return null
}

function detectCycle(startKey: string, nodesByKey: Map<string, NodeRecord>): boolean {
  const seen = new Set<string>()
  let cursor: string | undefined = startKey

  while (cursor) {
    if (seen.has(cursor)) return true
    seen.add(cursor)
    const node = nodesByKey.get(cursor)
    cursor = node?.parent
  }

  return false
}

async function detectLegacyHierarchyFields(filePath: string, fs: VaultFS): Promise<string[]> {
  try {
    const content = await fs.read(filePath)
    const frontmatter = extractFrontmatter(content)
    if (!frontmatter) return []

    const found: string[] = []
    if (/^children\s*:/m.test(frontmatter)) found.push('children')
    if (/^child_types\s*:/m.test(frontmatter)) found.push('child_types')
    return found
  } catch {
    return []
  }
}

function extractFrontmatter(content: string): string | null {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('---\n')) return null
  const match = /^---\n([\s\S]*?)\n---\s*(?:\n|$)/.exec(trimmed)
  if (!match) return null
  return match[1]
}
