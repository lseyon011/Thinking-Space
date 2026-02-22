import {
  getDefaultMarkdownEditorSettingsBlock,
  readMarkdownEditorSettingsBlock,
  writeMarkdownEditorSettingsBlock,
  type MarkdownEditorSettingsBlock,
} from '@/services/lego_blocks/markdownEditorSettingsBlock'

export type { MarkdownEditorSettingsBlock }

export function getDefaultMarkdownEditorSettingsOrch(): MarkdownEditorSettingsBlock {
  return getDefaultMarkdownEditorSettingsBlock()
}

export function readMarkdownEditorSettingsOrch(): MarkdownEditorSettingsBlock {
  return readMarkdownEditorSettingsBlock()
}

export function writeMarkdownEditorSettingsOrch(settings: MarkdownEditorSettingsBlock): void {
  writeMarkdownEditorSettingsBlock(settings)
}
