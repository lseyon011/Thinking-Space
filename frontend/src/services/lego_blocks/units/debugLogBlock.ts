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
    const error = args.find((a): a is Error => a instanceof Error)
    const message = args
      .map(a => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' ')
    dispatchDebugLogBlock({ level: 'error', message, stack: error?.stack, source: 'console' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.warn = (...args: any[]) => {
    originalWarn(...args)
    const message = args
      .map(a => (typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' ')
    dispatchDebugLogBlock({ level: 'warn', message, source: 'console' })
  }
}
