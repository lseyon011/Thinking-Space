const WIKILINK_TOKEN_PATTERN = /(!)?\[\[([^[\]]+?)\]\]/g
const THINKING_SPACE_WIKILINK_PREFIX = 'ts-wikilink:'

type WikilinkTextTokenKind = 'text' | 'wikilink'

export interface ParsedWikilinkTargetBlock {
  raw: string
  path: string
  heading: string | null
  blockRef: string | null
}

export interface WikilinkTextTokenBlock {
  kind: WikilinkTextTokenKind
  text: string
  target: string | null
  alias: string | null
  embed: boolean
}

export interface ResolveWikilinkPathBlockInput {
  currentPath: string
  target: string
  candidatePaths: string[]
}

export interface ResolveWikilinkPathBlockResult {
  path: string | null
  heading: string | null
  blockRef: string | null
}

export interface WikilinkSuggestionBlock {
  path: string
  target: string
  score: number
}

export interface BuildWikilinkSuggestionsBlockInput {
  currentPath: string
  query: string
  candidatePaths: string[]
  limit?: number
}

function normalizeVaultPath(path: string): string {
  const sanitized = path.replace(/\\/g, '/').trim()
  if (!sanitized) return ''

  const parts = sanitized.split('/').filter(Boolean)
  const stack: string[] = []
  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') {
      if (stack.length > 0) stack.pop()
      continue
    }
    stack.push(part)
  }
  return stack.join('/')
}

function dirnameOf(path: string): string {
  const normalized = normalizeVaultPath(path)
  const idx = normalized.lastIndexOf('/')
  if (idx < 0) return ''
  return normalized.slice(0, idx)
}

function leafOf(path: string): string {
  const normalized = normalizeVaultPath(path)
  const idx = normalized.lastIndexOf('/')
  if (idx < 0) return normalized
  return normalized.slice(idx + 1)
}

function joinVaultPath(parent: string, child: string): string {
  const base = normalizeVaultPath(parent)
  const relRaw = child.replace(/\\/g, '/').trim()
  if (!base) return normalizeVaultPath(relRaw)
  if (!relRaw) return base
  return normalizeVaultPath(`${base}/${relRaw}`)
}

function hasExplicitExtension(path: string): boolean {
  const leaf = leafOf(path)
  const idx = leaf.lastIndexOf('.')
  return idx > 0
}

function stripMarkdownExtension(path: string): string {
  if (path.toLowerCase().endsWith('.md')) return path.slice(0, -3)
  return path
}

function extensionVariants(path: string): string[] {
  const normalized = normalizeVaultPath(path)
  if (!normalized) return []
  if (hasExplicitExtension(normalized)) return [normalized]
  return [
    normalized,
    `${normalized}.md`,
    `${normalized}.excalidraw.md`,
    `${normalized}.excalidraw`,
  ]
}

function addLookupKey(map: Map<string, Set<string>>, key: string, path: string): void {
  const normalizedKey = normalizeVaultPath(key).toLowerCase()
  if (!normalizedKey) return
  const existing = map.get(normalizedKey)
  if (existing) {
    existing.add(path)
    return
  }
  map.set(normalizedKey, new Set([path]))
}

function buildCandidateLookup(candidatePaths: string[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const rawPath of candidatePaths) {
    const path = normalizeVaultPath(rawPath)
    if (!path) continue
    addLookupKey(map, path, path)

    const withoutMd = stripMarkdownExtension(path)
    addLookupKey(map, withoutMd, path)

    const fileName = leafOf(path)
    addLookupKey(map, fileName, path)
    addLookupKey(map, stripMarkdownExtension(fileName), path)
  }
  return map
}

function sharedPathPrefixLength(a: string, b: string): number {
  const aParts = normalizeVaultPath(a).split('/').filter(Boolean)
  const bParts = normalizeVaultPath(b).split('/').filter(Boolean)
  const len = Math.min(aParts.length, bParts.length)
  let shared = 0
  for (let i = 0; i < len; i += 1) {
    if (aParts[i].toLowerCase() !== bParts[i].toLowerCase()) break
    shared += 1
  }
  return shared
}

function chooseBestCandidate(paths: string[], currentPath: string): string {
  if (paths.length <= 1) return paths[0] ?? ''
  const currentDir = dirnameOf(currentPath)
  return [...paths].sort((a, b) => {
    const dirA = dirnameOf(a)
    const dirB = dirnameOf(b)
    const sameDirA = dirA.toLowerCase() === currentDir.toLowerCase() ? 0 : 1
    const sameDirB = dirB.toLowerCase() === currentDir.toLowerCase() ? 0 : 1
    if (sameDirA !== sameDirB) return sameDirA - sameDirB

    const sharedA = sharedPathPrefixLength(currentDir, dirA)
    const sharedB = sharedPathPrefixLength(currentDir, dirB)
    if (sharedA !== sharedB) return sharedB - sharedA

    return a.localeCompare(b)
  })[0]
}

