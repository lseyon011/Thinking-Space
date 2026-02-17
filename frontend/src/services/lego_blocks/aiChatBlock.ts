/**
 * AI chat block — sends messages to configured AI providers.
 *
 * Electron: direct SDK calls from renderer with IPC-sourced credentials.
 * Web: POST to backend /api/ai/chat which proxies the call.
 */

import { isElectron } from './fsBlock'
import {
  defaultProviderModelBlock,
  type AiProvider,
  getClaudeCredentialsBlock,
  getCodexCredentialsBlock,
  getAzureCredentialsBlock,
} from './aiProviderBlock'

const CLAUDE_MAX_OUTPUT_TOKENS = 64000

// ── Types ──

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  role: 'assistant'
  content: string
  provider: AiProvider
  model: string
  requested_at?: string
  responded_at?: string
  latency_ms?: number
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  thread_id?: string
}

export interface ChatSendOptions {
  threadId?: string
  model?: string
}

// ── Electron: direct API calls ──

function resolveRequestedModel(provider: AiProvider, requested?: string): string {
  const normalized = typeof requested === 'string' ? requested.trim() : ''
  return normalized || defaultProviderModelBlock(provider)
}

async function sendClaudeDirectBlock(messages: ChatMessage[], model?: string): Promise<ChatResponse> {
  const creds = await getClaudeCredentialsBlock()
  if (!creds) throw new Error('Claude credentials not available')

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({
    authToken: creds.accessToken,
    defaultHeaders: { 'anthropic-beta': 'oauth-2025-04-20' },
    dangerouslyAllowBrowser: true,
  })

  const requestedModel = resolveRequestedModel('claude', model)
  const requestedAt = new Date().toISOString()
  const started = performance.now()
  const response = await client.messages.create({
    model: requestedModel,
    // Anthropic Messages API requires max_tokens; keep a high ceiling.
    max_tokens: CLAUDE_MAX_OUTPUT_TOKENS,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  })

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => ('text' in block ? (block as { text: string }).text : ''))
    .join('')

  const respondedAt = new Date().toISOString()
  const latencyMs = Math.round(performance.now() - started)
  const inputTokens = response.usage?.input_tokens
  const outputTokens = response.usage?.output_tokens
  const totalTokens = (
    typeof inputTokens === 'number' && typeof outputTokens === 'number'
      ? inputTokens + outputTokens
      : undefined
  )
  return {
    role: 'assistant',
    content: text,
    provider: 'claude',
    model: requestedModel,
    requested_at: requestedAt,
    responded_at: respondedAt,
    latency_ms: latencyMs,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
  }
}

async function sendAzureDirectBlock(messages: ChatMessage[], model?: string): Promise<ChatResponse> {
  const creds = await getAzureCredentialsBlock()
  if (!creds) throw new Error('Azure credentials not available')

  const { default: OpenAI } = await import('openai')
  const client = new OpenAI({
    apiKey: creds.accessToken,
    baseURL: 'https://fuchs-lab-openai.openai.azure.com/openai/deployments/gpt-5',
    defaultQuery: { 'api-version': '2024-12-01-preview' },
    defaultHeaders: { Authorization: `Bearer ${creds.accessToken}` },
    dangerouslyAllowBrowser: true,
  })

  const requestedModel = resolveRequestedModel('azure-gpt', model)
  const requestedAt = new Date().toISOString()
  const started = performance.now()
  const payload = {
    model: requestedModel,
    messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  }
  const response = await client.chat.completions.create(payload)

  const text = response.choices[0]?.message?.content ?? ''
  const respondedAt = new Date().toISOString()
  const latencyMs = Math.round(performance.now() - started)
  return {
    role: 'assistant',
    content: text,
    provider: 'azure-gpt',
    model: requestedModel,
    requested_at: requestedAt,
    responded_at: respondedAt,
    latency_ms: latencyMs,
    input_tokens: response.usage?.prompt_tokens ?? undefined,
    output_tokens: response.usage?.completion_tokens ?? undefined,
    total_tokens: response.usage?.total_tokens ?? undefined,
  }
}

async function sendCodexDirectBlock(messages: ChatMessage[], model?: string): Promise<ChatResponse> {
  const creds = await getCodexCredentialsBlock()
  if (!creds) throw new Error('Codex credentials not available')

  const requestedModel = resolveRequestedModel('openai-codex', model)
  const requestedAt = new Date().toISOString()
  const started = performance.now()
  const response = await window.electronAPI!.aiChatCodex(messages, creds.accessToken, creds.accountId, requestedModel)

  const text = response.text ?? ''
  const respondedAt = new Date().toISOString()
  const latencyMs = Math.round(performance.now() - started)
  const inputTokens = response.inputTokens
  const outputTokens = response.outputTokens
  const totalTokens = response.totalTokens
  return {
    role: 'assistant',
    content: text,
    provider: 'openai-codex',
    model: response.model || requestedModel,
    requested_at: requestedAt,
    responded_at: respondedAt,
    latency_ms: latencyMs,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
  }
}

async function sendCodexCliViaBackendBlock(
  messages: ChatMessage[],
  options?: ChatSendOptions,
): Promise<ChatResponse> {
  const res = await fetch('/api/ai/chat/codex-cli', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      thread_id: options?.threadId || null,
      model: options?.model || null,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`AI chat failed (HTTP ${res.status}): ${detail.slice(0, 300)}`)
  }
  return res.json()
}

// ── Web: backend proxy ──

async function sendViaBackendBlock(
  provider: AiProvider,
  messages: ChatMessage[],
  options?: ChatSendOptions,
): Promise<ChatResponse> {
  if (provider === 'codex-cli') return sendCodexCliViaBackendBlock(messages, options)
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      messages,
      model: options?.model || null,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`AI chat failed (HTTP ${res.status}): ${detail.slice(0, 300)}`)
  }
  return res.json()
}

// ── Public API ──

export async function sendChatBlock(
  provider: AiProvider,
  messages: ChatMessage[],
  options?: ChatSendOptions,
): Promise<ChatResponse> {
  if (provider === 'codex-cli') return sendCodexCliViaBackendBlock(messages, options)
  if (isElectron()) {
    if (provider === 'claude') return sendClaudeDirectBlock(messages, options?.model)
    if (provider === 'openai-codex') return sendCodexDirectBlock(messages, options?.model)
    if (provider === 'azure-gpt') return sendAzureDirectBlock(messages, options?.model)
    throw new Error(`Unknown provider: ${provider}`)
  }
  return sendViaBackendBlock(provider, messages, options)
}
