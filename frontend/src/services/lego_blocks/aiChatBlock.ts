/**
 * AI chat block — sends messages to Claude or Azure GPT.
 *
 * Electron: direct SDK calls from renderer with IPC-sourced credentials.
 * Web: POST to backend /api/ai/chat which proxies the call.
 */

import { isElectron } from './fsBlock'
import {
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
}

// ── Electron: direct API calls ──

async function sendClaudeDirectBlock(messages: ChatMessage[]): Promise<ChatResponse> {
  const creds = await getClaudeCredentialsBlock()
  if (!creds) throw new Error('Claude credentials not available')

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({
    authToken: creds.accessToken,
    defaultHeaders: { 'anthropic-beta': 'oauth-2025-04-20' },
    dangerouslyAllowBrowser: true,
  })

  const model = 'claude-sonnet-4-5-20250929'
  const requestedAt = new Date().toISOString()
  const started = performance.now()
  const response = await client.messages.create({
    model,
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
    model,
    requested_at: requestedAt,
    responded_at: respondedAt,
    latency_ms: latencyMs,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
  }
}

async function sendAzureDirectBlock(messages: ChatMessage[]): Promise<ChatResponse> {
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

  const model = 'gpt-5'
  const requestedAt = new Date().toISOString()
  const started = performance.now()
  const payload = {
    model,
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
    model,
    requested_at: requestedAt,
    responded_at: respondedAt,
    latency_ms: latencyMs,
    input_tokens: response.usage?.prompt_tokens ?? undefined,
    output_tokens: response.usage?.completion_tokens ?? undefined,
    total_tokens: response.usage?.total_tokens ?? undefined,
  }
}

async function sendCodexDirectBlock(messages: ChatMessage[]): Promise<ChatResponse> {
  const creds = await getCodexCredentialsBlock()
  if (!creds) throw new Error('Codex credentials not available')

  const { default: OpenAI } = await import('openai')
  const client = new OpenAI({
    apiKey: creds.accessToken,
    baseURL: 'https://api.openai.com/v1',
    defaultHeaders: { Authorization: `Bearer ${creds.accessToken}` },
    dangerouslyAllowBrowser: true,
  })

  const model = 'gpt-5-codex'
  const requestedAt = new Date().toISOString()
  const started = performance.now()
  const response: any = await client.responses.create({
    model,
    input: messages.map(m => ({
      role: m.role,
      content: [{ type: 'input_text', text: m.content }],
    })),
  })

  const text = typeof response?.output_text === 'string' ? response.output_text : ''
  const respondedAt = new Date().toISOString()
  const latencyMs = Math.round(performance.now() - started)
  const inputTokens = response?.usage?.input_tokens
  const outputTokens = response?.usage?.output_tokens
  const totalTokens = (
    typeof inputTokens === 'number' && typeof outputTokens === 'number'
      ? inputTokens + outputTokens
      : undefined
  )
  return {
    role: 'assistant',
    content: text,
    provider: 'openai-codex',
    model,
    requested_at: requestedAt,
    responded_at: respondedAt,
    latency_ms: latencyMs,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
  }
}

// ── Web: backend proxy ──

async function sendViaBackendBlock(provider: AiProvider, messages: ChatMessage[]): Promise<ChatResponse> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, messages }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`AI chat failed (HTTP ${res.status}): ${detail.slice(0, 300)}`)
  }
  return res.json()
}

// ── Public API ──

export async function sendChatBlock(provider: AiProvider, messages: ChatMessage[]): Promise<ChatResponse> {
  if (isElectron()) {
    if (provider === 'claude') return sendClaudeDirectBlock(messages)
    if (provider === 'openai-codex') return sendCodexDirectBlock(messages)
    if (provider === 'azure-gpt') return sendAzureDirectBlock(messages)
    throw new Error(`Unknown provider: ${provider}`)
  }
  return sendViaBackendBlock(provider, messages)
}
