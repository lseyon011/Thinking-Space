import {
  CAPABILITY_REGISTRY,
  getCapabilityDefinition,
  type CapabilityActor,
  type CapabilityInputMap,
  type CapabilityName,
  type CapabilityOutputMap,
} from '../lego_blocks/capabilityRegistryBlock'
import {
  createYamlNode,
  deleteYamlNode,
  getYamlNode,
  getYamlNodeByKey,
  listAllYamlNodes,
  listYamlChildren,
  listYamlRootNodes,
  moveYamlNode,
  readYamlFrontmatterByPath,
  renameYamlNode,
  searchYamlNodes,
  updateYamlNode,
} from '../lego_blocks/yamlHierarchyBlock'
import type { VaultFS } from '../lego_blocks/fsBlock'

export interface CapabilityInvokeRequest<Name extends CapabilityName = CapabilityName> {
  capability: Name
  input: CapabilityInputMap[Name]
  actor?: CapabilityActor
  requestId?: string
  dryRun?: boolean
}

export interface CapabilityInvokeSuccess<Name extends CapabilityName> {
  ok: true
  capability: Name
  requestId: string
  actor: CapabilityActor
  dryRun: boolean
  data: CapabilityOutputMap[Name]
}

export interface CapabilityInvokeFailure<Name extends CapabilityName> {
  ok: false
  capability: Name
  requestId: string
  actor: CapabilityActor
  dryRun: boolean
  error: {
    code: 'CAPABILITY_VALIDATION_FAILED' | 'CAPABILITY_NOT_FOUND' | 'CAPABILITY_EXECUTION_FAILED' | 'CAPABILITY_DRY_RUN_UNSUPPORTED'
    message: string
  }
}

export type CapabilityInvokeResponse<Name extends CapabilityName> =
  | CapabilityInvokeSuccess<Name>
  | CapabilityInvokeFailure<Name>

const DEFAULT_ACTOR: CapabilityActor = {
  kind: 'human',
  id: 'ui.unknown',
}

const WRITE_CAPABILITIES = new Set<CapabilityName>([
  'organizer.node.create',
  'organizer.node.rename',
  'organizer.node.update',
  'organizer.node.move',
  'organizer.node.delete',
])

export function listCapabilitiesOrch() {
  return CAPABILITY_REGISTRY
}

