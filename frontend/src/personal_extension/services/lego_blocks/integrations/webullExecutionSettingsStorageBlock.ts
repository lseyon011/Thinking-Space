import { getVaultFS, type VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  normalizeWebullExecutionSettingsBlock,
  type WebullExecutionSettingsBlock,
} from '../units/webullExecutionSettingsBlock'

interface WebullExecutionSettingsStoragePayloadBlock {
  schemaVersion?: number
  executionFolderPath?: string
}

const THINK_SPACE_DIR_BLOCK = '.thinking-space'
const PREFERENCES_DIR_BLOCK = `${THINK_SPACE_DIR_BLOCK}/preferences`
const Webull_SETTINGS_FILE_BLOCK = `${PREFERENCES_DIR_BLOCK}/webull.json`
const Webull_SETTINGS_SCHEMA_VERSION_BLOCK = 1

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

function normalizePayloadBlock(value: unknown): WebullExecutionSettingsBlock {
  const payload = value && typeof value === 'object'
    ? value as WebullExecutionSettingsStoragePayloadBlock
    : null
  return normalizeWebullExecutionSettingsBlock({
    executionFolderPath: payload?.executionFolderPath,
  })
}

export async function readWebullExecutionSettingsFromVaultBlock(fsParam?: VaultFS): Promise<WebullExecutionSettingsBlock | null> {
  const fs = fsParam ?? getVaultFS()
  const exists = await fs.exists(Webull_SETTINGS_FILE_BLOCK).catch(() => false)
  if (!exists) return null

  try {
    const raw = await fs.read(Webull_SETTINGS_FILE_BLOCK)
    if (!raw.trim()) return normalizeWebullExecutionSettingsBlock(null)
    return normalizePayloadBlock(JSON.parse(raw))
  } catch {
    return null
  }
}

export async function writeWebullExecutionSettingsToVaultBlock(
  settings: WebullExecutionSettingsBlock,
  fsParam?: VaultFS,
): Promise<WebullExecutionSettingsBlock> {
  const fs = fsParam ?? getVaultFS()
  const normalized = normalizeWebullExecutionSettingsBlock(settings)
  const payload: WebullExecutionSettingsStoragePayloadBlock = {
    schemaVersion: Webull_SETTINGS_SCHEMA_VERSION_BLOCK,
    executionFolderPath: normalized.executionFolderPath,
  }
  await ensurePreferencesDirBlock(fs)
  await fs.write(Webull_SETTINGS_FILE_BLOCK, `${JSON.stringify(payload, null, 2)}\n`)
  return normalized
}

