import { getVaultFS, type VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  normalizeF9ExecutionSettingsBlock,
  type F9ExecutionSettingsBlock,
} from '../units/f9ExecutionSettingsBlock'

interface F9ExecutionSettingsStoragePayloadBlock {
  schemaVersion?: number
  executionFolderPath?: string
}

const THINK_SPACE_DIR_BLOCK = '.thinking-space'
const PREFERENCES_DIR_BLOCK = `${THINK_SPACE_DIR_BLOCK}/preferences`
const F9_SETTINGS_FILE_BLOCK = `${PREFERENCES_DIR_BLOCK}/f9.json`
const F9_SETTINGS_SCHEMA_VERSION_BLOCK = 1

async function ensurePreferencesDirBlock(fs: VaultFS): Promise<void> {
  try {
    await fs.mkdir(THINK_SPACE_DIR_BLOCK)
  } catch {
    // Directory may already exist.
  }
  try {
    await fs.mkdir(PREFERENCES_DIR_BLOCK)
  } catch {
    // Directory may already exist.
  }
}

function normalizePayloadBlock(value: unknown): F9ExecutionSettingsBlock {
  const payload = value && typeof value === 'object'
    ? value as F9ExecutionSettingsStoragePayloadBlock
    : null
  return normalizeF9ExecutionSettingsBlock({
    executionFolderPath: payload?.executionFolderPath,
  })
}

export async function readF9ExecutionSettingsFromVaultBlock(fsParam?: VaultFS): Promise<F9ExecutionSettingsBlock | null> {
  const fs = fsParam ?? getVaultFS()
  const exists = await fs.exists(F9_SETTINGS_FILE_BLOCK).catch(() => false)
  if (!exists) return null

  try {
    const raw = await fs.read(F9_SETTINGS_FILE_BLOCK)
    if (!raw.trim()) return normalizeF9ExecutionSettingsBlock(null)
    return normalizePayloadBlock(JSON.parse(raw))
  } catch {
    return null
  }
}

export async function writeF9ExecutionSettingsToVaultBlock(
  settings: F9ExecutionSettingsBlock,
  fsParam?: VaultFS,
): Promise<F9ExecutionSettingsBlock> {
  const fs = fsParam ?? getVaultFS()
  const normalized = normalizeF9ExecutionSettingsBlock(settings)
  const payload: F9ExecutionSettingsStoragePayloadBlock = {
    schemaVersion: F9_SETTINGS_SCHEMA_VERSION_BLOCK,
    executionFolderPath: normalized.executionFolderPath,
  }
  await ensurePreferencesDirBlock(fs)
  await fs.write(F9_SETTINGS_FILE_BLOCK, `${JSON.stringify(payload, null, 2)}\n`)
  return normalized
}

