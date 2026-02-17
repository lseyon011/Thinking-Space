import {
  sendChatBlock,
  type ChatMessage,
  type ChatResponse,
  type ChatSendOptions,
} from '../lego_blocks/aiChatBlock'
import { listProvidersBlock, type AiProvider, type AiProviderStatus } from '../lego_blocks/aiProviderBlock'
import { recordAiTelemetryOrch, type AiTelemetryEvent, type RecordAiTelemetryInput } from './aiTelemetryOrch'

export type {
  AiProvider,
  AiProviderStatus,
  ChatMessage,
  ChatResponse,
  ChatSendOptions,
  AiTelemetryEvent,
  RecordAiTelemetryInput,
}

export interface ChatTelemetryContext {
  useCase: string
  metadata?: Record<string, string | number | boolean | null>
}

export interface SendChatWithTelemetryResult {
  response: ChatResponse
  telemetryEvent: AiTelemetryEvent
}

function nowIso(): string {
  return new Date().toISOString()
}

function measureStart(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function elapsedMs(startedAt: number): number {
  const end = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return Math.max(0, Math.round(end - startedAt))
}

function promptChars(messages: ChatMessage[]): number {
  return messages.reduce((total, msg) => total + (msg.content?.length ?? 0), 0)
}

export async function listProvidersOrch(): Promise<AiProviderStatus[]> {
  return listProvidersBlock()
}

export async function sendChatOrch(
  provider: AiProvider,
  messages: ChatMessage[],
  options?: ChatSendOptions,
): Promise<ChatResponse> {
  return sendChatBlock(provider, messages, options)
}

export async function sendChatWithTelemetryOrch(
  provider: AiProvider,
  messages: ChatMessage[],
  options: ChatSendOptions | undefined,
  telemetry: ChatTelemetryContext,
): Promise<SendChatWithTelemetryResult> {
  const requestedAt = nowIso()
  const started = measureStart()
  const messageCount = messages.length
  const promptCharCount = promptChars(messages)

  try {
    const response = await sendChatBlock(provider, messages, options)
    const respondedAt = response.responded_at ?? nowIso()
    const latencyMs = response.latency_ms ?? elapsedMs(started)
    const completed: ChatResponse = {
      ...response,
      requested_at: response.requested_at ?? requestedAt,
      responded_at: respondedAt,
      latency_ms: latencyMs,
    }

    const telemetryEvent = recordAiTelemetryOrch({
      useCase: telemetry.useCase,
      provider: completed.provider,
      model: completed.model || 'unknown',
      status: 'success',
      requestedAt: completed.requested_at,
      respondedAt: completed.responded_at,
      latencyMs,
      inputTokens: completed.input_tokens,
      outputTokens: completed.output_tokens,
      totalTokens: completed.total_tokens,
      promptChars: promptCharCount,
      completionChars: completed.content.length,
      messageCount,
      metadata: telemetry.metadata,
    })

    return { response: completed, telemetryEvent }
  } catch (err) {
    const respondedAt = nowIso()
    const latencyMs = elapsedMs(started)
    const errorMessage = err instanceof Error ? err.message : String(err)
    const telemetryEvent = recordAiTelemetryOrch({
      useCase: telemetry.useCase,
      provider,
      model: options?.model?.trim() || 'unknown',
      status: 'error',
      requestedAt,
      respondedAt,
      latencyMs,
      promptChars: promptCharCount,
      messageCount,
      errorMessage,
      metadata: telemetry.metadata,
    })
    throw Object.assign(
      err instanceof Error ? err : new Error(errorMessage),
      { telemetryEventId: telemetryEvent.id },
    )
  }
}
