import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import type { NodeType, YAMLFrontmatter } from '@/services/lego_blocks/units/yamlNoteBlock'
import { STORAGE_KEYS, getJsonStorageItem, setJsonStorageItem } from './storageOrch'

export type StewardProposalAction = 'update_description' | 'update_tags' | 'update_file_yaml_metadata'
export type StewardProposalStatus = 'pending' | 'accepted' | 'rejected'

export interface StewardProposalPayload {
  description?: string
  summary?: string
  tags?: string[]
  suggestedEpicKey?: string
  suggestedIdeaKey?: string
}

export interface StewardProposal {
  id: string
  nodeUuid?: string
  nodeKey?: string
  nodeTitle: string
  nodeType: NodeType
  nodeFilePath: string
  action: StewardProposalAction
  title: string
  rationale: string
  payload: StewardProposalPayload
  appliedPayload?: StewardProposalPayload
  status: StewardProposalStatus
  createdAt: string
  updatedAt: string
}

const MAX_QUEUE_ITEMS = 200

function makeProposalId(): string {
  return `sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTagToken(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-/]+|[-/]+$/g, '')
}

function normalizeTags(tags: string[]): string[] {
  const unique = new Set<string>()
  for (const tag of tags) {
    const normalized = normalizeTagToken(tag)
    if (normalized) unique.add(normalized)
  }
  return [...unique]
}

function sortTags(tags: string[]): string[] {
  return [...tags].sort((a, b) => a.localeCompare(b))
}

function normalizePayload(action: StewardProposalAction, payload: StewardProposalPayload): StewardProposalPayload {
  if (action === 'update_description') {
    return { description: (payload.description ?? '').trim() }
  }
  if (action === 'update_tags') {
    return { tags: sortTags(normalizeTags(payload.tags ?? [])) }
  }
  return {
    summary: (payload.summary ?? '').trim(),
    tags: sortTags(normalizeTags(payload.tags ?? [])),
    suggestedEpicKey: (payload.suggestedEpicKey ?? '').trim() || undefined,
    suggestedIdeaKey: (payload.suggestedIdeaKey ?? '').trim() || undefined,
  }
}

function proposalSignature(proposal: Pick<StewardProposal, 'nodeUuid' | 'nodeFilePath' | 'action' | 'payload'>): string {
  const target = proposal.nodeUuid || proposal.nodeFilePath
  const payload = normalizePayload(proposal.action, proposal.payload)
  if (proposal.action === 'update_description') {
    return `${target}|${proposal.action}|${payload.description ?? ''}`
  }
  if (proposal.action === 'update_tags') {
    return `${target}|${proposal.action}|${(payload.tags ?? []).join(',')}`
  }
  return `${target}|${proposal.action}|${payload.summary ?? ''}|${(payload.tags ?? []).join(',')}|${payload.suggestedEpicKey ?? ''}|${payload.suggestedIdeaKey ?? ''}`
}

function suggestionForDescription(node: NodeRecord): string {
  const typeLabel = node.type.replace(/_/g, ' ')
  const statusLabel = node.taskStatus || node.status
  return `${node.title} is a ${typeLabel} currently in ${statusLabel} state. Clarify scope, expected outcome, and the next concrete action.`
}

function suggestionForTags(node: NodeRecord, existingTags: string[]): string[] {
  const suggested = [
    ...existingTags,
    `organizer/${node.type}`,
    node.taskStatus ? `task/${node.taskStatus}` : `status/${node.status}`,
  ]
  if (node.priority) suggested.push(`priority/${node.priority}`)
  return sortTags(normalizeTags(suggested))
}

export function parseStewardTagDraftOrch(value: string): string[] {
  return sortTags(normalizeTags(value.split(',').map(item => item.trim())))
}

export function readStewardProposalQueueOrch(): StewardProposal[] {
  const raw = getJsonStorageItem<StewardProposal[]>(STORAGE_KEYS.stewardProposalQueue, [])
  return raw
    .filter(item => item && typeof item.id === 'string' && typeof item.nodeFilePath === 'string')
    .map(item => ({
      ...item,
      payload: normalizePayload(item.action, item.payload ?? {}),
      appliedPayload: item.appliedPayload ? normalizePayload(item.action, item.appliedPayload) : undefined,
    }))
}

export function writeStewardProposalQueueOrch(proposals: StewardProposal[]): void {
  setJsonStorageItem(STORAGE_KEYS.stewardProposalQueue, proposals.slice(0, MAX_QUEUE_ITEMS))
}

export function buildStewardProposalsForNodeOrch(
  node: NodeRecord,
  frontmatter?: YAMLFrontmatter | null,
): StewardProposal[] {
  const proposals: StewardProposal[] = []
  const now = new Date().toISOString()

  const description = (frontmatter?.description ?? node.description ?? '').trim()
  if (!description) {
    proposals.push({
      id: makeProposalId(),
      nodeUuid: node.uuid,
      nodeKey: node.key,
      nodeTitle: node.title,
      nodeType: node.type,
      nodeFilePath: node.filePath,
      action: 'update_description',
      title: 'Add Description',
      rationale: 'Node has no description. Add one for clearer context and reviewability.',
      payload: { description: suggestionForDescription(node) },
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
  }

  const existingTags = normalizeTags(frontmatter?.tags ?? node.tags ?? [])
  const suggestedTags = suggestionForTags(node, existingTags)
  const tagsChanged = suggestedTags.join(',') !== sortTags(existingTags).join(',')
  if (tagsChanged) {
    proposals.push({
      id: makeProposalId(),
      nodeUuid: node.uuid,
      nodeKey: node.key,
      nodeTitle: node.title,
      nodeType: node.type,
      nodeFilePath: node.filePath,
      action: 'update_tags',
      title: 'Normalize Tags',
      rationale: 'Suggested canonical organizer/task tags are missing.',
      payload: { tags: suggestedTags },
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
  }

  return proposals
}

export function createStewardFileYamlMetadataProposalOrch(params: {
  filePath: string
  node?: NodeRecord | null
  summary: string
  tags: string[]
  suggestedEpicKey?: string
  suggestedIdeaKey?: string
  rationale: string
}): StewardProposal {
  const now = new Date().toISOString()
  const titleFromFile = params.filePath.split('/').pop()?.replace(/\.md$/i, '') || params.filePath
  return {
    id: makeProposalId(),
    nodeUuid: params.node?.uuid,
    nodeKey: params.node?.key,
    nodeTitle: params.node?.title || titleFromFile,
    nodeType: params.node?.type || 'thought',
    nodeFilePath: params.filePath,
    action: 'update_file_yaml_metadata',
    title: 'Generate YAML Metadata',
    rationale: params.rationale,
    payload: normalizePayload('update_file_yaml_metadata', {
      summary: params.summary,
      tags: params.tags,
      suggestedEpicKey: params.suggestedEpicKey,
      suggestedIdeaKey: params.suggestedIdeaKey,
    }),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }
}

export function enqueueStewardProposalsOrch(
  existing: StewardProposal[],
  additions: StewardProposal[],
): { queue: StewardProposal[]; added: number } {
  const next = [...existing]
  let added = 0

  for (const proposal of additions) {
    const signature = proposalSignature(proposal)
    const duplicatePending = next.some(item => (
      item.status === 'pending' &&
      proposalSignature(item) === signature
    ))
    if (duplicatePending) continue
    next.unshift({
      ...proposal,
      payload: normalizePayload(proposal.action, proposal.payload),
      updatedAt: new Date().toISOString(),
    })
    added += 1
  }

  return { queue: next.slice(0, MAX_QUEUE_ITEMS), added }
}

export function markStewardProposalAcceptedOrch(
  proposals: StewardProposal[],
  proposalId: string,
  appliedPayload: StewardProposalPayload,
): StewardProposal[] {
  const now = new Date().toISOString()
  return proposals.map(item => {
    if (item.id !== proposalId) return item
    return {
      ...item,
      status: 'accepted',
      appliedPayload: normalizePayload(item.action, appliedPayload),
      updatedAt: now,
    }
  })
}

export function markStewardProposalRejectedOrch(
  proposals: StewardProposal[],
  proposalId: string,
): StewardProposal[] {
  const now = new Date().toISOString()
  return proposals.map(item => (
    item.id === proposalId
      ? { ...item, status: 'rejected', updatedAt: now }
      : item
  ))
}

export function clearResolvedStewardProposalsOrch(proposals: StewardProposal[]): StewardProposal[] {
  return proposals.filter(item => item.status === 'pending')
}
