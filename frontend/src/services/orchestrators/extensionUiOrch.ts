import type { VaultFS } from '../lego_blocks/fsBlock'
import {
  isRuntimeExtensionActionBlock,
  isSupportedExtensionActionTargetBlock,
  resolveExtensionActionInputBlock,
  type ExtensionActionTarget,
  type ExtensionDeclarativeAction,
} from '../lego_blocks/extensionActionBlock'
import { getCapabilityFeatureFlags } from '../lego_blocks/capabilityFeatureFlagsBlock'
import type { CapabilityInputMap, CapabilityName } from '../lego_blocks/capabilityRegistryBlock'
import { invokeExtensionCapabilityOrch, type ExtensionCapabilityInvokeResult } from './extensionCapabilityOrch'
import { discoverExtensionsOrch, listRegisteredExtensionsOrch } from './extensionLoaderOrch'
import { invokeExtensionRuntimeActionOrch, type ExtensionRuntimeInvokeResult } from './extensionRuntimeOrch'

export const DEFAULT_EXTENSION_UI_APP_VERSION_ORCH = '0.1.0'

export interface ExtensionSlotActionView {
  actionKey: string
  actionId: string
  label: string
  description?: string
  target: ExtensionActionTarget
  execution_kind: 'declarative' | 'runtime'
  capability?: CapabilityName
  runtime_handler?: string
  runtime_entry?: string
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

export type ExtensionSlotInvokeResult =
  | ExtensionCapabilityInvokeResult<CapabilityName>
  | ExtensionRuntimeInvokeResult

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
): Promise<ExtensionSlotInvokeResult> {
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

  if (runtimeAction.view.execution_kind === 'runtime') {
    const runtimeEntry = runtimeAction.view.runtime_entry
    if (!runtimeEntry) {
      throw new Error(`Runtime action "${runtimeAction.view.actionId}" is missing runtime entry path.`)
    }

    return invokeExtensionRuntimeActionOrch({
      extensionId: runtimeAction.view.extensionId,
      extensionRegistryKey: runtimeAction.view.extensionRegistryKey,
      extensionPermissions: runtimeAction.extensionPermissions,
      runtimeEntry,
      runtimeHandler: runtimeAction.view.runtime_handler ?? runtimeAction.view.actionId,
      actionId: runtimeAction.view.actionId,
      input: resolvedInput,
      context: input.context,
      actor: input.actor,
      requestId: input.requestId,
      dryRun: input.dryRun,
    })
  }

  const capability = runtimeAction.view.capability
  if (!capability) {
    throw new Error(`Declarative action "${runtimeAction.view.actionId}" is missing capability.`)
  }

  return invokeExtensionCapabilityOrch<CapabilityName>({
    extensionId: runtimeAction.view.extensionId,
    extensionRegistryKey: runtimeAction.view.extensionRegistryKey,
    extensionPermissions: runtimeAction.extensionPermissions,
    capability,
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
    const executionKind = record.manifest?.entry_kind === 'electron-js' ? 'runtime' : 'declarative'
    const runtimeEntry = record.manifest?.entry

    for (const action of record.actions) {
      if (action.target !== target) continue
      if (executionKind === 'declarative' && !action.capability) continue
      actions.push({
        view: toSlotActionView(record.registryKey, extensionId, action, executionKind, runtimeEntry),
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
  executionKind: 'declarative' | 'runtime',
  runtimeEntry?: string,
): ExtensionSlotActionView {
  const runtimeHandler = isRuntimeExtensionActionBlock(action)
    ? action.runtime_handler
    : action.id

  return {
    actionKey: buildExtensionActionKeyOrch(registryKey, action.id),
    actionId: action.id,
    label: action.label,
    ...(action.description ? { description: action.description } : {}),
    target: action.target,
    execution_kind: executionKind,
    ...(action.capability ? { capability: action.capability } : {}),
    ...(executionKind === 'runtime' ? {
      runtime_handler: runtimeHandler,
      runtime_entry: runtimeEntry,
    } : {}),
    extensionId,
    extensionRegistryKey: registryKey,
  }
}
