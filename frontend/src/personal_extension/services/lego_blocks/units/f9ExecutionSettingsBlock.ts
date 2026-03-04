import { getJsonStorageItem, setJsonStorageItem, STORAGE_KEYS } from '@/services/lego_blocks/units/storageKeyBlock'

export interface F9ExecutionSettingsBlock {
  executionFolderPath: string
}

export const DEFAULT_F9_EXECUTION_FOLDER_PATH_BLOCK = ''

const F9_RELATIVE_ROOT_HINTS_BLOCK = [
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
  for (const hint of F9_RELATIVE_ROOT_HINTS_BLOCK) {
    const idx = lowered.indexOf(`/${hint}`)
    if (idx >= 0) {
      const rel = trimSlashesBlock(normalized.slice(idx + 1))
      if (rel) return rel
    }
  }
  return null
}

function sanitizeExecutionFolderPathBlock(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_F9_EXECUTION_FOLDER_PATH_BLOCK
  const normalized = value.trim()
  if (!normalized) return DEFAULT_F9_EXECUTION_FOLDER_PATH_BLOCK
  const withoutTrailing = normalizeSlashPathBlock(normalized).replace(/\/+$/, '')
  if (withoutTrailing.startsWith('/')) {
    return deriveRelativeExecutionPathBlock(withoutTrailing) ?? withoutTrailing
  }
  return withoutTrailing
}

export function normalizeF9ExecutionSettingsBlock(
  value: Partial<F9ExecutionSettingsBlock> | null | undefined,
): F9ExecutionSettingsBlock {
  return {
    executionFolderPath: sanitizeExecutionFolderPathBlock(value?.executionFolderPath),
  }
}

export function getDefaultF9ExecutionSettingsBlock(): F9ExecutionSettingsBlock {
  return {
    executionFolderPath: DEFAULT_F9_EXECUTION_FOLDER_PATH_BLOCK,
  }
}

export function readF9ExecutionSettingsBlock(): F9ExecutionSettingsBlock {
  const raw = getJsonStorageItem<Partial<F9ExecutionSettingsBlock> | null>(
    STORAGE_KEYS.f9ExecutionSettings,
    null,
  )
  return normalizeF9ExecutionSettingsBlock(raw)
}

export function writeF9ExecutionSettingsBlock(
  settings: F9ExecutionSettingsBlock,
): F9ExecutionSettingsBlock {
  const sanitized = normalizeF9ExecutionSettingsBlock(settings)
  setJsonStorageItem(STORAGE_KEYS.f9ExecutionSettings, sanitized)
  return sanitized
}
