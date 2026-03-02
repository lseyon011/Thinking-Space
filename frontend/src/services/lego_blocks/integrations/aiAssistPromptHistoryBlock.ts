export interface AiAssistPromptHistoryEntryBlock {
  id: string
  prompt: string
  useCount: number
  createdAt: string
  updatedAt: string
  lastUsedAt: string
}

export const AI_ASSIST_PROMPT_HISTORY_DIR_PATH_BLOCK = '.thinking-space/ai-assist'
export const AI_ASSIST_PROMPT_HISTORY_FILE_PATH_BLOCK = `${AI_ASSIST_PROMPT_HISTORY_DIR_PATH_BLOCK}/prompt-history.json`

const MAX_AI_ASSIST_PROMPT_HISTORY_ENTRIES_BLOCK = 300

function normalizeIsoTimestampBlock(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return fallback
  return parsed.toISOString()
}

function normalizeEntryIdBlock(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizePromptBlock(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600)
}

function normalizeUseCountBlock(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.round(value))
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.max(1, Math.round(parsed))
  }
  return 1
}

function makeEntryIdBlock(): string {
  return `ai-assist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeHistoryEntryBlock(value: unknown): AiAssistPromptHistoryEntryBlock | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Partial<AiAssistPromptHistoryEntryBlock>
  const prompt = normalizePromptBlock(row.prompt)
  if (!prompt) return null
  const now = new Date().toISOString()
  const createdAt = normalizeIsoTimestampBlock(row.createdAt, now)
  const updatedAt = normalizeIsoTimestampBlock(row.updatedAt, createdAt)
  const lastUsedAt = normalizeIsoTimestampBlock(row.lastUsedAt, updatedAt)
  return {
    id: normalizeEntryIdBlock(row.id) || makeEntryIdBlock(),
    prompt,
    useCount: normalizeUseCountBlock(row.useCount),
    createdAt,
    updatedAt,
    lastUsedAt,
  }
}

export function normalizeAiAssistPromptHistoryBlock(value: unknown): AiAssistPromptHistoryEntryBlock[] {
  if (!Array.isArray(value)) return []
  const dedupedByPrompt = new Map<string, AiAssistPromptHistoryEntryBlock>()
  for (const candidate of value) {
    const entry = normalizeHistoryEntryBlock(candidate)
    if (!entry) continue
    const dedupeKey = entry.prompt.toLowerCase()
    const existing = dedupedByPrompt.get(dedupeKey)
    if (!existing) {
      dedupedByPrompt.set(dedupeKey, entry)
      continue
    }
    if (entry.lastUsedAt.localeCompare(existing.lastUsedAt) > 0) {
      dedupedByPrompt.set(dedupeKey, entry)
    }
  }
  return [...dedupedByPrompt.values()]
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, MAX_AI_ASSIST_PROMPT_HISTORY_ENTRIES_BLOCK)
}

export function upsertAiAssistPromptHistoryEntryBlock(
  entries: AiAssistPromptHistoryEntryBlock[],
  prompt: string,
  usedAt = new Date().toISOString(),
): AiAssistPromptHistoryEntryBlock[] {
  const normalizedPrompt = normalizePromptBlock(prompt)
  if (!normalizedPrompt) return entries
  const nextUsedAt = normalizeIsoTimestampBlock(usedAt, new Date().toISOString())
  const existingIndex = entries.findIndex(
    (entry) => entry.prompt.toLowerCase() === normalizedPrompt.toLowerCase(),
  )

  const next = [...entries]
  if (existingIndex >= 0) {
    const existing = next[existingIndex]
    const updated: AiAssistPromptHistoryEntryBlock = {
      ...existing,
      prompt: normalizedPrompt,
      useCount: Math.max(1, existing.useCount + 1),
      updatedAt: nextUsedAt,
      lastUsedAt: nextUsedAt,
    }
    next.splice(existingIndex, 1)
    next.unshift(updated)
    return next.slice(0, MAX_AI_ASSIST_PROMPT_HISTORY_ENTRIES_BLOCK)
  }

  const created: AiAssistPromptHistoryEntryBlock = {
    id: makeEntryIdBlock(),
    prompt: normalizedPrompt,
    useCount: 1,
    createdAt: nextUsedAt,
    updatedAt: nextUsedAt,
    lastUsedAt: nextUsedAt,
  }
  next.unshift(created)
  return next.slice(0, MAX_AI_ASSIST_PROMPT_HISTORY_ENTRIES_BLOCK)
}
