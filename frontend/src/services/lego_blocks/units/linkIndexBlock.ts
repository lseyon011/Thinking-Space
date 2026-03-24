// Link index block — extracts links (wikilinks, markdown links, YAML path scalars)
// from markdown content for building a backlink index in IndexedDB.
// Pure logic, no DB or FS dependencies.

import {
  splitTextByWikilinksBlock,
  parseWikilinkTargetBlock,
  resolveWikilinkPathBlock,
} from '@/services/lego_blocks/integrations/obsidianWikilinkBlock'

// ── Types ──

export type LinkType = 'wikilink' | 'markdown' | 'yaml'

export interface ExtractedLink {
  targetFilePath: string
  linkType: LinkType
  rawText: string
}

// ── Frontmatter helpers (extracted from fileSystemOrch for reuse) ──

export function splitFrontmatterDocumentBlock(content: string): { frontmatter: string; body: string } {
  const openMatch = content.match(/^---(\r?\n)/)
  if (!openMatch) return { frontmatter: '', body: content }

  const lineBreak = openMatch[1]
  const start = openMatch[0].length
  const closeToken = `${lineBreak}---`
  const closeIndex = content.indexOf(closeToken, start)
  if (closeIndex < 0) return { frontmatter: '', body: content }

  let frontmatterEnd = closeIndex + closeToken.length
  if (content.startsWith(lineBreak, frontmatterEnd)) {
    frontmatterEnd += lineBreak.length
  }
  return {
    frontmatter: content.slice(0, frontmatterEnd),
    body: content.slice(frontmatterEnd),
  }
}

export function isLikelyYamlPathScalarBlock(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(trimmed)) return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return false
  if (trimmed.startsWith('|') || trimmed.startsWith('>')) return false
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return false
  if (trimmed.startsWith('&') || trimmed.startsWith('*') || trimmed.startsWith('!')) return false
  if (trimmed.includes('[[') || trimmed.includes('](') || trimmed.includes('{{')) return false

  return (
    trimmed.startsWith('./')
    || trimmed.startsWith('../')
    || trimmed.startsWith('/')
    || trimmed.includes('/')
    || /\.[A-Za-z0-9]{1,8}$/i.test(trimmed)
  )
}

export function findYamlCommentStartIndexBlock(value: string): number {
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i]
    if (ch === '\'' && !inDouble) {
      const next = value[i + 1]
      if (inSingle && next === '\'') {
        i += 1
        continue
      }
      inSingle = !inSingle
      continue
    }
    if (ch === '"' && !inSingle) {
      const prev = value[i - 1]
      if (prev !== '\\') inDouble = !inDouble
      continue
    }
    if (ch === '#' && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(value[i - 1] ?? '')) return i
    }
  }

  return -1
}

// ── Link extraction ──

function hasUriScheme(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
}

function normalizeLinkPath(path: string): string {
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

function dirnameLinkPath(path: string): string {
  const normalized = normalizeLinkPath(path)
  const idx = normalized.lastIndexOf('/')
  if (idx < 0) return ''
  return normalized.slice(0, idx)
}

function joinLinkPath(parent: string, child: string): string {
  const base = normalizeLinkPath(parent)
  const relRaw = child.replace(/\\/g, '/').trim()
  if (!base) return normalizeLinkPath(relRaw)
  if (!relRaw) return base
  return normalizeLinkPath(`${base}/${relRaw}`)
}

function isSameOrChildPath(path: string, maybeParent: string): boolean {
  if (!path || !maybeParent) return false
  return path === maybeParent || path.startsWith(`${maybeParent}/`)
}

function extractWikilinks(
  content: string,
  filePath: string,
  candidatePaths: string[],
): ExtractedLink[] {
  const links: ExtractedLink[] = []
  const tokens = splitTextByWikilinksBlock(content)
  const normalizedFilePath = normalizeLinkPath(filePath)

  for (const token of tokens) {
    if (token.kind !== 'wikilink' || !token.target) continue
    const parsed = parseWikilinkTargetBlock(token.target)
    if (!parsed.path) continue

    const resolved = resolveWikilinkPathBlock({
      currentPath: normalizedFilePath,
      target: token.target,
      candidatePaths,
    })
    if (!resolved.path) continue

    links.push({
      targetFilePath: resolved.path,
      linkType: 'wikilink',
      rawText: token.text,
    })
  }

  return links
}

const MARKDOWN_LINK_PATTERN = /(!?)\[([^\]]*?)\]\(([^)\n]+)\)/g

