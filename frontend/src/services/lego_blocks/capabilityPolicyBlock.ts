import type { NodeType } from './yamlNoteBlock'
import type { CapabilityActor, CapabilityName } from './capabilityRegistryBlock'

const MAX_INPUT_BYTES = 64_000

const DESTRUCTIVE_CAPABILITIES = new Set<CapabilityName>([
  'organizer.node.delete',
])

const WRITE_CAPABILITIES = new Set<CapabilityName>([
  'organizer.node.create',
  'organizer.node.rename',
  'organizer.node.update',
  'organizer.node.move',
  'organizer.node.delete',
  'thoughts.create',
  'todos.create',
  'todos.toggle',
  'tools.excalidraw.format',
  'tools.pdf.convert',
  'tools.transcript.clean_save',
])

const STORAGE_KEY = 'ltm-capability-policy'

export interface CapabilityPolicy {
  allowedProjectRoots?: string[]
  allowedNodeTypes?: NodeType[]
  allowAgentWrites: boolean
  allowAgentDestructive: boolean
  maxInputBytes: number
}

export function validateCapabilityPolicy(params: {
  capability: CapabilityName
  input: unknown
  actor: CapabilityActor
}): void {
  const policy = getCapabilityPolicy()
  const inputSize = encodeUtf8Size(JSON.stringify(params.input ?? {}))
  if (inputSize > policy.maxInputBytes) {
    throw new Error(`Capability input exceeds max payload size (${policy.maxInputBytes} bytes).`)
  }

  if (params.actor.kind !== 'agent') return

  if (!policy.allowAgentWrites && WRITE_CAPABILITIES.has(params.capability)) {
    throw new Error(`Agent writes are blocked by policy for capability: ${params.capability}`)
  }

  if (!policy.allowAgentDestructive && DESTRUCTIVE_CAPABILITIES.has(params.capability)) {
    throw new Error(`Agent destructive action is blocked by policy for capability: ${params.capability}`)
  }

  const input = params.input as Record<string, unknown>
  const type = input.type
  if (type && typeof type === 'string' && policy.allowedNodeTypes && policy.allowedNodeTypes.length > 0) {
    if (!policy.allowedNodeTypes.includes(type as NodeType)) {
      throw new Error(`Node type "${type}" is blocked by policy.`)
    }
  }

  const projectRoot = input.projectRoot
  if (
    projectRoot &&
    typeof projectRoot === 'string' &&
    policy.allowedProjectRoots &&
    policy.allowedProjectRoots.length > 0
  ) {
    const normalized = normalizePath(projectRoot)
    const allow = policy.allowedProjectRoots.some(root => normalizePath(root) === normalized)
    if (!allow) {
      throw new Error(`Project root "${projectRoot}" is blocked by policy.`)
    }
  }
}

export function getCapabilityPolicy(): CapabilityPolicy {
  const fallback: CapabilityPolicy = {
    allowAgentWrites: true,
    allowAgentDestructive: true,
    maxInputBytes: MAX_INPUT_BYTES,
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<CapabilityPolicy>
    return {
      allowAgentWrites: parsed.allowAgentWrites ?? fallback.allowAgentWrites,
      allowAgentDestructive: parsed.allowAgentDestructive ?? fallback.allowAgentDestructive,
      maxInputBytes: parsed.maxInputBytes ?? fallback.maxInputBytes,
      allowedProjectRoots: Array.isArray(parsed.allowedProjectRoots)
        ? parsed.allowedProjectRoots.filter(v => typeof v === 'string')
        : undefined,
      allowedNodeTypes: Array.isArray(parsed.allowedNodeTypes)
        ? parsed.allowedNodeTypes.filter(v => typeof v === 'string') as NodeType[]
        : undefined,
    }
  } catch {
    return fallback
  }
}

function encodeUtf8Size(value: string): number {
  return new TextEncoder().encode(value).length
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}
