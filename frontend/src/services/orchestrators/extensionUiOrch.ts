import type { VaultFS } from '../lego_blocks/fsBlock'
import {
  isSupportedExtensionActionTargetBlock,
  resolveExtensionActionInputBlock,
  type ExtensionActionTarget,
  type ExtensionDeclarativeAction,
} from '../lego_blocks/extensionActionBlock'
import { getCapabilityFeatureFlags } from '../lego_blocks/capabilityFeatureFlagsBlock'
import type { CapabilityInputMap, CapabilityName } from '../lego_blocks/capabilityRegistryBlock'
import { invokeExtensionCapabilityOrch, type ExtensionCapabilityInvokeResult } from './extensionCapabilityOrch'
import { discoverExtensionsOrch, listRegisteredExtensionsOrch } from './extensionLoaderOrch'

export const DEFAULT_EXTENSION_UI_APP_VERSION_ORCH = '0.1.0'

export interface ExtensionSlotActionView {
  actionKey: string
  actionId: string
  label: string
  description?: string
  target: ExtensionActionTarget
  capability: CapabilityName
  extensionId: string
  extensionRegistryKey: string
}

export type ExtensionSlotResolveReasonCode = 'UNSUPPORTED_TARGET' | 'FEATURE_DISABLED'

export interface ExtensionSlotResolveResult {
  supported: boolean
  slotId: string
  actions: ExtensionSlotActionView[]
  reason: { code: ExtensionSlotResolveReasonCode; message: string } | null
}

export interface RefreshExtensionUiInput {
  appVersion?: string
  supportedApiVersions?: string[]
  fs?: VaultFS
  extensionsRoot?: string
}

export interface InvokeExtensionSlotActionInput {
  slotId: string
  actionKey: string
  context?: Record<string, unknown>
  actor?: { kind: 'human' | 'agent' | 'system'; id?: string }
  requestId?: string
  dryRun?: boolean
  fs?: VaultFS
}

interface ResolvedRuntimeAction {
  view: ExtensionSlotActionView
  extensionPermissions: string[]
  inputTemplate: Record<string, unknown>
}

export async function refreshExtensionUiOrch(input: RefreshExtensionUiInput = {}): Promise<void> {
  if (!isExtensionHostEnabled()) return
  await discoverExtensionsOrch({
    fs: input.fs,
    appVersion: input.appVersion ?? DEFAULT_EXTENSION_UI_APP_VERSION_ORCH,
    supportedApiVersions: input.supportedApiVersions,
    extensionsRoot: input.extensionsRoot,
  })
}

export function resolveExtensionSlotActionsOrch(slotId: string): ExtensionSlotResolveResult {
  if (!isExtensionHostEnabled()) {
    return {
      supported: false,
      slotId,
      actions: [],
      reason: {
        code: 'FEATURE_DISABLED',
        message: 'Extension host is disabled by feature flag.',
      },
    }
  }

  if (!isSupportedExtensionActionTargetBlock(slotId)) {
    return {
      supported: false,
      slotId,
      actions: [],
      reason: {
        code: 'UNSUPPORTED_TARGET',
        message: `Unsupported extension slot target "${slotId}".`,
      },
    }
  }

  const runtimeActions = getRuntimeActionsForTarget(slotId)
  return {
    supported: true,
    slotId,
    actions: runtimeActions.map(item => item.view),
    reason: null,
  }
}

export async function invokeExtensionSlotActionOrch(
  input: InvokeExtensionSlotActionInput,
): Promise<ExtensionCapabilityInvokeResult<CapabilityName>> {
  if (!isExtensionHostEnabled()) {
    throw new Error('Extension host is disabled by feature flag.')
  }
  if (!isSupportedExtensionActionTargetBlock(input.slotId)) {
    throw new Error(`Unsupported extension slot target "${input.slotId}".`)
  }

  const runtimeAction = getRuntimeActionsForTarget(input.slotId)
    .find(item => item.view.actionKey === input.actionKey)
  if (!runtimeAction) {
    throw new Error(`Extension action "${input.actionKey}" is not registered in slot "${input.slotId}".`)
  }

  const resolvedInput = resolveExtensionActionInputBlock(
    runtimeAction.inputTemplate,
    input.context ?? {},
  ) as CapabilityInputMap[CapabilityName]

  return invokeExtensionCapabilityOrch<CapabilityName>({
    extensionId: runtimeAction.view.extensionId,
    extensionRegistryKey: runtimeAction.view.extensionRegistryKey,
    extensionPermissions: runtimeAction.extensionPermissions,
    capability: runtimeAction.view.capability,
    input: resolvedInput,
    actor: input.actor,
    requestId: input.requestId,
    dryRun: input.dryRun,
    fs: input.fs,
  })
}

function isExtensionHostEnabled(): boolean {
  return getCapabilityFeatureFlags().extension_host_enabled
}

export function buildExtensionActionKeyOrch(registryKey: string, actionId: string): string {
  return `${registryKey}:${actionId}`
}

function getRuntimeActionsForTarget(target: ExtensionActionTarget): ResolvedRuntimeAction[] {
  const records = listRegisteredExtensionsOrch()
    .filter(record => record.status === 'active' && record.loadable && !!record.manifest)

  const actions: ResolvedRuntimeAction[] = []
  for (const record of records) {
    const extensionId = record.manifest?.id ?? record.extensionId
    if (!extensionId) continue
    const permissions = record.manifest?.permissions ?? []

    for (const action of record.actions) {
      if (action.target !== target) continue
      actions.push({
        view: toSlotActionView(record.registryKey, extensionId, action),
        extensionPermissions: permissions,
        inputTemplate: action.input,
      })
    }
  }

  return actions.sort((a, b) => a.view.label.localeCompare(b.view.label))
}

function toSlotActionView(
  registryKey: string,
  extensionId: string,
  action: ExtensionDeclarativeAction,
): ExtensionSlotActionView {
  return {
    actionKey: buildExtensionActionKeyOrch(registryKey, action.id),
    actionId: action.id,
    label: action.label,
    ...(action.description ? { description: action.description } : {}),
    target: action.target,
    capability: action.capability,
    extensionId,
    extensionRegistryKey: registryKey,
  }
}
