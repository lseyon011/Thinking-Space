export interface RankedFuzzyItemBlock<T> {
  item: T
  score: number
  matchedText: string
}

export interface RankFuzzyItemsBlockInput<T> {
  items: T[]
  query: string
  getCandidates: (item: T) => string | string[]
  limit?: number
}

function normalizeSearchText(text: string): string {
  return text.trim().toLowerCase()
}

function toCandidateList(value: string | string[]): string[] {
  if (Array.isArray(value)) return value.filter(Boolean)
  return value ? [value] : []
}

function scoreSubsequenceToken(token: string, candidate: string): number {
  if (!token) return 0
  if (!candidate) return -1

  let tokenIdx = 0
  let score = 0
  let lastMatchIdx = -2
  for (let i = 0; i < candidate.length; i += 1) {
    if (tokenIdx >= token.length) break
    if (candidate[i] !== token[tokenIdx]) continue

    const prev = i > 0 ? candidate[i - 1] : ''
    const atBoundary = i === 0 || prev === '/' || prev === '-' || prev === '_' || prev === ' ' || prev === '.'

    score += 10
    if (atBoundary) score += 6
    if (lastMatchIdx + 1 === i) score += 4

    lastMatchIdx = i
    tokenIdx += 1
  }

  if (tokenIdx < token.length) return -1
  score -= Math.max(0, candidate.length - token.length) * 0.12
  return score
}

export function fuzzyMatchScoreBlock(query: string, candidate: string): number {
  const normalizedQuery = normalizeSearchText(query)
  const normalizedCandidate = normalizeSearchText(candidate)
  if (!normalizedQuery) return 0
  if (!normalizedCandidate) return -1

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0

  let score = 0
  for (const token of tokens) {
    const tokenScore = scoreSubsequenceToken(token, normalizedCandidate)
    if (tokenScore < 0) return -1
    score += tokenScore
    if (normalizedCandidate.includes(token)) score += 8
    if (normalizedCandidate.startsWith(token)) score += 6
  }

  if (normalizedCandidate.includes(normalizedQuery)) score += 14
  if (normalizedCandidate.startsWith(normalizedQuery)) score += 8
  return score
}

export function rankFuzzyItemsBlock<T>(
  input: RankFuzzyItemsBlockInput<T>,
): RankedFuzzyItemBlock<T>[] {
  const query = normalizeSearchText(input.query)
  const ranked: RankedFuzzyItemBlock<T>[] = []

  for (const item of input.items) {
    const candidates = toCandidateList(input.getCandidates(item))
    if (candidates.length === 0) continue

    if (!query) {
      ranked.push({ item, score: 0, matchedText: candidates[0] })
      continue
    }

    let bestScore = -1
    let bestText = ''
    for (const candidate of candidates) {
      const score = fuzzyMatchScoreBlock(query, candidate)
      if (score > bestScore) {
        bestScore = score
        bestText = candidate
      }
    }

    if (bestScore < 0) continue
    ranked.push({ item, score: bestScore, matchedText: bestText })
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.matchedText !== b.matchedText) return a.matchedText.localeCompare(b.matchedText)
    return 0
  })

  const limit = input.limit ?? ranked.length
  return ranked.slice(0, Math.max(1, limit))
}
