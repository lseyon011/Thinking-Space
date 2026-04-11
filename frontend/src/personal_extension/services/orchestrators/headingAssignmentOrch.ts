import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import { getFileContent, listMarkdownEntries } from '@/services/orchestrators/fileSystemOrch'
import {
  buildHeadingAssignmentDownloadNameBlock,
  parseMarkdownHeadingsBlock,
  type HeadingAssignmentHeadingBlock,
  type HeadingAssignmentPresetBlock,
} from '../lego_blocks/units/headingAssignmentBlock'
import {
  readHeadingAssignmentPresetStoreBlock,
  writeHeadingAssignmentPresetStoreBlock,
} from '../lego_blocks/units/headingAssignmentPresetStorageBlock'

export interface HeadingAssignmentFileOptionOrch {
  path: string
  label: string
}

export interface HeadingAssignmentDocumentOrch {
  path: string
  headings: HeadingAssignmentHeadingBlock[]
}

function normalizePresetNameBlock(name: string): string {
  return name.trim().toLowerCase()
}

function sortPresetsBlock(presets: HeadingAssignmentPresetBlock[]): HeadingAssignmentPresetBlock[] {
  return [...presets].sort((left, right) => left.name.localeCompare(right.name))
}

function createPresetIdBlock(): string {
  return `heading-preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function listHeadingAssignmentFileOptionsOrch(): Promise<HeadingAssignmentFileOptionOrch[]> {
  const entries = await listMarkdownEntries()
  return entries
    .map((entry) => entry.path.trim())
    .filter(path => path.length > 0 && !path.endsWith('.excalidraw.md'))
    .sort((left, right) => left.localeCompare(right))
    .map(path => ({ path, label: path }))
}

export async function readHeadingAssignmentDocumentOrch(path: string): Promise<HeadingAssignmentDocumentOrch> {
  const { content } = await getFileContent(path)
  return {
    path,
    headings: parseMarkdownHeadingsBlock(content),
  }
}

export async function loadHeadingAssignmentPresetsOrch(): Promise<HeadingAssignmentPresetBlock[]> {
  const store = await readHeadingAssignmentPresetStoreBlock()
  return sortPresetsBlock(store.presets)
}

export async function saveHeadingAssignmentPresetOrch(input: {
  id?: string
  name: string
  values: string[]
}): Promise<{ preset: HeadingAssignmentPresetBlock; presets: HeadingAssignmentPresetBlock[] }> {
  const name = input.name.trim()
  if (!name) {
    throw new Error('Enter a preset name before saving.')
  }
  if (input.values.length === 0) {
    throw new Error('Add at least one dropdown value before saving a preset.')
  }

  const store = await readHeadingAssignmentPresetStoreBlock()
  const normalizedName = normalizePresetNameBlock(name)
  const nextPreset: HeadingAssignmentPresetBlock = {
    id: input.id?.trim() || createPresetIdBlock(),
    name,
    values: input.values,
    updatedAt: new Date().toISOString(),
  }

  const existingIndex = store.presets.findIndex((preset) => (
    (input.id?.trim() && preset.id === input.id.trim())
    || normalizePresetNameBlock(preset.name) === normalizedName
  ))

  const nextPresets = [...store.presets]
  if (existingIndex >= 0) {
    nextPresets[existingIndex] = nextPreset
  } else {
    nextPresets.push(nextPreset)
  }

  const written = await writeHeadingAssignmentPresetStoreBlock({ presets: sortPresetsBlock(nextPresets) })
  return {
    preset: written.presets.find(preset => preset.id === nextPreset.id) ?? nextPreset,
    presets: written.presets,
  }
}

export async function deleteHeadingAssignmentPresetOrch(id: string): Promise<HeadingAssignmentPresetBlock[]> {
  const targetId = id.trim()
  if (!targetId) return loadHeadingAssignmentPresetsOrch()

  const store = await readHeadingAssignmentPresetStoreBlock()
  const written = await writeHeadingAssignmentPresetStoreBlock({
    presets: store.presets.filter((preset) => preset.id !== targetId),
  })
  return written.presets
}

export async function saveHeadingAssignmentExportOrch(input: {
  targetFolderPath: string
  fileName: string
  content: string
}): Promise<string> {
  const folderPath = input.targetFolderPath
    .replace(/\\/g, '/')
    .trim()
    .replace(/^\/+|\/+$/g, '')
  if (!folderPath) {
    throw new Error('Select a markdown file before saving the export.')
  }

  const fileName = input.fileName.trim()
  if (!fileName) {
    throw new Error('Enter a file name before saving the export.')
  }
  if (/[\\/]/.test(fileName)) {
    throw new Error('File name cannot include folder separators.')
  }

  const outputPath = `${folderPath}/${fileName}`
  await getVaultFS().write(outputPath, input.content)
  return outputPath
}

export { buildHeadingAssignmentDownloadNameBlock }