function splitTargetAndAlias(rawInner: string): { target: string; alias: string | null } {
  const pipeIdx = rawInner.indexOf('|')
  if (pipeIdx < 0) {
    return { target: rawInner.trim(), alias: null }
  }
  const target = rawInner.slice(0, pipeIdx).trim()
  const alias = rawInner.slice(pipeIdx + 1).trim()
  return { target, alias: alias || null }
}

function fuzzySubsequenceScore(query: string, candidate: string): number {
  const q = query.trim().toLowerCase()
  const text = candidate.toLowerCase()
  if (!q) return 0
  if (!text) return -1

  let queryIdx = 0
  let score = 0
  let lastMatchIdx = -2
  for (let i = 0; i < text.length; i += 1) {
    if (queryIdx >= q.length) break
    if (text[i] !== q[queryIdx]) continue

    const prev = i > 0 ? text[i - 1] : ''
    const atBoundary = i === 0 || prev === '/' || prev === '-' || prev === '_' || prev === ' ' || prev === '.'

    score += 10
    if (atBoundary) score += 6
    if (lastMatchIdx + 1 === i) score += 4

    lastMatchIdx = i
    queryIdx += 1
  }

  if (queryIdx < q.length) return -1

  score -= Math.max(0, text.length - q.length) * 0.12
  return score
}

function normalizeWikilinkPath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\/+/g, '')
    .replace(/\/+/g, '/')
    .trim()
}

export function parseWikilinkTargetBlock(rawTarget: string): ParsedWikilinkTargetBlock {
  const raw = rawTarget.trim()
  if (!raw) {
    return {
      raw,
      path: '',
      heading: null,
      blockRef: null,
    }
  }

  const hashIdx = raw.indexOf('#')
  if (hashIdx < 0) {
    return {
      raw,
      path: normalizeWikilinkPath(raw),
      heading: null,
      blockRef: null,
    }
  }

  const pathPart = normalizeWikilinkPath(raw.slice(0, hashIdx))
  const suffix = raw.slice(hashIdx + 1).trim()
  if (!suffix) {
    return {
      raw,
      path: pathPart,
      heading: null,
      blockRef: null,
    }
  }

  if (suffix.startsWith('^')) {
    const blockRef = suffix.slice(1).trim()
    return {
      raw,
      path: pathPart,
      heading: null,
      blockRef: blockRef || null,
    }
  }

  return {
    raw,
    path: pathPart,
    heading: suffix,
    blockRef: null,
  }
}

export function splitTextByWikilinksBlock(text: string): WikilinkTextTokenBlock[] {
  if (!text) {
    return [{ kind: 'text', text: '', target: null, alias: null, embed: false }]
  }

  const output: WikilinkTextTokenBlock[] = []
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = WIKILINK_TOKEN_PATTERN.exec(text)) !== null) {
    const index = match.index
    if (index > cursor) {
      output.push({
        kind: 'text',
        text: text.slice(cursor, index),
        target: null,
        alias: null,
        embed: false,
      })
    }

    const embed = Boolean(match[1])
    const inner = match[2] ?? ''
    const { target, alias } = splitTargetAndAlias(inner)
    const raw = match[0] ?? `[[${inner}]]`

    if (!target) {
      output.push({
        kind: 'text',
        text: raw,
        target: null,
        alias: null,
        embed: false,
      })
    } else {
      output.push({
        kind: 'wikilink',
        text: raw,
        target,
        alias,
        embed,
      })
    }

    cursor = index + raw.length
  }

  if (cursor < text.length) {
    output.push({
      kind: 'text',
      text: text.slice(cursor),
      target: null,
      alias: null,
      embed: false,
    })
  }

  return output.length > 0
    ? output
    : [{ kind: 'text', text, target: null, alias: null, embed: false }]
}

export function toObsidianWikilinkTargetBlock(path: string): string {
  return stripMarkdownExtension(normalizeVaultPath(path))
}

export function buildObsidianWikilinkBlock(pathOrTarget: string, alias?: string): string {
  const target = toObsidianWikilinkTargetBlock(pathOrTarget).trim()
  if (!target) return '[[]]'
  const aliasPart = alias?.trim() ? `|${alias.trim()}` : ''
  return `[[${target}${aliasPart}]]`
}

