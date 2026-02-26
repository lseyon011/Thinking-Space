import type { CapabilityName } from '@/services/lego_blocks/integrations/capabilityRegistryBlock'

export type ExtensionPermissionDecisionCode =
  | 'MISSING_PERMISSION'
  | 'CAPABILITY_UNMAPPED'
  | null

export interface ExtensionPermissionDecision {
  allowed: boolean
  reasonCode: ExtensionPermissionDecisionCode
  message: string | null
  requiredPermissions: string[]
  normalizedPermissions: string[]
}

const PERMISSION_TO_CAPABILITIES: Record<string, CapabilityName[]> = {
  'organizer:read': [
    'organizer.nodes.list_roots',
    'organizer.nodes.list_children',
    'organizer.nodes.list_all',
    'organizer.nodes.search',
    'organizer.node.get',
    'organizer.node.get_by_key',
    'organizer.node.read_frontmatter',
    'tools.files.list_markdown',
    'tools.files.list_pdf',
    'tools.folders.list',
  ],
  'organizer:write': [
    'organizer.node.create',
    'organizer.node.rename',
    'organizer.node.update',
    'organizer.node.move',
    'organizer.node.delete',
    'task.claim',
    'task.update_status',
    'run.log',
    'handoff.create',
    'comment.add',
    'thoughts.create',
    'todos.create',
    'todos.toggle',
  ],
  'tools:excalidraw': [
    'tools.excalidraw.preview',
    'tools.excalidraw.format',
  ],
  'tools:pdf': [
    'tools.pdf.preview',
    'tools.pdf.convert',
  ],
  'tools:transcript': [
    'tools.transcript.preview',
    'tools.transcript.clean_save',
  ],
}

const CAPABILITY_TO_PERMISSIONS = buildCapabilityPermissionMap()

export function normalizeExtensionPermissionsBlock(permissions: string[]): string[] {
  const normalized: string[] = []
  for (const permission of permissions) {
    const trimmed = permission.trim()
    if (!trimmed) continue
    if (!normalized.includes(trimmed)) normalized.push(trimmed)
  }
  return normalized
}

export function getRequiredPermissionsForCapabilityBlock(capability: CapabilityName): string[] {
  return CAPABILITY_TO_PERMISSIONS.get(capability) ?? []
}

export function checkExtensionCapabilityPermissionBlock(params: {
  permissions: string[]
  capability: CapabilityName
}): ExtensionPermissionDecision {
  const normalizedPermissions = normalizeExtensionPermissionsBlock(params.permissions)
  const requiredPermissions = getRequiredPermissionsForCapabilityBlock(params.capability)

  if (requiredPermissions.length === 0) {
    return {
      allowed: false,
      reasonCode: 'CAPABILITY_UNMAPPED',
      message: `Capability "${params.capability}" is not mapped to an extension permission scope.`,
      requiredPermissions: [],
      normalizedPermissions,
    }
  }

  const allowed = requiredPermissions.some(permission => normalizedPermissions.includes(permission))
  if (allowed) {
    return {
      allowed: true,
      reasonCode: null,
      message: null,
      requiredPermissions,
      normalizedPermissions,
    }
  }

  return {
    allowed: false,
    reasonCode: 'MISSING_PERMISSION',
    message: `Capability "${params.capability}" requires one of: ${requiredPermissions.join(', ')}.`,
    requiredPermissions,
    normalizedPermissions,
  }
}

function buildCapabilityPermissionMap(): Map<CapabilityName, string[]> {
  const mapping = new Map<CapabilityName, string[]>()
  for (const [permission, capabilities] of Object.entries(PERMISSION_TO_CAPABILITIES)) {
    for (const capability of capabilities) {
      const existing = mapping.get(capability) ?? []
      if (!existing.includes(permission)) existing.push(permission)
      mapping.set(capability, existing)
    }
  }
  return mapping
}