function extractMarkdownLinks(
  content: string,
  filePath: string,
): ExtractedLink[] {
  const links: ExtractedLink[] = []
  const normalizedFilePath = normalizeLinkPath(filePath)
  const currentDir = dirnameLinkPath(normalizedFilePath)

  let match: RegExpExecArray | null
  while ((match = MARKDOWN_LINK_PATTERN.exec(content)) !== null) {
    const rawDestination = (match[3] ?? '').trim()
    if (!rawDestination) continue

    const wrapped = rawDestination.startsWith('<') && rawDestination.endsWith('>')
    const unwrapped = wrapped ? rawDestination.slice(1, -1).trim() : rawDestination
    const destMatch = /^(\S+)([\s\S]*)$/.exec(unwrapped)
    if (!destMatch) continue

    const linkPathWithSuffix = destMatch[1] ?? ''
    if (!linkPathWithSuffix || linkPathWithSuffix.startsWith('#') || hasUriScheme(linkPathWithSuffix)) {
      continue
    }

    const hashIdx = linkPathWithSuffix.indexOf('#')
    const pathPart = (hashIdx >= 0 ? linkPathWithSuffix.slice(0, hashIdx) : linkPathWithSuffix).trim()
    if (!pathPart) continue

    const absolutePath = pathPart.startsWith('/')
      ? normalizeLinkPath(pathPart.slice(1))
      : normalizeLinkPath(joinLinkPath(currentDir, pathPart))
    if (!absolutePath) continue

    links.push({
      targetFilePath: absolutePath,
      linkType: 'markdown',
      rawText: match[0],
    })
  }

  return links
}

function extractYamlPathScalars(
  content: string,
  filePath: string,
  candidatePaths: string[],
): ExtractedLink[] {
  const { frontmatter } = splitFrontmatterDocumentBlock(content)
  if (!frontmatter) return []

  const links: ExtractedLink[] = []
  const normalizedFilePath = normalizeLinkPath(filePath)
  const currentDir = dirnameLinkPath(normalizedFilePath)
  const lines = frontmatter.split(/\r?\n/)
  if (lines.length < 3 || lines[0] !== '---') return []

  const closeIndex = lines.findIndex((line, index) => index > 0 && line === '---')
  if (closeIndex < 0) return []

  for (let i = 1; i < closeIndex; i += 1) {
    const line = lines[i]
    if (!line || /^\s*#/.test(line)) continue

    const mappingMatch = /^(\s*[^:#\n][^:\n]*:\s*)(.+)$/.exec(line)
    const listMatch = mappingMatch ? null : /^(\s*-\s+)(.+)$/.exec(line)
    const valuePart = mappingMatch?.[2] ?? listMatch?.[2]
    if (!valuePart) continue
    if (valuePart.trimStart().startsWith('|') || valuePart.trimStart().startsWith('>')) continue
    if (/^[^"'#\s][^:]*:\s+/.test(valuePart.trimStart())) continue

    const trimmedValue = valuePart.trimStart()
    const commentStart = findYamlCommentStartIndexBlock(trimmedValue)
    const scalarSegment = (commentStart >= 0 ? trimmedValue.slice(0, commentStart) : trimmedValue).trimEnd()
    if (!scalarSegment) continue

    const quote = (scalarSegment.startsWith('"') && scalarSegment.endsWith('"'))
      ? '"'
      : (scalarSegment.startsWith('\'') && scalarSegment.endsWith('\''))
        ? '\''
        : ''
    const unquoted = quote ? scalarSegment.slice(1, -1) : scalarSegment
    if (!isLikelyYamlPathScalarBlock(unquoted)) continue
    if (unquoted.startsWith('#') || hasUriScheme(unquoted)) continue

    // Resolve to absolute path
    const resolved = resolveWikilinkPathBlock({
      currentPath: normalizedFilePath,
      target: unquoted,
      candidatePaths,
    }).path

    if (resolved) {
      links.push({
        targetFilePath: resolved,
        linkType: 'yaml',
        rawText: scalarSegment,
      })
      continue
    }

    // Fallback: manual resolution for path-like values
    let absolutePath: string | null = null
    if (unquoted.startsWith('/')) {
      absolutePath = normalizeLinkPath(unquoted.slice(1))
    } else if (unquoted.startsWith('./') || unquoted.startsWith('../')) {
      absolutePath = joinLinkPath(currentDir, unquoted)
    } else if (unquoted.includes('/')) {
      absolutePath = normalizeLinkPath(unquoted)
    }

    if (absolutePath && candidatePaths.some(cp => isSameOrChildPath(normalizeLinkPath(cp), absolutePath!))) {
      links.push({
        targetFilePath: absolutePath,
        linkType: 'yaml',
        rawText: scalarSegment,
      })
    }
  }

  return links
}

/**
 * Extract all links (wikilinks, markdown links, YAML path scalars) from markdown content.
 * Returns resolved absolute vault-relative paths for each link found.
 */
export function extractLinksFromContentBlock(
  content: string,
  filePath: string,
  candidatePaths: string[],
): ExtractedLink[] {
  const wikilinks = extractWikilinks(content, filePath, candidatePaths)
  const markdownLinks = extractMarkdownLinks(content, filePath)
  const yamlLinks = extractYamlPathScalars(content, filePath, candidatePaths)
  return [...wikilinks, ...markdownLinks, ...yamlLinks]
}
