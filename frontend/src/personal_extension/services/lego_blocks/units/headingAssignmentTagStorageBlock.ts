import {
  normalizeHexColorBlock,
  normalizeTagListBlock,
  tagLookupKeyBlock,
} from '@/services/lego_blocks/units/tagBlock'
import { STORAGE_KEYS, getJsonStorageItem, setJsonStorageItem } from '@/services/orchestrators/storageOrch'

export interface HeadingAssignmentTagSettingsBlock {
  tags: string[]
  tagColors: Record<string, string>
}

function sanitizeTagColorsBlock(input: unknown, allowedTags: string[]): Record<string, string> {
  const record = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
  const allowedKeys = new Set(allowedTags.map(tagLookupKeyBlock))
  const tagColors: Record<string, string> = {}

  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = tagLookupKeyBlock(key)
    if (!allowedKeys.has(normalizedKey)) continue
    if (typeof value !== 'string') continue
    const normalizedColor = normalizeHexColorBlock(value)
    if (!normalizedColor) continue
    tagColors[normalizedKey] = normalizedColor
  }

  return tagColors
}

export function readHeadingAssignmentTagSettingsBlock(): HeadingAssignmentTagSettingsBlock {
  const tags = normalizeTagListBlock(getJsonStorageItem<string[]>(STORAGE_KEYS.headingAssignmentTags, []))
  const tagColors = sanitizeTagColorsBlock(
    getJsonStorageItem<Record<string, string>>(STORAGE_KEYS.headingAssignmentTagColors, {}),
    tags,
  )

  return { tags, tagColors }
}

export function writeHeadingAssignmentTagSettingsBlock(input: HeadingAssignmentTagSettingsBlock): HeadingAssignmentTagSettingsBlock {
  const tags = normalizeTagListBlock(input.tags)
  const tagColors = sanitizeTagColorsBlock(input.tagColors, tags)
  setJsonStorageItem(STORAGE_KEYS.headingAssignmentTags, tags)
  setJsonStorageItem(STORAGE_KEYS.headingAssignmentTagColors, tagColors)
  return { tags, tagColors }
}
