import { getJsonStorageItem, setJsonStorageItem, STORAGE_KEYS } from '@/services/lego_blocks/units/storageKeyBlock'

export interface WebullExecutionSettingsBlock {
  executionFolderPath: string
}

export const DEFAULT_Webull_EXECUTION_FOLDER_PATH_BLOCK = ''

const Webull_RELATIVE_ROOT_HINTS_BLOCK = [
  'acceleration_core/',
  'coding-projects/',
  'operations/',
] as const

function normalizeSlashPathBlock(value: string): string {
  return value.replace(/\\/g, '/')
}

function trimSlashesBlock(value: string): string {
  return value.replace(/^\/+/, '').replace(/\/+$/, '')
}

function deriveRelativeExecutionPathBlock(value: string): string | null {
  const normalized = normalizeSlashPathBlock(value)
  const lowered = normalized.toLowerCase()
  for (const hint of Webull_RELATIVE_ROOT_HINTS_BLOCK) {
    const idx = lowered.indexOf(`/${hint}`)
    if (idx >= 0) {
      const rel = trimSlashesBlock(normalized.slice(idx + 1))
      if (rel) return rel
    }
  }
  return null
}

function sanitizeExecutionFolderPathBlock(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_Webull_EXECUTION_FOLDER_PATH_BLOCK
  const normalized = value.trim()
  if (!normalized) return DEFAULT_Webull_EXECUTION_FOLDER_PATH_BLOCK
  const withoutTrailing = normalizeSlashPathBlock(normalized).replace(/\/+$/, '')
  if (withoutTrailing.startsWith('/')) {
    return deriveRelativeExecutionPathBlock(withoutTrailing) ?? withoutTrailing
  }
  return withoutTrailing
}

export function normalizeWebullExecutionSettingsBlock(
  value: Partial<WebullExecutionSettingsBlock> | null | undefined,
): WebullExecutionSettingsBlock {
  return {
    executionFolderPath: sanitizeExecutionFolderPathBlock(value?.executionFolderPath),
  }
}

export function getDefaultWebullExecutionSettingsBlock(): WebullExecutionSettingsBlock {
  return {
    executionFolderPath: DEFAULT_Webull_EXECUTION_FOLDER_PATH_BLOCK,
  }
}

export function readWebullExecutionSettingsBlock(): WebullExecutionSettingsBlock {
  const raw = getJsonStorageItem<Partial<WebullExecutionSettingsBlock> | null>(
    STORAGE_KEYS.webullExecutionSettings,
    null,
  )
  return normalizeWebullExecutionSettingsBlock(raw)
}

export function writeWebullExecutionSettingsBlock(
  settings: WebullExecutionSettingsBlock,
): WebullExecutionSettingsBlock {
  const sanitized = normalizeWebullExecutionSettingsBlock(settings)
  setJsonStorageItem(STORAGE_KEYS.webullExecutionSettings, sanitized)
  return sanitized
}
