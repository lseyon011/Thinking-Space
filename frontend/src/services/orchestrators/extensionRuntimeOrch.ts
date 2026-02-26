import { getStoredVaultRoot } from '@/services/lego_blocks/units/storageKeyBlock'
import type { CapabilityActor } from '@/services/lego_blocks/integrations/capabilityRegistryBlock'

export interface ExtensionRuntimeInvokeInput {
  extensionId: string
  extensionRegistryKey: string
  extensionPermissions: string[]
  runtimeEntry: string
  runtimeHandler: string
  actionId: string
  input: Record<string, unknown>
  context?: Record<string, unknown>
  actor?: CapabilityActor
  requestId?: string
  dryRun?: boolean
}

export interface ExtensionRuntimeInvokeSuccess {
  ok: true
  requestId: string
  extensionId: string
  extensionRegistryKey: string
  actionId: string
  runtimeHandler: string
  warnings: string[]
  data: unknown
}

export interface ExtensionRuntimeInvokeFailure {
  ok: false
  requestId: string
  extensionId: string
  extensionRegistryKey: string
  actionId: string
  runtimeHandler: string
  warnings: string[]
  blocked?: true
  requiredPermissions?: string[]
  error: {
    code: string
    message: string
  }
}

export type ExtensionRuntimeInvokeResult =
  | ExtensionRuntimeInvokeSuccess
  | ExtensionRuntimeInvokeFailure

export async function invokeExtensionRuntimeActionOrch(
  input: ExtensionRuntimeInvokeInput,
): Promise<ExtensionRuntimeInvokeResult> {
  if (typeof window === 'undefined' || !window.electronAPI?.isElectron) {
    throw new Error('Extension JS/TS runtime is only available in Electron.')
  }
  if (!window.electronAPI.extensionRuntimeInvoke) {
    throw new Error('Extension runtime IPC is unavailable in this build.')
  }

  const vaultRoot = getStoredVaultRoot()
  if (!vaultRoot) {
    throw new Error('Vault root not configured')
  }

  const response = await window.electronAPI.extensionRuntimeInvoke({
    vaultRoot,
    extensionId: input.extensionId,
    extensionRegistryKey: input.extensionRegistryKey,
    extensionPermissions: input.extensionPermissions,
    runtimeEntry: input.runtimeEntry,
    runtimeHandler: input.runtimeHandler,
    actionId: input.actionId,
    input: input.input,
    context: input.context,
    actor: input.actor,
    requestId: input.requestId,
    dryRun: input.dryRun,
  })
  return response as ExtensionRuntimeInvokeResult
}