export function deriveWikilinkLabelBlock(target: string, alias: string | null): string {
  if (alias && alias.trim()) return alias.trim()
  const parsed = parseWikilinkTargetBlock(target)
  if (parsed.path) {
    const leaf = stripMarkdownExtension(leafOf(parsed.path))
    if (parsed.heading) return `${leaf} > ${parsed.heading}`
    if (parsed.blockRef) return `${leaf} > ^${parsed.blockRef}`
    return leaf
  }
  if (parsed.heading) return parsed.heading
  if (parsed.blockRef) return `^${parsed.blockRef}`
  return target.trim()
}

export function buildThinkingSpaceWikilinkHrefBlock(target: string): string {
  return `${THINKING_SPACE_WIKILINK_PREFIX}${encodeURIComponent(target.trim())}`
}

export function isThinkingSpaceWikilinkHrefBlock(href: string | null | undefined): boolean {
  return typeof href === 'string' && href.startsWith(THINKING_SPACE_WIKILINK_PREFIX)
}

export function parseThinkingSpaceWikilinkHrefBlock(href: string): { target: string } | null {
  if (!isThinkingSpaceWikilinkHrefBlock(href)) return null
  const encoded = href.slice(THINKING_SPACE_WIKILINK_PREFIX.length)
  if (!encoded) return null
  try {
    const decoded = decodeURIComponent(encoded).trim()
    if (!decoded) return null
    return { target: decoded }
  } catch {
    return null
  }
}

export function resolveWikilinkPathBlock(
  input: ResolveWikilinkPathBlockInput,
): ResolveWikilinkPathBlockResult {
  const parsed = parseWikilinkTargetBlock(input.target)
  if (!parsed.path) {
    return {
      path: normalizeVaultPath(input.currentPath) || null,
      heading: parsed.heading,
      blockRef: parsed.blockRef,
    }
  }

  const lookup = buildCandidateLookup(input.candidatePaths)
  const currentDir = dirnameOf(input.currentPath)
  const hasRelativePrefix = parsed.path.startsWith('./') || parsed.path.startsWith('../')
  const hasSlash = parsed.path.includes('/')

  const pathQueries: string[] = []
  const appendVariants = (basePath: string) => {
    for (const variant of extensionVariants(basePath)) {
      pathQueries.push(variant.toLowerCase())
    }
  }

  if (hasRelativePrefix) {
    appendVariants(joinVaultPath(currentDir, parsed.path))
  } else if (hasSlash) {
    appendVariants(parsed.path)
    appendVariants(joinVaultPath(currentDir, parsed.path))
  } else {
    appendVariants(joinVaultPath(currentDir, parsed.path))
    appendVariants(parsed.path)
  }

  for (const query of pathQueries) {
    const matched = lookup.get(query)
    if (!matched || matched.size === 0) continue
    const selected = chooseBestCandidate([...matched], input.currentPath)
    return {
      path: selected || null,
      heading: parsed.heading,
      blockRef: parsed.blockRef,
    }
  }

  return {
    path: null,
    heading: parsed.heading,
    blockRef: parsed.blockRef,
  }
}

export function buildWikilinkSuggestionsBlock(
  input: BuildWikilinkSuggestionsBlockInput,
): WikilinkSuggestionBlock[] {
  const currentDir = dirnameOf(input.currentPath)
  const query = input.query.trim()
  const maxItems = input.limit ?? 40

  const ranked: WikilinkSuggestionBlock[] = []
  for (const rawPath of input.candidatePaths) {
    const normalizedPath = normalizeVaultPath(rawPath)
    if (!normalizedPath) continue

    const target = toObsidianWikilinkTargetBlock(normalizedPath)
    if (!target) continue

    const baseName = stripMarkdownExtension(leafOf(normalizedPath))
    const targetScore = fuzzySubsequenceScore(query, target)
    const baseScore = fuzzySubsequenceScore(query, baseName)
    const bestTextScore = query
      ? Math.max(targetScore, baseScore >= 0 ? baseScore + 2.5 : -1)
      : 0
    if (query && bestTextScore < 0) continue

    const candidateDir = dirnameOf(normalizedPath)
    const sameDirBonus = candidateDir.toLowerCase() === currentDir.toLowerCase() ? 4 : 0
    const sharedPrefixBonus = sharedPathPrefixLength(currentDir, candidateDir) * 0.55
    const score = bestTextScore + sameDirBonus + sharedPrefixBonus

    ranked.push({
      path: normalizedPath,
      target,
      score,
    })
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.target !== b.target) return a.target.localeCompare(b.target)
    return a.path.localeCompare(b.path)
  })

  return ranked.slice(0, Math.max(1, maxItems))
}
