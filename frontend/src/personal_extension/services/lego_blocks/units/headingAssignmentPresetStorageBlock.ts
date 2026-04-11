import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  sanitizeHeadingAssignmentPresetStoreBlock,
  type HeadingAssignmentPresetStoreBlock,
} from './headingAssignmentBlock'

export const HEADING_ASSIGNMENT_PRESET_STORAGE_PATH_BLOCK = '.thinking-space/personal-tools/heading-assignment-presets.json'

export async function readHeadingAssignmentPresetStoreBlock(): Promise<HeadingAssignmentPresetStoreBlock> {
  try {
    const raw = await getVaultFS().read(HEADING_ASSIGNMENT_PRESET_STORAGE_PATH_BLOCK)
    return sanitizeHeadingAssignmentPresetStoreBlock(JSON.parse(raw))
  } catch {
    return { presets: [] }
  }
}

export async function writeHeadingAssignmentPresetStoreBlock(
  store: HeadingAssignmentPresetStoreBlock,
): Promise<HeadingAssignmentPresetStoreBlock> {
  const normalized = sanitizeHeadingAssignmentPresetStoreBlock(store)
  await getVaultFS().write(
    HEADING_ASSIGNMENT_PRESET_STORAGE_PATH_BLOCK,
    `${JSON.stringify(normalized, null, 2)}\n`,
  )
  return normalized
}
