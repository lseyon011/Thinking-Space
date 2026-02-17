import {
  AI_SETTINGS_SCOPE_ORDER,
  isAiSettingsScope,
  readAiSettingsBlock,
  resolveAiModelForScopeProviderBlock,
  resolveAiModelForProviderBlock,
  setSelectedAiModelForScopeBlock,
  setSelectedAiModelBlock,
  setSelectedAiProviderBlock,
  type AiSettingsScope,
  type AiSettings,
} from '../lego_blocks/aiSettingsBlock'
import {
  AI_PROVIDER_ORDER,
  listProviderModelsBlock,
  listProvidersBlock,
  type AiProvider,
  type AiProviderStatus,
} from '../lego_blocks/aiProviderBlock'

export interface ResolveAiSelectionInput {
  provider?: AiProvider | null
  model?: string | null
  scope?: AiSettingsScope | null
}

export type { AiSettingsScope, AiSettings }

export interface ResolvedAiSelection {
  provider: AiProvider
  model: string
  scope: AiSettingsScope | null
  providers: AiProviderStatus[]
}

function normalizeModel(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function pickAvailableProvider(
  providers: AiProviderStatus[],
  preferred: Array<AiProvider | null | undefined>,
): AiProvider | null {
  const available = new Set(providers.filter(item => item.available).map(item => item.provider))
  if (available.size === 0) return null

  for (const candidate of preferred) {
    if (candidate && available.has(candidate)) return candidate
  }
  for (const provider of AI_PROVIDER_ORDER) {
    if (available.has(provider)) return provider
  }
  return providers.find(item => item.available)?.provider ?? null
}

export function getAiSettingsOrch(): AiSettings {
  return readAiSettingsBlock()
}

export function setAiSelectedProviderOrch(provider: AiProvider | null): AiSettings {
  return setSelectedAiProviderBlock(provider)
}

export function setAiProviderModelOrch(provider: AiProvider, model: string): AiSettings {
  return setSelectedAiModelBlock(provider, model)
}

export function setAiScopeProviderModelOrch(
  scope: AiSettingsScope,
  provider: AiProvider,
  model: string,
): AiSettings {
  return setSelectedAiModelForScopeBlock(scope, provider, model)
}

export function listAiModelOptionsOrch(provider: AiProvider): string[] {
  return listProviderModelsBlock(provider)
}

export function listAiModelScopesOrch(): AiSettingsScope[] {
  return [...AI_SETTINGS_SCOPE_ORDER]
}

export function resolveAiSelectionFromProvidersOrch(
  providers: AiProviderStatus[],
  input?: ResolveAiSelectionInput,
): ResolvedAiSelection | null {
  const settings = readAiSettingsBlock()
  const scope = isAiSettingsScope(input?.scope) ? input!.scope : null
  const provider = pickAvailableProvider(providers, [
    input?.provider,
    settings.selectedProvider,
    ...AI_PROVIDER_ORDER,
  ])

  if (!provider) return null

  if (settings.selectedProvider !== provider) {
    setSelectedAiProviderBlock(provider)
  }

  const requestedModel = normalizeModel(input?.model)
  if (requestedModel) {
    if (scope) setSelectedAiModelForScopeBlock(scope, provider, requestedModel)
    else setSelectedAiModelBlock(provider, requestedModel)
  }

  const model = requestedModel || (
    scope
      ? resolveAiModelForScopeProviderBlock(scope, provider, settings)
      : resolveAiModelForProviderBlock(provider, settings)
  )

  return {
    provider,
    model,
    scope,
    providers,
  }
}

export async function resolveAiSelectionOrch(
  input?: ResolveAiSelectionInput,
): Promise<ResolvedAiSelection | null> {
  const providers = await listProvidersBlock()
  return resolveAiSelectionFromProvidersOrch(providers, input)
}

export function resolveAiModelForProviderOrch(provider: AiProvider): string {
  return resolveAiModelForProviderBlock(provider)
}

export function resolveAiModelForScopeProviderOrch(scope: AiSettingsScope, provider: AiProvider): string {
  return resolveAiModelForScopeProviderBlock(scope, provider)
}
