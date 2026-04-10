export interface WindowContextBlock {
  browserWindowId: number | null
  sessionId: string
  isMainWindow: boolean
  isBackgroundAuthority: boolean
}

const DEFAULT_WINDOW_CONTEXT_BLOCK: WindowContextBlock = {
  browserWindowId: null,
  sessionId: 'default',
  isMainWindow: false,
  isBackgroundAuthority: true,
}

function sanitizeWindowContextBlock(value: unknown): WindowContextBlock {
  if (!value || typeof value !== 'object') return DEFAULT_WINDOW_CONTEXT_BLOCK
  const record = value as Record<string, unknown>
  const browserWindowId = typeof record.browserWindowId === 'number' && Number.isFinite(record.browserWindowId)
    ? record.browserWindowId
    : null
  const sessionId = typeof record.sessionId === 'string' && record.sessionId.trim().length > 0
    ? record.sessionId.trim()
    : DEFAULT_WINDOW_CONTEXT_BLOCK.sessionId
  return {
    browserWindowId,
    sessionId,
    isMainWindow: Boolean(record.isMainWindow),
    isBackgroundAuthority: record.isBackgroundAuthority === undefined
      ? DEFAULT_WINDOW_CONTEXT_BLOCK.isBackgroundAuthority
      : Boolean(record.isBackgroundAuthority),
  }
}

export function getWindowContextBlock(): WindowContextBlock {
  if (typeof window === 'undefined') return DEFAULT_WINDOW_CONTEXT_BLOCK
  return sanitizeWindowContextBlock(window.electronAPI?.windowGetContext?.())
}

export function subscribeWindowContextBlock(handler: (context: WindowContextBlock) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const subscribe = window.electronAPI?.onWindowContext
  if (typeof subscribe !== 'function') return () => {}
  return subscribe((context) => {
    handler(sanitizeWindowContextBlock(context))
  })
}
