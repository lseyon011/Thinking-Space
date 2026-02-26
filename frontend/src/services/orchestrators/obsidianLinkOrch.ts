import { buildObsidianOpenUrl } from '@/services/lego_blocks/integrations/obsidianLinkBlock'
import {
  buildWikilinkSuggestionsBlock,
  buildObsidianWikilinkBlock,
  buildThinkingSpaceWikilinkHrefBlock,
  deriveWikilinkLabelBlock,
  isThinkingSpaceWikilinkHrefBlock,
  parseThinkingSpaceWikilinkHrefBlock,
  resolveWikilinkPathBlock,
  splitTextByWikilinksBlock,
  toObsidianWikilinkTargetBlock,
  type ResolveWikilinkPathBlockResult,
  type WikilinkSuggestionBlock,
} from '@/services/lego_blocks/integrations/obsidianWikilinkBlock'
import { listMarkdownEntries } from './fileSystemOrch'

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
    const prefix = token.embed ? '!' : ''
    nodes.push({
      type: 'link',
      url: buildThinkingSpaceWikilinkHrefBlock(target),
      children: [{ type: 'text', value: `${prefix}${label}` }],
    })
  }

  return nodes
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
  const entries = await listMarkdownEntries()
  const nextPaths = entries.map((entry) => entry.path)
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
