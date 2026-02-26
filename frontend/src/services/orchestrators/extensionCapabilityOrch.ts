import {
  createCapabilityInputHash,
  writeCapabilityAuditEntry,
} from '@/services/lego_blocks/integrations/capabilityAuditLogBlock'
import { type VaultFS, getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  checkExtensionCapabilityPermissionBlock,
  type ExtensionPermissionDecisionCode,
} from '@/services/lego_blocks/integrations/extensionPermissionBlock'
import {
  invokeCapabilityOrch,
  type CapabilityInvokeRequest,
  type CapabilityInvokeResponse,
} from './capabilityRouterOrch'
import type { CapabilityActor, CapabilityInputMap, CapabilityName } from '@/services/lego_blocks/integrations/capabilityRegistryBlock'

export interface ExtensionCapabilityInvokeInput<Name extends CapabilityName> {
  extensionId: string
  extensionPermissions: string[]
  capability: Name
  input: CapabilityInputMap[Name]
  extensionRegistryKey?: string
  actor?: CapabilityActor
  requestId?: string
  dryRun?: boolean
  fs?: VaultFS
}

export interface ExtensionCapabilityBlockedResult<Name extends CapabilityName> {
  ok: false
  blocked: true
  extensionId: string
  capability: Name
  reasonCode: Exclude<ExtensionPermissionDecisionCode, null>
  message: string
  requiredPermissions: string[]
}

export type ExtensionCapabilityInvokeResult<Name extends CapabilityName> =
  | CapabilityInvokeResponse<Name>
  | ExtensionCapabilityBlockedResult<Name>

export async function invokeExtensionCapabilityOrch<Name extends CapabilityName>(
  params: ExtensionCapabilityInvokeInput<Name>,
): Promise<ExtensionCapabilityInvokeResult<Name>> {
  const extensionId = params.extensionId.trim()
  if (!extensionId) {
    throw new Error('extensionId is required.')
  }

  const decision = checkExtensionCapabilityPermissionBlock({
    permissions: params.extensionPermissions,
    capability: params.capability,
  })

  if (!decision.allowed) {
    const reasonCode = decision.reasonCode ?? 'MISSING_PERMISSION'
    const message = decision.message ?? 'Extension permission denied.'
    await writeDeniedExtensionAudit({
      extensionId,
      extensionRegistryKey: params.extensionRegistryKey,
      capability: params.capability,
      input: params.input,
      requestId: params.requestId ?? createExtensionRequestId(),
      actor: params.actor ?? defaultExtensionActor(extensionId),
      dryRun: !!params.dryRun,
      reasonCode,
      message,
      fs: params.fs,
    })

    return {
      ok: false,
      blocked: true,
      extensionId,
      capability: params.capability,
      reasonCode,
      message,
      requiredPermissions: decision.requiredPermissions,
    }
  }

  const request: CapabilityInvokeRequest<Name> = {
    capability: params.capability,
    input: params.input,
    actor: params.actor ?? defaultExtensionActor(extensionId),
    requestId: params.requestId,
    dryRun: params.dryRun,
    extensionContext: {
      extensionId,
      ...(params.extensionRegistryKey ? { extensionRegistryKey: params.extensionRegistryKey } : {}),
    },
  }

  return invokeCapabilityOrch(request, { fs: params.fs })
}

async function writeDeniedExtensionAudit(params: {
  extensionId: string
  extensionRegistryKey?: string
  capability: CapabilityName
  input: Record<string, unknown>
  requestId: string
  actor: CapabilityActor
  dryRun: boolean
  reasonCode: string
  message: string
  fs?: VaultFS
}): Promise<void> {
  try {
    const fs = params.fs ?? getVaultFS()
    await writeCapabilityAuditEntry({
      auditId: createExtensionAuditId(),
      timestamp: new Date().toISOString(),
      requestId: params.requestId,
      capability: params.capability,
      origin: 'extension',
      extensionId: params.extensionId,
      extensionRegistryKey: params.extensionRegistryKey,
      actorKind: params.actor.kind,
      actorId: params.actor.id,
      dryRun: params.dryRun,
      ok: false,
      inputHash: createCapabilityInputHash(params.input),
      touchedPaths: [],
      warnings: [],
      errorCode: `EXTENSION_PERMISSION_${params.reasonCode}`,
      errorMessage: params.message,
    }, fs)
  } catch {
    // Extension deny-path audit should not break feature execution.
  }
}

function defaultExtensionActor(extensionId: string): CapabilityActor {
  return {
    kind: 'human',
    id: `extension:${extensionId}`,
  }
}

function createExtensionRequestId(): string {
  return `ext-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function createExtensionAuditId(): string {
  return `audit-ext-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
