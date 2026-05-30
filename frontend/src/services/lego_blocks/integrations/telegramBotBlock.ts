// Low-level Telegram Bot API access. Reads creds from
// ~/.thinking-space/secrets.json and posts to api.telegram.org.
//
// Runs only in node-capable runtimes (Electron-as-Node CLI, Electron main).
// Renderer code that needs to send Telegram messages must go through the
// CLI or main-process IPC, not import this block directly.

// Namespace imports (not named) so Vite's browser externalization doesn't
// fail at build time. The renderer never calls these helpers; they only
// resolve at runtime in Electron-as-Node (CLI) or Electron main.
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

export type TelegramParseMode = 'Markdown' | 'MarkdownV2' | 'HTML'

export interface TelegramCreds {
  botToken: string
  chatId: number | string
}

export interface TelegramSendOptions {
  text: string
  parseMode?: TelegramParseMode
  chatId?: number | string
}

export interface TelegramSendResult {
  messageId: number
  chatId: number | string
  date: number
}

function getSecretsPath(): string {
  return path.join(os.homedir(), '.thinking-space', 'secrets.json')
}

export function readTelegramCredsBlock(): TelegramCreds {
  const secretsPath = getSecretsPath()
  let raw: string
  try {
    raw = fs.readFileSync(secretsPath, 'utf-8')
  } catch (err) {
    throw new Error(`Telegram secrets unreadable at ${secretsPath}: ${(err as Error).message}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`Telegram secrets file is not valid JSON: ${(err as Error).message}`)
  }
  const tg = (parsed as { telegram?: { bot_token?: string; chat_id?: number | string } } | null)?.telegram
  if (!tg?.bot_token || tg.chat_id === undefined || tg.chat_id === null) {
    throw new Error(`Telegram secrets missing bot_token or chat_id at ${secretsPath}`)
  }
  return { botToken: tg.bot_token, chatId: tg.chat_id }
}

export async function sendTelegramMessageBlock(options: TelegramSendOptions): Promise<TelegramSendResult> {
  if (!options.text || !options.text.trim()) {
    throw new Error('Telegram send: text is required')
  }
  const creds = readTelegramCredsBlock()
  const chatId = options.chatId ?? creds.chatId
  const url = `https://api.telegram.org/bot${creds.botToken}/sendMessage`
  const body: Record<string, unknown> = { chat_id: chatId, text: options.text }
  if (options.parseMode) body.parse_mode = options.parseMode

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => null) as
    | { ok: true; result: { message_id: number; chat: { id: number | string }; date: number } }
    | { ok: false; description?: string; error_code?: number }
    | null

  if (!res.ok || !payload || !('ok' in payload) || !payload.ok) {
    const desc = (payload && 'description' in payload && payload.description) || res.statusText
    const code = (payload && 'error_code' in payload && payload.error_code) || res.status
    throw new Error(`Telegram sendMessage failed (${code}): ${desc}`)
  }

  return {
    messageId: payload.result.message_id,
    chatId: payload.result.chat.id,
    date: payload.result.date,
  }
}
