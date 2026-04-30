// Debug log event bus — broadcast structured log entries across the app.
// Consumers (App.tsx) subscribe and drive the debug panel + toast UI.

export type DebugLogLevel = 'error' | 'warn' | 'info' | 'debug'

export interface DebugLogEntryBlock {
  id: string
  level: DebugLogLevel
  message: string
  timestamp: number
  source?: string
  details?: string
  stack?: string
}

const DEBUG_LOG_EVENT = 'ltm:debug:log-entry'

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function dispatchDebugLogBlock(entry: Omit<DebugLogEntryBlock, 'id' | 'timestamp'>): void {
  const full: DebugLogEntryBlock = { id: makeId(), timestamp: Date.now(), ...entry }
  window.dispatchEvent(new CustomEvent<DebugLogEntryBlock>(DEBUG_LOG_EVENT, { detail: full }))
}

export function addDebugLogListenerBlock(
  listener: (entry: DebugLogEntryBlock) => void,
): () => void {
  const handler = (event: Event) =>
    listener((event as CustomEvent<DebugLogEntryBlock>).detail)
  window.addEventListener(DEBUG_LOG_EVENT, handler)
  return () => window.removeEventListener(DEBUG_LOG_EVENT, handler)
}

// Convenience helpers
export function logError(message: string, details?: string, source?: string): void {
  dispatchDebugLogBlock({ level: 'error', message, details, source })
}

export function logWarn(message: string, details?: string, source?: string): void {
  dispatchDebugLogBlock({ level: 'warn', message, details, source })
}

export function logInfo(message: string, details?: string, source?: string): void {
  dispatchDebugLogBlock({ level: 'info', message, details, source })
}

export function logDebug(message: string, details?: string, source?: string): void {
  dispatchDebugLogBlock({ level: 'debug', message, details, source })
}

// Common keys that hold a human-readable message on plugin/SDK error objects.
const HUMAN_MESSAGE_KEYS_BLOCK = ['errorMessage', 'message', 'description', 'reason', 'detail']

// Pull a clean, single-line message out of whatever the caller passed to
// console.error/warn. Capacitor and other plugins throw plain objects shaped
// like {code, message, errorMessage}; rendering the raw JSON turns the debug
// panel into wall-of-brace noise. Extract the human field, keep the rest as
// structured details under the entry's "Show details" section.
interface FormattedConsolePayloadBlock {
  message: string
  details?: string
  stack?: string
}

function formatConsolePayloadBlock(args: unknown[]): FormattedConsolePayloadBlock {
  const messageParts: string[] = []
  const detailObjects: Record<string, unknown>[] = []
  let stack: string | undefined

  for (const arg of args) {
    if (arg instanceof Error) {
      messageParts.push(arg.message || arg.name || 'Error')
      if (!stack && arg.stack) stack = arg.stack
      const extras = extractErrorExtraFieldsBlock(arg)
      if (extras) detailObjects.push(extras)
      continue
    }

    if (typeof arg === 'string') {
      messageParts.push(arg)
      continue
    }

    if (typeof arg === 'number' || typeof arg === 'boolean' || arg == null) {
      messageParts.push(String(arg))
      continue
    }

    if (typeof arg === 'object') {
      const obj = arg as Record<string, unknown>
      const human = pickFirstStringFieldBlock(obj, HUMAN_MESSAGE_KEYS_BLOCK)
      if (human) messageParts.push(human)
      else messageParts.push(describeObjectShortlyBlock(obj))

      const rest = omitKeysBlock(obj, [...HUMAN_MESSAGE_KEYS_BLOCK])
      if (Object.keys(rest).length > 0) detailObjects.push(rest)
      if (!stack && typeof obj.stack === 'string') stack = obj.stack
      continue
    }

    messageParts.push(String(arg))
  }

  const message = messageParts
    .map(part => part.trim())
    .filter(Boolean)
    .join(' · ') || 'Unknown error'

  let details: string | undefined
  if (detailObjects.length > 0) {
    try {
      details = detailObjects
        .map(obj => formatDetailBlockBlock(obj))
        .filter(Boolean)
        .join('\n')
    } catch {
      details = undefined
    }
  }

  return { message, details, stack }
}

function pickFirstStringFieldBlock(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function omitKeysBlock(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const skip = new Set(keys)
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (skip.has(key)) continue
    if (value === undefined) continue
    out[key] = value
  }
  return out
}

function describeObjectShortlyBlock(obj: Record<string, unknown>): string {
  const ctor = (obj as { constructor?: { name?: string } }).constructor?.name
  const tag = ctor && ctor !== 'Object' ? ctor : null
  const code = typeof obj.code === 'string' ? obj.code : null
  if (tag && code) return `${tag} (${code})`
  if (tag) return tag
  if (code) return code
  return 'Object'
}

function formatDetailBlockBlock(obj: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    let rendered: string
    if (value == null) rendered = String(value)
    else if (typeof value === 'string') rendered = value
    else if (typeof value === 'number' || typeof value === 'boolean') rendered = String(value)
    else {
      try { rendered = JSON.stringify(value) } catch { rendered = '[unserializable]' }
    }
    lines.push(`${key}: ${rendered}`)
  }
  return lines.join('\n')
}

function extractErrorExtraFieldsBlock(error: Error): Record<string, unknown> | null {
  const seen = new Set(['name', 'message', 'stack'])
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(error) as Array<keyof Error>) {
    if (seen.has(key as string)) continue
    const value = (error as unknown as Record<string, unknown>)[key as string]
    if (value === undefined) continue
    out[key as string] = value
  }
  return Object.keys(out).length > 0 ? out : null
}

// Call once at startup to forward console.error / console.warn to the debug log.
let consoleIntercepted = false

export function installConsoleInterceptBlock(): void {
  if (consoleIntercepted) return
  consoleIntercepted = true

  const originalError = console.error.bind(console)
  const originalWarn = console.warn.bind(console)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error = (...args: any[]) => {
    originalError(...args)
    const { message, details, stack } = formatConsolePayloadBlock(args)
    dispatchDebugLogBlock({ level: 'error', message, details, stack, source: 'console' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.warn = (...args: any[]) => {
    originalWarn(...args)
    const { message, details } = formatConsolePayloadBlock(args)
    dispatchDebugLogBlock({ level: 'warn', message, details, source: 'console' })
  }
}
