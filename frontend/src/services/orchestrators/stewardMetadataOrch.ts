import { createNote, parseNote, stringifyNote } from '../lego_blocks/yamlNoteBlock'
import { getVaultFS } from './runtimeOrch'
import { syncSingleFile } from './vaultSyncOrch'
import { sendChatWithTelemetryOrch, type AiProvider } from './chatOrch'
import { recordAiTelemetryOrch, type AiTelemetryEvent } from './aiTelemetryOrch'
import { findSimilarGroupedMatchesOrch, type SimilarityGroupedMatches } from './similarityOrch'
import { resolveAiSelectionOrch } from './aiSettingsOrch'

export interface StewardMetadataSuggestion {
  summary: string
  tags: string[]
  suggestedEpicKey?: string
  suggestedIdeaKey?: string
  rationale: string
  provider?: AiProvider
  model?: string
  usedAi: boolean
  telemetry?: AiTelemetryEvent
  similarity?: StewardSimilaritySnapshot
}

interface RankedCandidate {
  key: string
  title: string
  parent?: string
  score: number
}

export interface StewardSimilarityMatch {
  key: string
  title: string
  parent?: string
  type: 'epic' | 'idea' | 'thought'
  score: number
  reasons: string[]
}

export interface StewardSimilaritySnapshot {
  engine: string
  epics: StewardSimilarityMatch[]
  ideas: StewardSimilarityMatch[]
  thoughts: StewardSimilarityMatch[]
}

function normalizeTagToken(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-/]+|[-/]+$/g, '')
}

function normalizeTags(tags: string[]): string[] {
  const unique = new Set<string>()
  for (const tag of tags) {
    const normalized = normalizeTagToken(tag)
    if (normalized) unique.add(normalized)
  }
  return [...unique].sort((a, b) => a.localeCompare(b))
}

