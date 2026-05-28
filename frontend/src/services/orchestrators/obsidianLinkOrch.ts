import { buildObsidianOpenUrl } from '@/services/lego_blocks/integrations/obsidianLinkBlock'
import {
  buildWikilinkSuggestionsBlock,
  buildObsidianWikilinkBlock,
  buildThinkingSpaceWikilinkHrefBlock,
  deriveWikilinkLabelBlock,
  isThinkingSpaceWikilinkHrefBlock,
  parseWikilinkTargetBlock,
  parseThinkingSpaceWikilinkHrefBlock,
  resolveWikilinkPathBlock,
  splitTextByWikilinksBlock,
  toObsidianWikilinkTargetBlock,
  type ResolveWikilinkPathBlockResult,
  type WikilinkSuggestionBlock,
} from '@/services/lego_blocks/integrations/obsidianWikilinkBlock'
import { listMarkdownPaths } from './fileSystemOrch'
import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'

export function buildObsidianOpenUrlOrch(path: string): string {
  return buildObsidianOpenUrl(path)
}

const WIKILINK_CACHE_TTL_MS = 20_000

let wikilinkPathCache:
  | {
    expiresAt: number
    paths: string[]
  }
  | null = null

function nowMs(): number {
  return Date.now()
}

function toMdastWikilinkNodes(text: string): Array<Record<string, unknown>> {
  const tokens = splitTextByWikilinksBlock(text)
  const nodes: Array<Record<string, unknown>> = []

  for (const token of tokens) {
    if (token.kind === 'text') {
      nodes.push({ type: 'text', value: token.text })
      continue
    }

    const target = token.target
    if (!target) {
      nodes.push({ type: 'text', value: token.text })
      continue
    }

    const label = deriveWikilinkLabelBlock(target, token.alias)
    if (token.embed && isImageWikilinkTargetBlock(target)) {
      nodes.push({
        type: 'image',
        url: buildThinkingSpaceWikilinkHrefBlock(target),
        alt: label,
      })
    } else {
      nodes.push({
        type: 'link',
        url: buildThinkingSpaceWikilinkHrefBlock(target),
        children: [{ type: 'text', value: label }],
      })
    }
  }

  return nodes
}

function isImageWikilinkTargetBlock(target: string): boolean {
  const parsed = parseWikilinkTargetBlock(target)
  const normalizedPath = parsed.path.toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?|heic|heif)$/.test(normalizedPath)
}

function transformMarkdownTreeWithWikilinks(node: unknown): void {
  if (!node || typeof node !== 'object') return
  const typedNode = node as { type?: string; children?: unknown[]; value?: string }
  if (!Array.isArray(typedNode.children) || typedNode.children.length === 0) return

  if (typedNode.type === 'code' || typedNode.type === 'inlineCode' || typedNode.type === 'link') return

  for (let i = 0; i < typedNode.children.length; i += 1) {
    const child = typedNode.children[i]
    if (!child || typeof child !== 'object') continue
    const typedChild = child as { type?: string; value?: string }

    if (typedChild.type === 'text' && typeof typedChild.value === 'string') {
      const replaced = toMdastWikilinkNodes(typedChild.value)
      const unchanged = replaced.length === 1
        && replaced[0]?.type === 'text'
        && replaced[0]?.value === typedChild.value
      if (!unchanged) {
        typedNode.children.splice(i, 1, ...replaced)
        i += replaced.length - 1
      }
      continue
    }

    transformMarkdownTreeWithWikilinks(child)
  }
}

async function getCachedMarkdownPaths(): Promise<string[]> {
  const cache = wikilinkPathCache
  if (cache && cache.expiresAt > nowMs()) return cache.paths

  return refreshMarkdownPathCache()
}

async function refreshMarkdownPathCache(): Promise<string[]> {
  const nextPaths = await listMarkdownPaths()
  wikilinkPathCache = {
    paths: nextPaths,
    expiresAt: nowMs() + WIKILINK_CACHE_TTL_MS,
  }
  return nextPaths
}

