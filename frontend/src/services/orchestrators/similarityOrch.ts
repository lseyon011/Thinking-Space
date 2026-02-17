import { getAllNodes } from '../lego_blocks/dbBlock'
import { findSimilarNodesBlock, type SimilarityEngine, type SimilarityMatch, type SimilarityQuery } from '../lego_blocks/similarityBlock'
import type { NodeType } from '../lego_blocks/yamlNoteBlock'

export type { SimilarityEngine, SimilarityMatch, SimilarityQuery }

export interface FindSimilarNodesInput {
  text: string
  sourceFilePath?: string
  excludeNodeUuid?: string
  preferredTypes?: NodeType[]
  limit?: number
  engine?: SimilarityEngine
}

export interface SimilarityGroupedMatches {
  engine: SimilarityEngine
  epics: SimilarityMatch[]
  ideas: SimilarityMatch[]
  thoughts: SimilarityMatch[]
}

export async function findSimilarNodesOrch(input: FindSimilarNodesInput): Promise<SimilarityMatch[]> {
  const nodes = await getAllNodes()
  return findSimilarNodesBlock(nodes, {
    text: input.text,
    sourceFilePath: input.sourceFilePath,
    excludeNodeUuid: input.excludeNodeUuid,
    preferredTypes: input.preferredTypes,
    limit: input.limit,
  }, input.engine)
}

export async function findSimilarGroupedMatchesOrch(input: FindSimilarNodesInput & {
  perTypeLimit?: number
}): Promise<SimilarityGroupedMatches> {
  const engine: SimilarityEngine = input.engine ?? 'lexical-v1'
  const perTypeLimit = Number.isFinite(input.perTypeLimit) && (input.perTypeLimit ?? 0) > 0
    ? Math.min(Math.max(1, Math.floor(input.perTypeLimit!)), 50)
    : 8

  const matches = await findSimilarNodesOrch({
    ...input,
    limit: input.limit ?? 120,
    engine,
  })

  const epics = matches.filter(match => match.node.type === 'epic').slice(0, perTypeLimit)
  const ideas = matches.filter(match => match.node.type === 'idea').slice(0, perTypeLimit)
  const thoughts = matches.filter(match => match.node.type === 'thought').slice(0, perTypeLimit)

  return {
    engine,
    epics,
    ideas,
    thoughts,
  }
}
