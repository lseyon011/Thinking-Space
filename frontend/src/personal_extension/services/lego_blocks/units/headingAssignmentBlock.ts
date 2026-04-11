export interface HeadingAssignmentHeadingBlock {
  id: string
  line: number
  level: number
  title: string
}

export interface HeadingAssignmentPresetBlock {
  id: string
  name: string
  values: string[]
  updatedAt: string
}

export interface HeadingAssignmentPresetStoreBlock {
  presets: HeadingAssignmentPresetBlock[]
}

function normalizeHeadingTitleBlock(rawTitle: string): string {
  return rawTitle
    .replace(/\s+#+\s*$/g, '')
    .trim()
}

function normalizeExportFieldBlock(value: string): string {
  return value
    .replace(/\r?\n+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()
}

function buildHeadingIdBlock(line: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `heading-${line + 1}-${slug || 'untitled'}`
}

function toPresetRecordBlock(input: unknown): HeadingAssignmentPresetBlock | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt.trim() : ''
  const values = Array.isArray(record.values)
    ? record.values
      .filter((value): value is string => typeof value === 'string')
      .map(value => value.replace(/\r/g, '').trim())
      .filter(value => value.length > 0)
    : []

  if (!id || !name || !updatedAt || values.length === 0) return null

  return {
    id,
    name,
    values,
    updatedAt,
  }
}

export function parseMarkdownHeadingsBlock(markdown: string): HeadingAssignmentHeadingBlock[] {
  const lines = markdown.replace(/\r/g, '').split('\n')
  const headings: HeadingAssignmentHeadingBlock[] = []
  let activeFence: '```' | '~~~' | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()
    const fenceMatch = trimmed.match(/^(```|~~~)/)
    if (fenceMatch) {
      const fenceToken = fenceMatch[1] as '```' | '~~~'
      activeFence = activeFence === fenceToken ? null : (activeFence ?? fenceToken)
      continue
    }
    if (activeFence) continue

    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (!headingMatch) continue

    const title = normalizeHeadingTitleBlock(headingMatch[2])
    if (!title) continue

    headings.push({
      id: buildHeadingIdBlock(index, title),
      line: index + 1,
      level: headingMatch[1].length,
      title,
    })
  }

  return headings
}

export function parseHeadingAssignmentValuesBlock(input: string): string[] {
  const values = input
    .replace(/\r/g, '')
    .split('\n')
    .map(value => value.trim())
    .filter(value => value.length > 0)

  return values
}

export function sanitizeHeadingAssignmentPresetStoreBlock(input: unknown): HeadingAssignmentPresetStoreBlock {
  const record = (input && typeof input === 'object') ? input as Record<string, unknown> : {}
  const presets = Array.isArray(record.presets)
    ? record.presets
      .map(toPresetRecordBlock)
      .filter((preset): preset is HeadingAssignmentPresetBlock => preset !== null)
      .sort((left, right) => left.name.localeCompare(right.name))
    : []

  return { presets }
}

export function buildHeadingAssignmentExportBlock(
  headings: HeadingAssignmentHeadingBlock[],
  assignments: Record<string, string>,
): string {
  return headings
    .map((heading) => `${normalizeExportFieldBlock(heading.title)}|${normalizeExportFieldBlock(assignments[heading.id] ?? '')}`)
    .join('\n')
}

export function buildHeadingAssignmentDownloadNameBlock(filePath: string | null): string {
  const leaf = filePath?.split('/').filter(Boolean).pop() ?? 'heading-values'
  const stem = leaf.replace(/\.md$/i, '').trim()
  if (!stem || stem === 'heading-values') return 'heading-values.txt'
  return `${stem}-heading-values.txt`
}
