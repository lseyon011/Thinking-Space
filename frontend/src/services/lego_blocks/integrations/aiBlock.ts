import { sendChatBlock } from '@/services/lego_blocks/integrations/aiChatBlock'
import {
  AI_PROVIDER_ORDER,
  defaultProviderModelBlock,
  listProvidersBlock,
  type AiProvider,
} from '@/services/lego_blocks/integrations/aiProviderBlock'
import { getAllNodes } from '@/services/lego_blocks/integrations/dbBlock'
import { findSimilarNodesBlock, type SimilarityEngine, type SimilarityMatch } from '@/services/lego_blocks/integrations/similarityBlock'
import type { NodeType } from '@/services/lego_blocks/units/yamlNoteBlock'

export type { SimilarityMatch }

export interface FindRelatedInput {
  text: string
  sourceFilePath?: string
  excludeNodeUuid?: string
  preferredTypes?: NodeType[]
  limit?: number
  engine?: SimilarityEngine
}

export interface AiTextActionInput {
  content: string
  provider?: AiProvider
  model?: string
}

export interface AiTextActionResult {
  content: string
  provider: AiProvider
  model: string
}

const DEFAULT_RELATED_LIMIT = 8
const MAX_TEXT_LENGTH = 12_000

function normalizeText(content: string): string {
  return content.replace(/\r\n/g, '\n').trim()
}

function toCleanAssistantText(content: string): string {
  const trimmed = content.trim()
  const fenced = trimmed.match(/^```(?:markdown|md|text)?\s*([\s\S]*?)\s*```$/i)
  return (fenced ? fenced[1] : trimmed).trim()
}

async function resolveSelection(input: AiTextActionInput): Promise<{ provider: AiProvider; model: string }> {
  if (input.provider) {
    return {
      provider: input.provider,
      model: input.model?.trim() || defaultProviderModelBlock(input.provider),
    }
  }

  const providers = await listProvidersBlock()
  for (const provider of AI_PROVIDER_ORDER) {
    const status = providers.find(item => item.provider === provider)
    if (!status?.available) continue
    return {
      provider,
      model: input.model?.trim() || status.model || defaultProviderModelBlock(provider),
    }
  }

  throw new Error('No AI provider available. Configure one in AI Settings.')
}

async function runTextAction(
  input: AiTextActionInput,
  promptBuilder: (content: string) => string,
): Promise<AiTextActionResult> {
  const content = normalizeText(input.content)
  if (!content) throw new Error('Content is required.')

  const selection = await resolveSelection(input)
  const prompt = promptBuilder(content.slice(0, MAX_TEXT_LENGTH))
  const response = await sendChatBlock(
    selection.provider,
    [{ role: 'user', content: prompt }],
    { model: selection.model },
  )

  return {
    content: toCleanAssistantText(response.content),
    provider: response.provider,
    model: response.model || selection.model,
  }
}

function summarizePrompt(content: string): string {
  return [
    'Summarize the following markdown content.',
    'Rules:',
    '- Preserve factual meaning.',
    '- Return concise markdown bullet points only.',
    '- Do not include any preamble.',
    '',
    '<content>',
    content,
    '</content>',
  ].join('\n')
}

function cleanupPrompt(content: string): string {
  return [
    'Clean up the following markdown content for grammar, clarity, and structure.',
    'Rules:',
    '- Preserve meaning and factual details.',
    '- Keep markdown formatting intact.',
    '- Return only the cleaned markdown content.',
    '',
    '<content>',
    content,
    '</content>',
  ].join('\n')
}

export async function findRelated(input: FindRelatedInput): Promise<SimilarityMatch[]> {
  const text = normalizeText(input.text)
  if (!text) return []

  const nodes = await getAllNodes()
  const limit = Number.isFinite(input.limit) && (input.limit ?? 0) > 0
    ? Math.min(Math.max(1, Math.floor(input.limit!)), 50)
    : DEFAULT_RELATED_LIMIT

  return findSimilarNodesBlock(nodes, {
    text,
    sourceFilePath: input.sourceFilePath,
    excludeNodeUuid: input.excludeNodeUuid,
    preferredTypes: input.preferredTypes ?? ['thought'],
    limit,
  }, input.engine ?? 'lexical-v1')
}

export async function summarize(input: AiTextActionInput): Promise<AiTextActionResult> {
  return runTextAction(input, summarizePrompt)
}

export async function cleanup(input: AiTextActionInput): Promise<AiTextActionResult> {
  return runTextAction(input, cleanupPrompt)
}
