const AI_DEBUG_PREFIX = '[AI-DEBUG]'

function localStorageFlagEnabled(): boolean {
  try {
    const storage = globalThis.localStorage
    if (!storage) return false
    const raw = storage.getItem('ai_debug_enabled')
    if (!raw) return false
    const normalized = raw.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
  } catch {
    return false
  }
}

export function isAiDebugEnabledBlock(): boolean {
  return localStorageFlagEnabled()
}

export function aiDebugBlock(event: string, data?: unknown): void {
  if (!isAiDebugEnabledBlock()) return
  if (typeof data === 'undefined') {
    console.debug(`${AI_DEBUG_PREFIX} ${event}`)
    return
  }
  console.debug(`${AI_DEBUG_PREFIX} ${event}`, data)
}

export function aiDebugWarnBlock(event: string, data?: unknown): void {
  if (!isAiDebugEnabledBlock()) return
  if (typeof data === 'undefined') {
    console.warn(`${AI_DEBUG_PREFIX} ${event}`)
    return
  }
  console.warn(`${AI_DEBUG_PREFIX} ${event}`, data)
}

export function aiDebugErrorMessageBlock(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string') return error
  return String(error)
}