export function invalidateWikilinkPathCacheOrch(): void {
  wikilinkPathCache = null
}

export function remarkObsidianWikilinksOrch() {
  return (tree: unknown) => {
    transformMarkdownTreeWithWikilinks(tree)
  }
}

export function toObsidianWikilinkTargetOrch(path: string): string {
  return toObsidianWikilinkTargetBlock(path)
}

export function buildObsidianWikilinkOrch(pathOrTarget: string, alias?: string): string {
  return buildObsidianWikilinkBlock(pathOrTarget, alias)
}

export function isThinkingSpaceWikilinkHrefOrch(href: string | null | undefined): boolean {
  return isThinkingSpaceWikilinkHrefBlock(href)
}

export function parseThinkingSpaceWikilinkHrefOrch(href: string): { target: string } | null {
  return parseThinkingSpaceWikilinkHrefBlock(href)
}

export async function resolveWikilinkTargetOrch(input: {
  currentPath: string
  target: string
  candidatePaths?: string[]
}): Promise<ResolveWikilinkPathBlockResult> {
  const candidatePaths = input.candidatePaths ?? await getCachedMarkdownPaths()
  const initialResult = resolveWikilinkPathBlock({
    currentPath: input.currentPath,
    target: input.target,
    candidatePaths,
  })
  if (initialResult.path || input.candidatePaths) return initialResult

  const refreshedPaths = await refreshMarkdownPathCache()
  return resolveWikilinkPathBlock({
    currentPath: input.currentPath,
    target: input.target,
    candidatePaths: refreshedPaths,
  })
}

function normalizeAssetCandidatePathBlock(path: string): string {
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

function dirnameAssetCandidatePathBlock(path: string): string {
  const normalized = normalizeAssetCandidatePathBlock(path)
  const idx = normalized.lastIndexOf('/')
  if (idx < 0) return ''
  return normalized.slice(0, idx)
}

function joinAssetCandidatePathBlock(parent: string, child: string): string {
  const base = normalizeAssetCandidatePathBlock(parent)
  const rel = child.replace(/\\/g, '/').trim()
  if (!base) return normalizeAssetCandidatePathBlock(rel)
  if (!rel) return base
  return normalizeAssetCandidatePathBlock(`${base}/${rel}`)
}

export async function resolveWikilinkAssetTargetOrch(input: {
  currentPath: string
  target: string
}): Promise<string | null> {
  const parsed = parseWikilinkTargetBlock(input.target)
  const rawPath = parsed.path.trim()
  if (!rawPath) return null
  const normalizedRawPath = rawPath.replace(/\\/g, '/')
  const currentDir = dirnameAssetCandidatePathBlock(input.currentPath)
  const fs = getVaultFS()

  const candidates = new Set<string>()
  if (normalizedRawPath.startsWith('/')) {
    candidates.add(normalizeAssetCandidatePathBlock(normalizedRawPath.slice(1)))
  } else {
    candidates.add(joinAssetCandidatePathBlock(currentDir, normalizedRawPath))
    candidates.add(normalizeAssetCandidatePathBlock(normalizedRawPath))
  }

  for (const candidate of candidates) {
    if (!candidate) continue
    if (await fs.exists(candidate)) return candidate
  }
  return null
}

export async function getWikilinkSuggestionsOrch(input: {
  currentPath: string
  query: string
  limit?: number
  candidatePaths?: string[]
}): Promise<WikilinkSuggestionBlock[]> {
  const candidatePaths = input.candidatePaths ?? await getCachedMarkdownPaths()
  const initialSuggestions = buildWikilinkSuggestionsBlock({
    currentPath: input.currentPath,
    query: input.query,
    candidatePaths,
    limit: input.limit,
  })
  if (initialSuggestions.length > 0 || input.candidatePaths) return initialSuggestions

  const refreshedPaths = await refreshMarkdownPathCache()
  return buildWikilinkSuggestionsBlock({
    currentPath: input.currentPath,
    query: input.query,
    candidatePaths: refreshedPaths,
    limit: input.limit,
  })
}
