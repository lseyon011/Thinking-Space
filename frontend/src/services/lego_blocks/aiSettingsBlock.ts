import { getJsonStorageItem, setJsonStorageItem, STORAGE_KEYS } from './storageKeyBlock'
import {
  defaultProviderModelBlock,
  isAiProvider,
  type AiProvider,
} from './aiProviderBlock'

export type AiSettingsScope =
  | 'chat'
  | 'markdown_editor'
  | 'new_thought'
  | 'todos'
  | 'steward_metadata'

export const AI_SETTINGS_SCOPE_ORDER: AiSettingsScope[] = [
  'chat',
  'markdown_editor',
  'new_thought',
  'todos',
  'steward_metadata',
]

export interface AiSettings {
  selectedProvider: AiProvider | null
  selectedModelByProvider: Partial<Record<AiProvider, string>>
  selectedProviderByScope: Partial<Record<AiSettingsScope, AiProvider>>
  selectedModelByScopeProvider: Partial<Record<string, string>>
}

const DEFAULT_SETTINGS: AiSettings = {
  selectedProvider: null,
  selectedModelByProvider: {},
  selectedProviderByScope: {},
  selectedModelByScopeProvider: {},
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

function sanitizeScopeProviderMap(raw: unknown): Partial<Record<AiSettingsScope, AiProvider>> {
  if (!raw || typeof raw !== 'object') return {}
  const next: Partial<Record<AiSettingsScope, AiProvider>> = {}
  for (const [scope, provider] of Object.entries(raw)) {
    if (!isAiSettingsScope(scope)) continue
    if (!isAiProvider(provider)) continue
    next[scope] = provider
  }
  return next
}

export function isAiSettingsScope(value: unknown): value is AiSettingsScope {
  return value === 'chat'
    || value === 'markdown_editor'
    || value === 'new_thought'
    || value === 'todos'
    || value === 'steward_metadata'
}

function scopeProviderKey(scope: AiSettingsScope, provider: AiProvider): string {
  return `${scope}:${provider}`
}

function parseScopeProviderKey(value: string): { scope: AiSettingsScope; provider: AiProvider } | null {
  const [scopeRaw, providerRaw] = value.split(':', 2)
  if (!isAiSettingsScope(scopeRaw)) return null
  if (!isAiProvider(providerRaw)) return null
  return { scope: scopeRaw, provider: providerRaw }
}

function sanitizeScopeProviderModelMap(raw: unknown): Partial<Record<string, string>> {
  if (!raw || typeof raw !== 'object') return {}
  const next: Partial<Record<string, string>> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!parseScopeProviderKey(key)) continue
    const model = sanitizeModel(value)
    if (!model) continue
    next[key] = model
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
    selectedProviderByScope: sanitizeScopeProviderMap(parsed.selectedProviderByScope),
    selectedModelByScopeProvider: sanitizeScopeProviderModelMap(parsed.selectedModelByScopeProvider),
  }
}

export function writeAiSettingsBlock(next: AiSettings): AiSettings {
  const normalized: AiSettings = {
    selectedProvider: isAiProvider(next.selectedProvider) ? next.selectedProvider : null,
    selectedModelByProvider: sanitizeModelMap(next.selectedModelByProvider),
    selectedProviderByScope: sanitizeScopeProviderMap(next.selectedProviderByScope),
    selectedModelByScopeProvider: sanitizeScopeProviderModelMap(next.selectedModelByScopeProvider),
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

export function setSelectedAiProviderForScopeBlock(
  scope: AiSettingsScope,
  provider: AiProvider | null,
): AiSettings {
  const current = readAiSettingsBlock()
  const nextMap = { ...current.selectedProviderByScope }

  if (provider && isAiProvider(provider)) {
    nextMap[scope] = provider
  } else {
    delete nextMap[scope]
  }

  return writeAiSettingsBlock({
    ...current,
    selectedProviderByScope: nextMap,
  })
}

export function setSelectedAiModelForScopeBlock(
  scope: AiSettingsScope,
  provider: AiProvider,
  model: string,
): AiSettings {
  const normalized = sanitizeModel(model)
  const current = readAiSettingsBlock()
  const nextMap = { ...current.selectedModelByScopeProvider }
  const key = scopeProviderKey(scope, provider)

  if (normalized) {
    nextMap[key] = normalized
  } else {
    delete nextMap[key]
  }

  return writeAiSettingsBlock({
    ...current,
    selectedModelByScopeProvider: nextMap,
  })
}

export function resolveAiModelForProviderBlock(provider: AiProvider, settings?: AiSettings): string {
  const snapshot = settings ?? readAiSettingsBlock()
  const configured = sanitizeModel(snapshot.selectedModelByProvider[provider])
  return configured || defaultProviderModelBlock(provider)
}

export function resolveAiModelForScopeProviderBlock(
  scope: AiSettingsScope,
  provider: AiProvider,
  settings?: AiSettings,
): string {
  const snapshot = settings ?? readAiSettingsBlock()
  const scoped = sanitizeModel(snapshot.selectedModelByScopeProvider[scopeProviderKey(scope, provider)])
  if (scoped) return scoped
  return resolveAiModelForProviderBlock(provider, snapshot)
}

export function resolveAiProviderForScopeBlock(
  scope: AiSettingsScope,
  settings?: AiSettings,
): AiProvider | null {
  const snapshot = settings ?? readAiSettingsBlock()
  const scopedProvider = snapshot.selectedProviderByScope[scope]
  if (scopedProvider && isAiProvider(scopedProvider)) return scopedProvider
  return null
}
