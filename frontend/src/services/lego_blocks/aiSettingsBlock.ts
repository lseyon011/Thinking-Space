import { getJsonStorageItem, setJsonStorageItem, STORAGE_KEYS } from './storageKeyBlock'
import {
  defaultProviderModelBlock,
  isAiProvider,
  type AiProvider,
} from './aiProviderBlock'

export interface AiSettings {
  selectedProvider: AiProvider | null
  selectedModelByProvider: Partial<Record<AiProvider, string>>
}

const DEFAULT_SETTINGS: AiSettings = {
  selectedProvider: null,
  selectedModelByProvider: {},
}

function sanitizeModel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function sanitizeModelMap(raw: unknown): Partial<Record<AiProvider, string>> {
  if (!raw || typeof raw !== 'object') return {}
  const next: Partial<Record<AiProvider, string>> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isAiProvider(key)) continue
    const model = sanitizeModel(value)
    if (model) next[key] = model
  }
  return next
}

export function readAiSettingsBlock(): AiSettings {
  const raw = getJsonStorageItem<unknown>(STORAGE_KEYS.aiSettings, DEFAULT_SETTINGS)
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS }
  const parsed = raw as Partial<AiSettings>
  return {
    selectedProvider: isAiProvider(parsed.selectedProvider) ? parsed.selectedProvider : null,
    selectedModelByProvider: sanitizeModelMap(parsed.selectedModelByProvider),
  }
}

export function writeAiSettingsBlock(next: AiSettings): AiSettings {
  const normalized: AiSettings = {
    selectedProvider: isAiProvider(next.selectedProvider) ? next.selectedProvider : null,
    selectedModelByProvider: sanitizeModelMap(next.selectedModelByProvider),
  }
  setJsonStorageItem(STORAGE_KEYS.aiSettings, normalized)
  return normalized
}

export function setSelectedAiProviderBlock(provider: AiProvider | null): AiSettings {
  const current = readAiSettingsBlock()
  return writeAiSettingsBlock({
    ...current,
    selectedProvider: isAiProvider(provider) ? provider : null,
  })
}

export function setSelectedAiModelBlock(provider: AiProvider, model: string): AiSettings {
  const normalized = sanitizeModel(model)
  const current = readAiSettingsBlock()
  const nextModels = { ...current.selectedModelByProvider }
  if (normalized) {
    nextModels[provider] = normalized
  } else {
    delete nextModels[provider]
  }
  return writeAiSettingsBlock({
    ...current,
    selectedModelByProvider: nextModels,
  })
}

export function resolveAiModelForProviderBlock(provider: AiProvider, settings?: AiSettings): string {
  const snapshot = settings ?? readAiSettingsBlock()
  const configured = sanitizeModel(snapshot.selectedModelByProvider[provider])
  return configured || defaultProviderModelBlock(provider)
}
