import {
  readAiSettingsBlock,
  resolveAiModelForProviderBlock,
  setSelectedAiModelBlock,
  setSelectedAiProviderBlock,
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
}

export interface ResolvedAiSelection {
  provider: AiProvider
  model: string
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

export function listAiModelOptionsOrch(provider: AiProvider): string[] {
  return listProviderModelsBlock(provider)
}

export function resolveAiSelectionFromProvidersOrch(
  providers: AiProviderStatus[],
  input?: ResolveAiSelectionInput,
): ResolvedAiSelection | null {
  const settings = readAiSettingsBlock()
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
    setSelectedAiModelBlock(provider, requestedModel)
  }

  const model = requestedModel || resolveAiModelForProviderBlock(provider, settings)

  return {
    provider,
    model,
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