export async function invokeCapabilityOrch<Name extends CapabilityName>(
  request: CapabilityInvokeRequest<Name>,
  options?: { fs?: VaultFS },
): Promise<CapabilityInvokeResponse<Name>> {
  const requestId = request.requestId || createRequestId()
  const actor = request.actor ?? DEFAULT_ACTOR
  const dryRun = !!request.dryRun

  const definition = getCapabilityDefinition(request.capability)
  if (!definition) {
    return {
      ok: false,
      capability: request.capability,
      requestId,
      actor,
      dryRun,
      error: {
        code: 'CAPABILITY_NOT_FOUND',
        message: `Unknown capability: ${request.capability}`,
      },
    }
  }

  try {
    if (dryRun && WRITE_CAPABILITIES.has(request.capability)) {
      return {
        ok: false,
        capability: request.capability,
        requestId,
        actor,
        dryRun,
        error: {
          code: 'CAPABILITY_DRY_RUN_UNSUPPORTED',
          message: `Dry-run is not implemented for ${request.capability}.`,
        },
      }
    }

    const data = await executeCapability(request.capability, request.input, options?.fs)
    return {
      ok: true,
      capability: request.capability,
      requestId,
      actor,
      dryRun,
      data,
    }
  } catch (error) {
    return {
      ok: false,
      capability: request.capability,
      requestId,
      actor,
      dryRun,
      error: {
        code: 'CAPABILITY_EXECUTION_FAILED',
        message: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

export async function invokeCapabilityOrThrow<Name extends CapabilityName>(
  request: CapabilityInvokeRequest<Name>,
  options?: { fs?: VaultFS },
): Promise<CapabilityOutputMap[Name]> {
  const response = await invokeCapabilityOrch(request, options)
  if (!response.ok) {
    throw new Error(response.error.message)
  }
  return response.data
}

async function executeCapability<Name extends CapabilityName>(
  capability: Name,
  input: CapabilityInputMap[Name],
  fs?: VaultFS,
): Promise<CapabilityOutputMap[Name]> {
  switch (capability) {
    case 'organizer.nodes.list_roots': {
      const payload = input as CapabilityInputMap['organizer.nodes.list_roots']
      const nodes = await listYamlRootNodes(payload.typeFilter)
      return { nodes } as CapabilityOutputMap[Name]
    }
    case 'organizer.nodes.list_children': {
      const payload = input as CapabilityInputMap['organizer.nodes.list_children']
      assertNonEmptyString(payload.parentKey, 'parentKey')
      const nodes = await listYamlChildren(payload.parentKey)
      return { nodes } as CapabilityOutputMap[Name]
    }
    case 'organizer.nodes.list_all': {
      const nodes = await listAllYamlNodes()
      return { nodes } as CapabilityOutputMap[Name]
    }
    case 'organizer.nodes.search': {
      const payload = input as CapabilityInputMap['organizer.nodes.search']
      assertNonEmptyString(payload.query, 'query')
      const nodes = await searchYamlNodes(payload.query, payload.limit)
      return { nodes } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.get': {
      const payload = input as CapabilityInputMap['organizer.node.get']
      assertNonEmptyString(payload.uuid, 'uuid')
      const node = await getYamlNode(payload.uuid)
      return { node: node ?? null } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.get_by_key': {
      const payload = input as CapabilityInputMap['organizer.node.get_by_key']
      assertNonEmptyString(payload.key, 'key')
      const node = await getYamlNodeByKey(payload.key)
      return { node: node ?? null } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.read_frontmatter': {
      const payload = input as CapabilityInputMap['organizer.node.read_frontmatter']
      assertNonEmptyString(payload.filePath, 'filePath')
      const frontmatter = await readYamlFrontmatterByPath(payload.filePath, fs)
      return { frontmatter } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.create': {
      const payload = input as CapabilityInputMap['organizer.node.create']
      assertNonEmptyString(payload.title, 'title')
      const node = await createYamlNode({ ...payload, fs })
      return { node } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.rename': {
      const payload = input as CapabilityInputMap['organizer.node.rename']
      assertNonEmptyString(payload.uuid, 'uuid')
      assertNonEmptyString(payload.newTitle, 'newTitle')
      const node = await renameYamlNode(payload.uuid, payload.newTitle, fs)
      return { node } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.update': {
      const payload = input as CapabilityInputMap['organizer.node.update']
      assertNonEmptyString(payload.uuid, 'uuid')
      const node = await updateYamlNode(payload.uuid, payload.updates, fs)
      return { node } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.move': {
      const payload = input as CapabilityInputMap['organizer.node.move']
      assertNonEmptyString(payload.uuid, 'uuid')
      const node = await moveYamlNode(payload.uuid, payload.newParentKey, fs)
      return { node } as CapabilityOutputMap[Name]
    }
    case 'organizer.node.delete': {
      const payload = input as CapabilityInputMap['organizer.node.delete']
      assertNonEmptyString(payload.uuid, 'uuid')
      await deleteYamlNode(payload.uuid, fs)
      return { deleted: true } as CapabilityOutputMap[Name]
    }
    default:
      throw new Error(`Capability not implemented: ${String(capability)}`)
  }
}

function assertNonEmptyString(value: string | undefined, field: string): void {
  if (!value || !value.trim()) {
    throw new Error(`Missing required field: ${field}`)
  }
}

function createRequestId(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `cap-${Date.now().toString(36)}-${rand}`
}