function deriveTitleFromPath(filePath: string): string {
  const base = filePath.split('/').pop() || filePath
  return base.replace(/\.md$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled Thought'
}

function toRankedCandidates(matches: StewardSimilarityMatch[]): RankedCandidate[] {
  return matches.map(item => ({
    key: item.key,
    title: item.title,
    parent: item.parent,
    score: item.score,
  }))
}

function toStewardSimilaritySnapshot(grouped: SimilarityGroupedMatches): StewardSimilaritySnapshot {
  const map = (type: 'epic' | 'idea' | 'thought', matches: SimilarityGroupedMatches['epics']): StewardSimilarityMatch[] => (
    matches.map(match => ({
      key: match.node.key,
      title: match.node.title,
      parent: match.node.parent,
      type,
      score: Number(match.normalizedScore.toFixed(3)),
      reasons: match.reasons,
    }))
  )

  return {
    engine: grouped.engine,
    epics: map('epic', grouped.epics),
    ideas: map('idea', grouped.ideas),
    thoughts: map('thought', grouped.thoughts),
  }
}

function heuristicTags(filePath: string): string[] {
  const segments = filePath
    .split('/')
    .map(part => part.replace(/\.md$/i, ''))
    .filter(Boolean)
    .slice(-5)
  const tags = segments.map(segment => normalizeTagToken(segment.replace(/\s+/g, '-'))).filter(Boolean)
  return normalizeTags(['thought', ...tags.slice(-4)])
}

function heuristicSummary(content: string, title: string): string {
  const body = content
    .replace(/^---\n[\s\S]*?\n---\n?/m, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(' ')
  const candidate = body || title
  return candidate.slice(0, 280)
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const raw = fenced ? fenced[1].trim() : text.trim()
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) return null
  const jsonText = raw.slice(firstBrace, lastBrace + 1)
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function parseAiSuggestion(payload: Record<string, unknown>): {
  summary: string
  tags: string[]
  suggestedEpicKey?: string
  suggestedIdeaKey?: string
  rationale: string
} | null {
  const summary = typeof payload.summary === 'string' ? payload.summary.trim() : ''
  if (!summary) return null
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map(value => String(value))
    : []
  const suggestedEpicKey = typeof payload.suggested_epic_key === 'string' ? payload.suggested_epic_key.trim() : ''
  const suggestedIdeaKey = typeof payload.suggested_idea_key === 'string' ? payload.suggested_idea_key.trim() : ''
  const rationale = typeof payload.rationale === 'string' ? payload.rationale.trim() : ''

  return {
    summary,
    tags: normalizeTags(tags),
    suggestedEpicKey: suggestedEpicKey || undefined,
    suggestedIdeaKey: suggestedIdeaKey || undefined,
    rationale: rationale || 'AI metadata suggestion generated from file content and organizer context.',
  }
}

export async function generateStewardMetadataSuggestionForFileOrch(filePath: string): Promise<StewardMetadataSuggestion> {
  const fs = getVaultFS()
  const content = await fs.read(filePath)
  const title = deriveTitleFromPath(filePath)
  const signal = `${filePath}\n${title}\n${content.slice(0, 2600)}`
  const similar = await findSimilarGroupedMatchesOrch({
    text: signal,
    sourceFilePath: filePath,
    preferredTypes: ['epic', 'idea', 'thought'],
    perTypeLimit: 10,
    limit: 160,
  })
  const similarity = toStewardSimilaritySnapshot(similar)
  const epicCandidates = toRankedCandidates(similarity.epics)
  const ideaCandidates = toRankedCandidates(similarity.ideas)
  const thoughtCandidates = toRankedCandidates(similarity.thoughts)

  const heuristicEpic = epicCandidates[0]?.key
  const heuristicIdea = ideaCandidates[0]?.key
  const heuristicTelemetry = (reason: string): AiTelemetryEvent => {
    const now = new Date().toISOString()
    return recordAiTelemetryOrch({
      useCase: 'steward.metadata.proposal_generation',
      provider: 'heuristic',
      model: 'heuristic-v1',
      status: 'success',
      requestedAt: now,
      respondedAt: now,
      latencyMs: 0,
      completionChars: 0,
      metadata: {
        filePath,
        reason,
      },
    })
  }

  const fallback: StewardMetadataSuggestion = {
    summary: heuristicSummary(content, title),
    tags: heuristicTags(filePath),
    suggestedEpicKey: heuristicEpic,
    suggestedIdeaKey: heuristicIdea,
    rationale: 'Heuristic metadata suggestion generated from file path/content and organizer lexical matching.',
    usedAi: false,
    telemetry: undefined,
    similarity,
  }

  const selection = await resolveAiSelectionOrch({ scope: 'steward_metadata' })
  if (!selection) {
    return {
      ...fallback,
      telemetry: heuristicTelemetry('no_provider_available'),
    }
  }

  const prompt = [
    'You are a metadata steward for a markdown knowledge vault.',
    'Return STRICT JSON only with keys:',
    'summary, tags, suggested_epic_key, suggested_idea_key, rationale',
    '',
    'Rules:',
    '- summary: concise (<= 280 chars), factual.',
    '- tags: 3-8 lowercase tags in slug format, prefer path/topic semantics.',
    '- suggested_epic_key: choose from epic candidates or empty string.',
    '- suggested_idea_key: choose from idea candidates or empty string.',
    '- suggested_idea_key should usually belong under suggested_epic_key when possible.',
    '',
    'File path:',
    filePath,
    '',
    'Content excerpt:',
    content.slice(0, 2600),
    '',
    'Epic candidates (key | title):',
    ...epicCandidates.map(item => `- ${item.key} | ${item.title}`),
    '',
    'Idea candidates (key | title | parent):',
    ...ideaCandidates.map(item => `- ${item.key} | ${item.title} | parent=${item.parent ?? ''}`),
    '',
    'Similar thought candidates (key | title | score):',
    ...thoughtCandidates.map(item => `- ${item.key} | ${item.title} | score=${item.score.toFixed(3)}`),
  ].join('\n')

  try {
    const { response, telemetryEvent } = await sendChatWithTelemetryOrch(
      selection.provider,
      [{ role: 'user', content: prompt }],
      { model: selection.model },
      {
        useCase: 'steward.metadata.proposal_generation',
        metadata: {
          filePath,
          configuredProvider: selection.provider,
          configuredModel: selection.model,
          similarityEngine: similarity.engine,
          epicCandidates: epicCandidates.length,
          ideaCandidates: ideaCandidates.length,
          thoughtCandidates: thoughtCandidates.length,
        },
      },
    )
    const parsed = extractJsonObject(response.content)
    if (!parsed) {
      return {
        ...fallback,
        provider: response.provider,
        model: response.model,
        telemetry: telemetryEvent,
        similarity,
      }
    }
    const ai = parseAiSuggestion(parsed)
    if (!ai) {
      return {
        ...fallback,
        provider: response.provider,
        model: response.model,
        telemetry: telemetryEvent,
        similarity,
      }
    }

    const validEpic = ai.suggestedEpicKey && epicCandidates.some(item => item.key === ai.suggestedEpicKey)
      ? ai.suggestedEpicKey
      : heuristicEpic
    const validIdea = ai.suggestedIdeaKey && ideaCandidates.some(item => item.key === ai.suggestedIdeaKey)
      ? ai.suggestedIdeaKey
      : heuristicIdea

    return {
      summary: ai.summary,
      tags: ai.tags.length > 0 ? ai.tags : fallback.tags,
      suggestedEpicKey: validEpic,
      suggestedIdeaKey: validIdea,
      rationale: ai.rationale,
      provider: response.provider,
      model: response.model,
      usedAi: true,
      telemetry: telemetryEvent,
      similarity,
    }
  } catch {
    return fallback
  }
}

export async function applyStewardMetadataToFileOrch(params: {
  filePath: string
  summary: string
  tags: string[]
  suggestedEpicKey?: string
  suggestedIdeaKey?: string
}): Promise<void> {
  const fs = getVaultFS()
  const content = await fs.read(params.filePath)
  const now = new Date().toISOString()
  const sanitizedTags = normalizeTags(params.tags)
  const suggestionParent = params.suggestedIdeaKey || params.suggestedEpicKey

  const parsed = parseNote(content)
  const note = parsed ?? createNote({
    type: 'thought',
    title: deriveTitleFromPath(params.filePath),
    tags: sanitizedTags,
    body: content,
  })

  note.frontmatter.tags = sanitizedTags
  note.frontmatter.ai_summary = params.summary.trim()
  note.frontmatter.ai_generated = true
  note.frontmatter.last_ai_update = now
  note.frontmatter.updated_at = now
  if (!note.frontmatter.description?.trim()) {
    note.frontmatter.description = params.summary.trim()
  }

  const existingRelated = note.frontmatter.ai_suggestions?.related ?? []
  const relatedMap = new Map(existingRelated.map(item => [item.key, item]))
  if (params.suggestedEpicKey) {
    relatedMap.set(params.suggestedEpicKey, {
      key: params.suggestedEpicKey,
      reason: 'Suggested epic context',
      score: 0.6,
    })
  }
  if (params.suggestedIdeaKey) {
    relatedMap.set(params.suggestedIdeaKey, {
      key: params.suggestedIdeaKey,
      reason: 'Suggested idea context',
      score: 0.8,
    })
  }

  note.frontmatter.ai_suggestions = {
    related: [...relatedMap.values()],
    suggested_move: suggestionParent ? { parent: suggestionParent } : undefined,
  }

  await fs.write(params.filePath, stringifyNote(note))
  await syncSingleFile(params.filePath, fs)
}
