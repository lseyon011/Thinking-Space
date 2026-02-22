import { STORAGE_KEYS, getJsonStorageItem, setJsonStorageItem } from './storageKeyBlock'

export interface MarkdownEditorSettingsBlock {
  preserveSpacesInViewMode: boolean
}

const DEFAULT_MARKDOWN_EDITOR_SETTINGS_BLOCK: MarkdownEditorSettingsBlock = {
  preserveSpacesInViewMode: true,
}

function sanitizeMarkdownEditorSettingsBlock(
  value: Partial<MarkdownEditorSettingsBlock> | null | undefined,
): MarkdownEditorSettingsBlock {
  return {
    preserveSpacesInViewMode: value?.preserveSpacesInViewMode ?? true,
  }
}

export function getDefaultMarkdownEditorSettingsBlock(): MarkdownEditorSettingsBlock {
  return { ...DEFAULT_MARKDOWN_EDITOR_SETTINGS_BLOCK }
}

export function readMarkdownEditorSettingsBlock(): MarkdownEditorSettingsBlock {
  const raw = getJsonStorageItem<Partial<MarkdownEditorSettingsBlock> | null>(
    STORAGE_KEYS.markdownEditorSettings,
    null,
  )
  return sanitizeMarkdownEditorSettingsBlock(raw)
}

export function writeMarkdownEditorSettingsBlock(settings: MarkdownEditorSettingsBlock): void {
  setJsonStorageItem(
    STORAGE_KEYS.markdownEditorSettings,
    sanitizeMarkdownEditorSettingsBlock(settings),
  )
}
