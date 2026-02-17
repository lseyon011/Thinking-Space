import { spawn } from 'node:child_process'
import process from 'node:process'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RunnerPayload {
  messages: ChatMessage[]
  model?: string
  timeoutMs?: number
  workingDirectory?: string
}

interface ParsedOutput {
  text: string
  model: string
  threadId?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  errors: string[]
}

const DEFAULT_MODEL = 'gpt-5.3-codex'
const DEFAULT_TIMEOUT_MS = 180_000

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    process.stdin.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    process.stdin.on('error', reject)
  })
}

function buildPrompt(messages: ChatMessage[]): string {
  const transcript = messages
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}:\n${message.content}`)
    .join('\n\n')

  return [
    'Continue this chat and reply as the assistant.',
    'Conversation:',
    transcript,
    'Assistant:',
  ].join('\n\n')
}

function parseNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function extractJsonFromLine(line: string): unknown {
  const trimmed = line.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    const jsonStart = trimmed.indexOf('{')
    if (jsonStart < 0) return null
    const candidate = trimmed.slice(jsonStart)
    try {
      return JSON.parse(candidate)
    } catch {
      return null
    }
  }
}

function appendText(chunks: string[], value: string): void {
  const next = value.trim()
  if (!next) return
  if (chunks[chunks.length - 1] === next) return
  chunks.push(next)
}

function parseCodexJsonl(raw: string, requestedModel: string): ParsedOutput {
  const messageChunks: string[] = []
  const deltaChunks: string[] = []
  const errors: string[] = []

  let threadId: string | undefined
  let model = requestedModel
  let inputTokens: number | undefined
  let outputTokens: number | undefined
  let totalTokens: number | undefined

  const lines = raw.split(/\r?\n/g)
  for (const line of lines) {
    const parsed = extractJsonFromLine(line)
    if (!parsed || typeof parsed !== 'object') continue
    const entry = parsed as Record<string, unknown>
    const type = typeof entry.type === 'string' ? entry.type : ''

    if (!threadId && typeof entry.thread_id === 'string' && entry.thread_id.trim()) {
      threadId = entry.thread_id.trim()
    }

    if (typeof entry.model === 'string' && entry.model.trim()) {
      model = entry.model.trim()
    }

    const usage = typeof entry.usage === 'object' && entry.usage ? entry.usage as Record<string, unknown> : null
    if (usage) {
      inputTokens = parseNumber(usage.input_tokens) ?? inputTokens
      outputTokens = parseNumber(usage.output_tokens) ?? outputTokens
      totalTokens = parseNumber(usage.total_tokens) ?? totalTokens
    }

    const item = typeof entry.item === 'object' && entry.item ? entry.item as Record<string, unknown> : null
    if (item && typeof item.text === 'string') {
      const itemType = typeof item.type === 'string' ? item.type.toLowerCase() : ''
      if (!itemType || itemType.includes('message') || itemType.includes('output_text')) {
        appendText(messageChunks, item.text)
      }
    }

    if (type === 'response.output_text.delta' && typeof entry.delta === 'string') {
      deltaChunks.push(entry.delta)
    }
    if (type === 'response.output_text.done' && typeof entry.text === 'string') {
      appendText(messageChunks, entry.text)
    }

    if (type === 'error') {
      if (typeof entry.message === 'string' && entry.message.trim()) {
        errors.push(entry.message.trim())
      }
      const nested = typeof entry.error === 'object' && entry.error ? entry.error as Record<string, unknown> : null
      if (nested && typeof nested.message === 'string' && nested.message.trim()) {
        errors.push(nested.message.trim())
      }
    }
  }

  const deltaText = deltaChunks.join('').trim()
  const text = messageChunks.join('\n').trim() || deltaText

  return {
    text,
    model,
    threadId,
    inputTokens,
    outputTokens,
    totalTokens,
    errors,
  }
}

async function run(): Promise<void> {
  const raw = (await readStdin()).trim()
  const payload = (raw ? JSON.parse(raw) : {}) as RunnerPayload

  const messages = Array.isArray(payload.messages)
    ? payload.messages.filter((m): m is ChatMessage => {
      if (!m || typeof m !== 'object') return false
      if (m.role !== 'user' && m.role !== 'assistant') return false
      return typeof m.content === 'string'
    })
    : []

  if (messages.length === 0) {
    throw new Error('messages must be a non-empty array')
  }

  const model = typeof payload.model === 'string' && payload.model.trim() ? payload.model.trim() : DEFAULT_MODEL
  const prompt = buildPrompt(messages)
  const timeoutMs = typeof payload.timeoutMs === 'number' && payload.timeoutMs > 0
    ? Math.floor(payload.timeoutMs)
    : DEFAULT_TIMEOUT_MS

  const args = [
    'exec',
    '--json',
    '--color',
    'never',
    '--sandbox',
    'read-only',
    '--skip-git-repo-check',
    '--model',
    model,
    prompt,
  ]

  const child = spawn('codex', args, {
    cwd: typeof payload.workingDirectory === 'string' && payload.workingDirectory.trim()
      ? payload.workingDirectory.trim()
      : process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []

  child.stdout.on('data', (chunk) => stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
  child.stderr.on('data', (chunk) => stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))

  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    child.kill('SIGTERM')
  }, timeoutMs)

  const exitCode: number = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) => resolve(code ?? 1))
  }).finally(() => clearTimeout(timeout))

  const stdout = Buffer.concat(stdoutChunks).toString('utf-8')
  const stderr = Buffer.concat(stderrChunks).toString('utf-8')
  const merged = `${stdout}\n${stderr}`
  const parsed = parseCodexJsonl(merged, model)

  if (timedOut) {
    throw new Error(`Codex CLI timed out after ${timeoutMs}ms`)
  }

  if (exitCode !== 0) {
    const errorDetail = parsed.errors[parsed.errors.length - 1]
      || stderr.trim()
      || stdout.trim()
      || `exit code ${exitCode}`
    throw new Error(`Codex CLI failed: ${errorDetail.slice(0, 500)}`)
  }

  if (!parsed.text) {
    throw new Error('Codex CLI returned no assistant text')
  }

  process.stdout.write(JSON.stringify({
    text: parsed.text,
    model: parsed.model,
    thread_id: parsed.threadId,
    input_tokens: parsed.inputTokens,
    output_tokens: parsed.outputTokens,
    total_tokens: parsed.totalTokens,
  }))
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(message)
  process.exit(1)
})
