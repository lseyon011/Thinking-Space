export const WIKI_LINKS_FIELD_BLOCK = 'wiki_links'
export const LEGACY_SOURCE_LINKS_FIELD_BLOCK = 'source_links'
const ARRAY_LIKE_FRONTMATTER_FIELDS_BLOCK = new Set([
  'derived_from',
  'source_files',
  'related_concepts',
  'related_entities',
  'related_notes',
  'coverage',
  'open_questions',
  'answer_paths',
  'output_paths',
  WIKI_LINKS_FIELD_BLOCK,
  LEGACY_SOURCE_LINKS_FIELD_BLOCK,
])

export function toWikiLinkFromVaultPathBlock(filePath: string): string | undefined {
  const normalized = String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .trim()
  if (!normalized) return undefined

  const withoutMarkdownExt = normalized.endsWith('.md')
    ? normalized.slice(0, -3)
    : normalized
  if (!withoutMarkdownExt) return undefined

  return `[[${withoutMarkdownExt}]]`
}

export function normalizeWikiLinkOrPathBlock(value: string): string | undefined {
  const trimmed = String(value || '').trim()
  if (!trimmed) return undefined

  const wikilinkMatch = /^\[\[([\s\S]+)\]\]$/.exec(trimmed)
  if (wikilinkMatch) {
    const inner = wikilinkMatch[1]?.trim() ?? ''
    if (!inner) return undefined
    return `[[${inner}]]`
  }

  return toWikiLinkFromVaultPathBlock(trimmed)
}

export function uniqueStringsBlock(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

export function normalizeStringArrayBlock(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return uniqueStringsBlock(value.map(item => String(item)))
}

export function normalizeFrontmatterArrayLikeFieldsBlock(frontmatter: Record<string, unknown>): Record<string, unknown> {
  const next = { ...frontmatter }
  for (const key of ARRAY_LIKE_FRONTMATTER_FIELDS_BLOCK) {
    const normalized = normalizeArrayLikeFieldValueBlock(next[key])
    if (normalized !== undefined) {
      next[key] = normalized
    }
  }
  return next
}

export function resolveGeneratedWikiLinksForFrontmatterBlock(
  frontmatter: Record<string, unknown>,
  options?: {
    parentFilePath?: string
  },
): string[] {
  const generated: string[] = []

  const parentLink = options?.parentFilePath
    ? toWikiLinkFromVaultPathBlock(options.parentFilePath)
    : undefined
  if (parentLink) generated.push(parentLink)

  const derivedFrom = normalizeStringArrayBlock(frontmatter.derived_from)
  for (const path of derivedFrom) {
    const link = normalizeWikiLinkOrPathBlock(path)
    if (link) generated.push(link)
  }

  const sourceFiles = normalizeStringArrayBlock(frontmatter.source_files)
  for (const path of sourceFiles) {
    const link = normalizeWikiLinkOrPathBlock(path)
    if (link) generated.push(link)
  }

  return uniqueStringsBlock(generated)
}

export function mergeWikiLinksIntoFrontmatterBlock(
  frontmatter: Record<string, unknown>,
  options: {
    generatedLinks: string[]
    removeLinks?: string[]
  },
): {
  frontmatter: Record<string, unknown>
  changed: boolean
} {
  const next = { ...frontmatter }
  const existingWikiLinks = normalizeStringArrayBlock(next[WIKI_LINKS_FIELD_BLOCK])
  const legacySourceLinks = normalizeStringArrayBlock(next[LEGACY_SOURCE_LINKS_FIELD_BLOCK])
  const removeLinks = new Set(uniqueStringsBlock(options.removeLinks ?? []))
  const preservedExisting = existingWikiLinks.filter(link => !removeLinks.has(link))
  const mergedWikiLinks = uniqueStringsBlock([
    ...preservedExisting,
    ...legacySourceLinks,
    ...options.generatedLinks,
  ])

  if (mergedWikiLinks.length > 0) next[WIKI_LINKS_FIELD_BLOCK] = mergedWikiLinks
  else delete next[WIKI_LINKS_FIELD_BLOCK]

  const hadLegacySourceLinks = Object.prototype.hasOwnProperty.call(next, LEGACY_SOURCE_LINKS_FIELD_BLOCK)
  delete next[LEGACY_SOURCE_LINKS_FIELD_BLOCK]

  return {
    frontmatter: next,
    changed: hadLegacySourceLinks || !areStringArraysEqualBlock(existingWikiLinks, mergedWikiLinks),
  }
}

function areStringArraysEqualBlock(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function normalizeArrayLikeFieldValueBlock(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return uniqueStringsBlock(value.map(item => String(item)))
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return undefined

  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) return undefined
    return uniqueStringsBlock(parsed.map(item => String(item)))
  } catch {
    return undefined
  }
}
