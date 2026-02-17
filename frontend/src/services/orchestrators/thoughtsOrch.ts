import type { ThoughtMonthData, ThoughtSectionMonthData } from '../lego_blocks/typesBlock'
import { getVaultFS } from '../lego_blocks/fsBlock'
import { getNodeByKey } from '../lego_blocks/dbBlock'
import {
  getThoughtsMonth as scanThoughtsMonth,
  getThoughtsSectionMonth as scanThoughtsSectionMonth,
} from '../lego_blocks/thoughtsScannerBlock'
import { createNote, generateKey, stringifyNote } from '../lego_blocks/yamlNoteBlock'
import { syncSingleFile } from './vaultSyncOrch'
import {
  MarkdownDocumentConflictError,
  readMarkdownDocument,
  saveMarkdownDocument,
} from './markdownDocumentsOrch'
export async function getThoughtsMonth(year: number, month: number): Promise<ThoughtMonthData> {
  const fs = getVaultFS()
  return scanThoughtsMonth(fs, year, month)
}

export async function getThoughtsSectionMonth(
  year: number,
  month: number,
  sections: string[],
): Promise<ThoughtSectionMonthData> {
  const fs = getVaultFS()
  return scanThoughtsSectionMonth(fs, year, month, sections)
}

export async function getThoughtForEdit(path: string): Promise<{
  path: string
  content: string
  mtime: number
  hash: string
}> {
  return readMarkdownDocument(path)
}

export async function saveThoughtEdit(params: {
  path: string
  content: string
  baseMtime: number
  baseHash: string
}): Promise<{ output_path: string; revision_path: string | null }> {
  const result = await saveMarkdownDocument(params)
  return result
}

export { MarkdownDocumentConflictError as ThoughtConflictError }

export async function createThought(params: {
  folder_path: string
  filename: string
  content: string
  title: string | null
  date_header: boolean
  emotions: string[]
}): Promise<{ output_path: string }> {
  const fs = getVaultFS()
  const outputPath = `${params.folder_path}/${params.filename}`

  const bodyParts: string[] = []
  const emotions = (params.emotions || []).filter(e => e && e.trim())

  if (params.title) {
    bodyParts.push(`# ${params.title}`)
    bodyParts.push('')
  }

  if (params.date_header) {
    const today = new Date()
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })
    const monthName = today.toLocaleDateString('en-US', { month: 'long' })
    bodyParts.push(`*${dayName}, ${monthName} ${today.getDate()}, ${today.getFullYear()}*`)
    bodyParts.push('')
  }

  bodyParts.push(params.content)

  const noteTitle = (params.title?.trim() || deriveTitleFromFilename(params.filename))
  const note = createNote({
    type: 'thought',
    title: noteTitle,
    tags: emotions.length > 0
      ? ['thought', ...emotions.map(emotionToTag)]
      : ['thought'],
    body: bodyParts.join('\n'),
  })
  note.frontmatter.key = await ensureUniqueKeyForPath(outputPath, note.frontmatter.key)
  if (emotions.length > 0) {
    note.frontmatter.emotions = emotions
  }

  await fs.mkdir(params.folder_path)
  await fs.create(outputPath, stringifyNote(note))
  await syncSingleFile(outputPath, fs)
  return { output_path: outputPath }
}

function deriveTitleFromFilename(filename: string): string {
  const basename = filename.replace(/\.md$/i, '')
  const normalized = basename.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized || 'Untitled Thought'
}

function emotionToTag(emotion: string): string {
  const slug = generateKey(emotion.trim())
  return slug ? `emotion/${slug}` : 'emotion/unknown'
}

async function ensureUniqueKeyForPath(filePath: string, suggested: string): Promise<string> {
  const fallback = generateKey(filePath) || 'thought'
  const base = suggested || fallback
  let candidate = base
  let suffix = 2

  while (suffix < 1000) {
    const existing = await getNodeByKey(candidate)
    if (!existing || existing.filePath === filePath) return candidate
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  throw new Error(`Could not generate a unique key for ${filePath}`)
}
