import { STORAGE_KEYS, getJsonStorageItem, setJsonStorageItem } from './storageKeyBlock'

const MAX_TELEMETRY_EVENTS = 500

export type AiTelemetryStatus = 'success' | 'error'

export type AiTelemetryMetadataValue = string | number | boolean | null

export interface AiTelemetryEvent {
  id: string
  useCase: string
  provider: string
  model: string
  status: AiTelemetryStatus
  requestedAt: string
  respondedAt?: string
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  promptChars?: number
  completionChars?: number
  messageCount?: number
  errorMessage?: string
  metadata?: Record<string, AiTelemetryMetadataValue>
}

export interface RecordAiTelemetryInput {
  useCase: string
  provider: string
  model: string
  status: AiTelemetryStatus
  requestedAt?: string
  respondedAt?: string
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  promptChars?: number
  completionChars?: number
  messageCount?: number
  errorMessage?: string
  metadata?: Record<string, AiTelemetryMetadataValue>
}

function makeEventId(): string {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function sanitizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function sanitizeEvent(raw: unknown): AiTelemetryEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const event = raw as Partial<AiTelemetryEvent>
  const id = sanitizeString(event.id)
  const useCase = sanitizeString(event.useCase)
  const provider = sanitizeString(event.provider)
  const model = sanitizeString(event.model)
  const status = event.status === 'success' || event.status === 'error' ? event.status : null
  const requestedAt = sanitizeString(event.requestedAt)

  if (!id || !useCase || !provider || !model || !status || !requestedAt) return null

  return {
    id,
    useCase,
    provider,
    model,
    status,
    requestedAt,
    respondedAt: sanitizeString(event.respondedAt),
    latencyMs: sanitizeNumber(event.latencyMs),
    inputTokens: sanitizeNumber(event.inputTokens),
    outputTokens: sanitizeNumber(event.outputTokens),
    totalTokens: sanitizeNumber(event.totalTokens),
    promptChars: sanitizeNumber(event.promptChars),
    completionChars: sanitizeNumber(event.completionChars),
    messageCount: sanitizeNumber(event.messageCount),
    errorMessage: sanitizeString(event.errorMessage),
    metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : undefined,
  }
}

export function listAiTelemetryEventsBlock(limit = 100): AiTelemetryEvent[] {
  const raw = getJsonStorageItem<unknown[]>(STORAGE_KEYS.aiTelemetryEvents, [])
  const sanitized = raw
    .map(item => sanitizeEvent(item))
    .filter((item): item is AiTelemetryEvent => item !== null)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))

  if (!Number.isFinite(limit) || limit <= 0) return []
  return sanitized.slice(0, Math.min(limit, MAX_TELEMETRY_EVENTS))
}

export function appendAiTelemetryEventBlock(input: RecordAiTelemetryInput): AiTelemetryEvent {
  const requestedAt = sanitizeString(input.requestedAt) || new Date().toISOString()
  const next: AiTelemetryEvent = {
    id: makeEventId(),
    useCase: input.useCase.trim(),
    provider: input.provider.trim(),
    model: input.model.trim(),
    status: input.status,
    requestedAt,
    respondedAt: sanitizeString(input.respondedAt),
    latencyMs: sanitizeNumber(input.latencyMs),
    inputTokens: sanitizeNumber(input.inputTokens),
    outputTokens: sanitizeNumber(input.outputTokens),
    totalTokens: sanitizeNumber(input.totalTokens),
    promptChars: sanitizeNumber(input.promptChars),
    completionChars: sanitizeNumber(input.completionChars),
    messageCount: sanitizeNumber(input.messageCount),
    errorMessage: sanitizeString(input.errorMessage),
    metadata: input.metadata,
  }

  const existing = listAiTelemetryEventsBlock(MAX_TELEMETRY_EVENTS)
  const merged = [next, ...existing].slice(0, MAX_TELEMETRY_EVENTS)
  setJsonStorageItem(STORAGE_KEYS.aiTelemetryEvents, merged)
  return next
}

export function clearAiTelemetryEventsBlock(): void {
  setJsonStorageItem(STORAGE_KEYS.aiTelemetryEvents, [])
}
