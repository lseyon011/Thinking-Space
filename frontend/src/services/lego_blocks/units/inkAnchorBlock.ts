/* Resolve each stroke's stored anchor (block text + neighbor-context hash)
   to a block index in the current document. Strategy:
     1. exact text + matching neighbor-context  →  unambiguous re-anchor
     2. exact text only, single match           →  re-anchor
     3. exact text, multiple matches            →  pick by best context hash
     4. fuzzy text (trigram overlap)            →  re-anchor + bump anchorText
     5. nothing close enough                    →  orphan
   Block-grain (paragraph/heading/list), not line-grain — matches the
   ruled notebook's pagination model. */

import { hashAnchorContextBlock, type InkStroke } from './inkStrokeBlock'

const FUZZY_MIN_SCORE = 0.55

export interface InkAnchorBlockInput {
  /* Source text of each markdown block, in document order. */
  blockTexts: string[]
}

export interface InkAnchorResolution {
  strokeId: string
  /* null when orphaned. */
  blockIndex: number | null
  /* If a fuzzy match was used, the new anchorText to persist next save. */
  updatedAnchorText?: string
  /* If neighbors shifted, the new context hash to persist. */
  updatedAnchorContext?: string
  kind: 'exact-context' | 'exact-unique' | 'exact-disambiguated' | 'fuzzy' | 'orphan'
}

function contextHashForBlock(blockTexts: string[], index: number): string {
  return hashAnchorContextBlock([
    blockTexts[index - 1] ?? '',
    blockTexts[index] ?? '',
    blockTexts[index + 1] ?? '',
  ])
}

function trigramsBlock(input: string): Set<string> {
  const padded = `  ${input.toLowerCase().replace(/\s+/g, ' ').trim()}  `
  const out = new Set<string>()
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3))
  return out
}

export function trigramSimilarityBlock(a: string, b: string): number {
  if (!a || !b) return 0
  const sa = trigramsBlock(a)
  const sb = trigramsBlock(b)
  if (sa.size === 0 || sb.size === 0) return 0
  let intersect = 0
  for (const t of sa) if (sb.has(t)) intersect++
  /* Max(Jaccard, containment-in-smaller). Containment catches the common
     case where the user added a few words to a block — anchor text becomes
     a subset of the new block text and pure Jaccard underrates it. */
  const jaccard = intersect / (sa.size + sb.size - intersect)
  const containment = intersect / Math.min(sa.size, sb.size)
  return Math.max(jaccard, containment)
}

export function resolveInkAnchorsBlock(
  strokes: InkStroke[],
  input: InkAnchorBlockInput,
): InkAnchorResolution[] {
  const { blockTexts } = input
  const textToIndices = new Map<string, number[]>()
  blockTexts.forEach((text, idx) => {
    const list = textToIndices.get(text)
    if (list) list.push(idx)
    else textToIndices.set(text, [idx])
  })

  return strokes.map<InkAnchorResolution>((stroke) => {
    const exactMatches = textToIndices.get(stroke.anchorText)

    if (exactMatches && exactMatches.length === 1) {
      const idx = exactMatches[0]
      const ctx = contextHashForBlock(blockTexts, idx)
      if (ctx === stroke.anchorContext) {
        return { strokeId: stroke.id, blockIndex: idx, kind: 'exact-context' }
      }
      return {
        strokeId: stroke.id,
        blockIndex: idx,
        kind: 'exact-unique',
        updatedAnchorContext: ctx,
      }
    }

    if (exactMatches && exactMatches.length > 1) {
      const withCtx = exactMatches.find(
        (idx) => contextHashForBlock(blockTexts, idx) === stroke.anchorContext,
      )
      if (withCtx !== undefined) {
        return { strokeId: stroke.id, blockIndex: withCtx, kind: 'exact-disambiguated' }
      }
      /* Context hash didn't match any duplicate — pick the first occurrence
         and refresh the context hash; user can re-anchor from the orphan UI
         if it's wrong. */
      const idx = exactMatches[0]
      return {
        strokeId: stroke.id,
        blockIndex: idx,
        kind: 'exact-unique',
        updatedAnchorContext: contextHashForBlock(blockTexts, idx),
      }
    }

    /* No exact text match — fuzzy. Score every block, pick the best if
       above threshold. Linear over blocks; fine for typical notebook sizes. */
    let bestIdx = -1
    let bestScore = 0
    for (let i = 0; i < blockTexts.length; i++) {
      const score = trigramSimilarityBlock(stroke.anchorText, blockTexts[i])
      if (score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    }
    if (bestIdx >= 0 && bestScore >= FUZZY_MIN_SCORE) {
      return {
        strokeId: stroke.id,
        blockIndex: bestIdx,
        kind: 'fuzzy',
        updatedAnchorText: blockTexts[bestIdx],
        updatedAnchorContext: contextHashForBlock(blockTexts, bestIdx),
      }
    }

    return { strokeId: stroke.id, blockIndex: null, kind: 'orphan' }
  })
}

/* Convenience: rebuild the anchor metadata for a single stroke given its
   resolved block index. Used at draw time when the user lays down a new
   stroke on a known block. */
export function buildAnchorForBlockIndex(
  blockTexts: string[],
  blockIndex: number,
): Pick<InkStroke, 'anchorText' | 'anchorContext'> {
  return {
    anchorText: blockTexts[blockIndex] ?? '',
    anchorContext: contextHashForBlock(blockTexts, blockIndex),
  }
}
