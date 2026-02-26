import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import type { NodeType } from '@/services/lego_blocks/units/yamlNoteBlock'

export type SimilarityEngine = 'lexical-v1'

export interface SimilarityQuery {
  text: string
  sourceFilePath?: string
  excludeNodeUuid?: string
  preferredTypes?: NodeType[]
  limit?: number
}

export interface SimilarityMatch {
  node: NodeRecord
  score: number
  normalizedScore: number
  reasons: string[]
  engine: SimilarityEngine
}

export interface SimilarityProviderBlock {
  engine: SimilarityEngine
  findSimilar(nodes: NodeRecord[], query: SimilarityQuery): SimilarityMatch[]
}

const MIN_TOKEN_LENGTH = 3
const DEFAULT_LIMIT = 24

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'into', 'about', 'your', 'have', 'been',
  'are', 'was', 'were', 'will', 'would', 'could', 'should', 'not', 'but', 'just', 'than', 'then',
  'also', 'only', 'more', 'most', 'very', 'some', 'such', 'what', 'when', 'where', 'why', 'how',
  'can', 'you', 'they', 'them', 'their', 'there', 'here', 'its', 'our', 'out', 'over', 'under',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9/_\s.-]+/g, ' ')
    .split(/[\s./_-]+/)
    .map(token => token.trim())
    .filter(token => token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token))
}

function uniqueTokens(text: string): string[] {
  return [...new Set(tokenize(text))]
}

function jaccardOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const left = new Set(a)
  const right = new Set(b)
  let intersection = 0
  for (const token of left) {
    if (right.has(token)) intersection += 1
  }
  const union = left.size + right.size - intersection
  if (union <= 0) return 0
  return intersection / union
}

function scoreNodeLexical(node: NodeRecord, queryTokens: string[], sourcePathTokens: string[], preferredTypes: Set<NodeType>): {
  score: number
  reasons: string[]
} {
  const title = node.title.toLowerCase()
  const key = node.key.toLowerCase()
  const tags = (node.tags ?? []).join(' ').toLowerCase()
  const description = (node.description ?? '').toLowerCase()
  const aiSummary = (node.aiSummary ?? '').toLowerCase()
  const body = (node.bodyExcerpt ?? '').toLowerCase()
  const metadata = (node.metadataText ?? '').toLowerCase()
  const filePath = node.filePath.toLowerCase()

  let score = 0
  const reasons: string[] = []
  let titleHits = 0
  let taxonomyHits = 0
  let contextHits = 0

  for (const token of queryTokens) {
    if (title.includes(token)) {
      score += 6
      titleHits += 1
    }
    if (key.includes(token)) {
      score += 5
      taxonomyHits += 1
    }
    if (tags.includes(token)) {
      score += 4
      taxonomyHits += 1
    }
    if (description.includes(token) || aiSummary.includes(token)) {
      score += 3
      contextHits += 1
    }
    if (body.includes(token) || metadata.includes(token)) {
      score += 1.5
      contextHits += 1
    }
    if (filePath.includes(token)) {
      score += 1
    }
  }

  if (titleHits > 0) reasons.push('title_overlap')
  if (taxonomyHits > 0) reasons.push('key_tags_overlap')
  if (contextHits > 0) reasons.push('content_overlap')

  if (sourcePathTokens.length > 0) {
    const nodePathTokens = uniqueTokens(node.filePath)
    const overlap = jaccardOverlap(sourcePathTokens, nodePathTokens)
    if (overlap > 0) {
      score += overlap * 4
      reasons.push('path_proximity')
    }
  }

  const hasCoreMatch = score > 0
  if (hasCoreMatch && preferredTypes.size > 0 && preferredTypes.has(node.type)) {
    score += 1.5
    reasons.push('type_preference')
  }

  if (hasCoreMatch && node.status === 'active') score += 0.25

  return {
    score,
    reasons,
  }
}

function lexicalProviderBlock(): SimilarityProviderBlock {
  return {
    engine: 'lexical-v1',
    findSimilar(nodes: NodeRecord[], query: SimilarityQuery): SimilarityMatch[] {
      const trimmed = query.text.trim()
      if (!trimmed) return []

      const queryTokens = uniqueTokens(trimmed)
      if (queryTokens.length === 0) return []

      const sourcePathTokens = uniqueTokens(query.sourceFilePath ?? '')
      const preferredTypes = new Set(query.preferredTypes ?? [])
      const limit = Number.isFinite(query.limit) && (query.limit ?? 0) > 0
        ? Math.min(Math.max(1, Math.floor(query.limit!)), 200)
        : DEFAULT_LIMIT

      const matches: SimilarityMatch[] = []
      const maxBase = queryTokens.length * 14 + 6

      for (const node of nodes) {
        if (query.excludeNodeUuid && node.uuid === query.excludeNodeUuid) continue
        const { score, reasons } = scoreNodeLexical(node, queryTokens, sourcePathTokens, preferredTypes)
        if (score <= 0) continue
        matches.push({
          node,
          score,
          normalizedScore: Math.min(1, score / maxBase),
          reasons: [...new Set(reasons)],
          engine: 'lexical-v1',
        })
      }

      return matches
        .sort((a, b) => (
          b.score - a.score
          || b.node.updatedAt.localeCompare(a.node.updatedAt)
          || a.node.title.localeCompare(b.node.title)
        ))
        .slice(0, limit)
    },
  }
}

function resolveProvider(engine?: SimilarityEngine): SimilarityProviderBlock {
  if (!engine || engine === 'lexical-v1') return lexicalProviderBlock()
  return lexicalProviderBlock()
}

export function findSimilarNodesBlock(
  nodes: NodeRecord[],
  query: SimilarityQuery,
  engine?: SimilarityEngine,
): SimilarityMatch[] {
  const provider = resolveProvider(engine)
  return provider.findSimilar(nodes, query)
}
