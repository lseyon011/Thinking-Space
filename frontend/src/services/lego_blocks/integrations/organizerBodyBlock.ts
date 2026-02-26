import type { YAMLCommentEntry } from '@/services/lego_blocks/units/yamlNoteBlock'

interface BodySection {
  heading: string
  headingNormalized: string
  content: string
}

interface BodySections {
  preface: string
  sections: BodySection[]
}

export interface OrganizerBodySections {
  description?: string
  comments: YAMLCommentEntry[]
}

const COMMENT_BLOCK_SEPARATOR_RE = /\n{2,}---\n{2,}/
const COMMENT_META_RE = /^<!--\s*ltm-comment-meta:(.+?)\s*-->\s*\n?/s

export function parseOrganizerBodySections(body: string): OrganizerBodySections {
  const parsed = splitTopLevelSections(body)
  const descriptionSection = parsed.sections.find(section => section.headingNormalized === 'description')
  const commentsSection = parsed.sections.find(section => section.headingNormalized === 'comments')

  return {
    description: normalizeSectionText(descriptionSection?.content),
    comments: parseCommentSection(commentsSection?.content ?? ''),
  }
}

export function upsertOrganizerBodySections(
  body: string,
  updates: {
    description?: string
    comments: YAMLCommentEntry[]
  },
): string {
  const parsed = splitTopLevelSections(body)
  const preservedSections = parsed.sections.filter(section => (
    section.headingNormalized !== 'description' &&
    section.headingNormalized !== 'comments'
  ))

  const blocks: string[] = []
  const preface = normalizeSectionText(parsed.preface)
  if (preface) blocks.push(preface)

  const description = normalizeSectionText(updates.description)
  if (description) {
    blocks.push(['## Description', '', description].join('\n'))
  }

  if (updates.comments.length > 0) {
    blocks.push(['## Comments', '', serializeCommentSection(updates.comments)].join('\n'))
  }

  for (const section of preservedSections) {
    const content = normalizeSectionText(section.content)
    blocks.push(content
      ? [`## ${section.heading}`, '', content].join('\n')
      : `## ${section.heading}`)
  }

  return blocks.join('\n\n').trim()
}

function splitTopLevelSections(body: string): BodySections {
  const normalized = normalizeBody(body)
  const headingRe = /^##\s+(.+?)\s*$/gm
  const matches: Array<{ start: number; end: number; heading: string }> = []

  for (const match of normalized.matchAll(headingRe)) {
    if (typeof match.index !== 'number') continue
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      heading: match[1].trim(),
    })
  }

  if (matches.length === 0) {
    return {
      preface: normalized.trim(),
      sections: [],
    }
  }

  const preface = normalized.slice(0, matches[0].start).trim()
  const sections: BodySection[] = []

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i]
    const next = matches[i + 1]
    const sectionEnd = next ? next.start : normalized.length
    const content = normalized.slice(current.end, sectionEnd).replace(/^\n+/, '').trim()
    sections.push({
      heading: current.heading,
      headingNormalized: current.heading.toLowerCase(),
      content,
    })
  }

  return { preface, sections }
}

function parseCommentSection(content: string): YAMLCommentEntry[] {
  const normalized = normalizeSectionText(content)
  if (!normalized) return []

  const lines = normalized.split('\n')
  const bulletItems = lines
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.slice(2).trim())
    .filter(Boolean)
  if (bulletItems.length > 0 && bulletItems.length === lines.filter(line => line.trim()).length) {
    return bulletItems.map(text => ({ text }))
  }

  const blocks = normalized.split(COMMENT_BLOCK_SEPARATOR_RE)
    .map(block => block.trim())
    .filter(Boolean)
  if (blocks.length === 0) return []

  return blocks
    .map(parseCommentBlock)
    .filter((entry): entry is YAMLCommentEntry => entry !== null)
}

function parseCommentBlock(block: string): YAMLCommentEntry | null {
  const metaMatch = block.match(COMMENT_META_RE)
  let text = block
  let added_at: string | undefined
  let added_by: string | undefined

  if (metaMatch) {
    text = block.slice(metaMatch[0].length).trim()
    const meta = parseCommentMeta(metaMatch[1])
    added_at = meta.added_at
    added_by = meta.added_by
  }

  const normalizedText = text.trim()
  if (!normalizedText) return null
  return {
    text: normalizedText,
    added_at,
    added_by,
  }
}

function parseCommentMeta(raw: string): { added_at?: string; added_by?: string } {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      added_at: typeof parsed.added_at === 'string' ? parsed.added_at : undefined,
      added_by: typeof parsed.added_by === 'string' ? parsed.added_by : undefined,
    }
  } catch {
    return {}
  }
}

function serializeCommentSection(comments: YAMLCommentEntry[]): string {
  return comments
    .map(comment => serializeCommentBlock(comment))
    .filter(Boolean)
    .join('\n\n---\n\n')
}

function serializeCommentBlock(comment: YAMLCommentEntry): string {
  const text = comment.text?.trim() ?? ''
  if (!text) return ''
  const meta = {
    added_at: comment.added_at ?? '',
    added_by: comment.added_by ?? '',
  }
  return [
    `<!-- ltm-comment-meta:${JSON.stringify(meta)} -->`,
    text,
  ].join('\n')
}

function normalizeSectionText(value: string | undefined): string | undefined {
  const normalized = normalizeBody(value ?? '').trim()
  return normalized || undefined
}

function normalizeBody(value: string): string {
  return value.replace(/\r\n/g, '\n')
}
