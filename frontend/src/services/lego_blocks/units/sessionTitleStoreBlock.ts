// Renderer-side wrapper for the sidecar JSON store at
// `~/.thinking-space/session-titles/<key>.json`. In-memory map mirrors the
// disk so repeated reads in the same session don't hit IPC.
//
// Non-Electron platforms (iOS/web) get a memory-only stub — the AI title
// feature is Electron-only since there's no local-model server reachable from
// the web build anyway.

export interface SessionTitleRecord {
  sessionId: string
  title: string
  model: string
  generatedAt: string
  sourceMtimeMs: number
  msgCount: number
  /** Prompt/sanitizer revision the title was generated with. Records with a
   *  version below the current `TITLE_PROMPT_VERSION` are treated as stale
   *  and regenerated next time the chain is rendered. */
  promptVersion?: number
}

interface TitleApi {
  sessionTitleGet?: (key: string) => Promise<SessionTitleRecord | null>
  sessionTitleSet?: (record: SessionTitleRecord) => Promise<{ ok: boolean; error?: string }>
}

function getApi(): TitleApi | null {
  if (typeof window === 'undefined') return null
  const api = (window as unknown as { electronAPI?: TitleApi }).electronAPI
  if (!api || !api.sessionTitleGet || !api.sessionTitleSet) return null
  return api
}

const memoryCache = new Map<string, SessionTitleRecord | null>()

export function sessionTitleAvailableBlock(): boolean {
  return getApi() !== null
}

export async function readSessionTitleBlock(key: string): Promise<SessionTitleRecord | null> {
  if (!key) return null
  if (memoryCache.has(key)) return memoryCache.get(key) ?? null
  const api = getApi()
  if (!api?.sessionTitleGet) {
    memoryCache.set(key, null)
    return null
  }
  try {
    const record = await api.sessionTitleGet(key)
    memoryCache.set(key, record)
    return record
  } catch {
    memoryCache.set(key, null)
    return null
  }
}

export async function writeSessionTitleBlock(record: SessionTitleRecord): Promise<boolean> {
  const api = getApi()
  if (!api?.sessionTitleSet) return false
  try {
    const result = await api.sessionTitleSet(record)
    if (result?.ok) {
      memoryCache.set(record.sessionId, record)
      return true
    }
    return false
  } catch {
    return false
  }
}

/** Invalidate the in-memory mirror — used when the user clears titles or when
 *  we detect a stale record vs the current chain state. */
export function forgetSessionTitleBlock(key: string): void {
  memoryCache.delete(key)
}
