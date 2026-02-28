import { getJsonStorageItem, setJsonStorageItem, STORAGE_KEYS } from '@/services/lego_blocks/units/storageKeyBlock'

export interface F9ExecutionSettingsBlock {
  executionFolderPath: string
}

export const DEFAULT_F9_EXECUTION_FOLDER_PATH_BLOCK = '/Users/patila06/Library/Mobile Documents/iCloud~md~obsidian/Documents/Long Term Memory iCloud/acceleration_core/F9/F9-execution'

function sanitizeExecutionFolderPathBlock(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_F9_EXECUTION_FOLDER_PATH_BLOCK
  const normalized = value.trim()
  if (!normalized) return DEFAULT_F9_EXECUTION_FOLDER_PATH_BLOCK
  return normalized.replace(/[\\/]+$/, '')
}

function sanitizeSettingsBlock(
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
  return sanitizeSettingsBlock(raw)
}

export function writeF9ExecutionSettingsBlock(
  settings: F9ExecutionSettingsBlock,
): F9ExecutionSettingsBlock {
  const sanitized = sanitizeSettingsBlock(settings)
  setJsonStorageItem(STORAGE_KEYS.f9ExecutionSettings, sanitized)
  return sanitized
}

