const EXCALIDRAW_CRASH_MARKER_KEY_BLOCK = 'ltm.excalidraw.edit-crash-marker'
const EXCALIDRAW_CRASH_MARKER_MAX_AGE_MS = 10 * 60 * 1000

export type ExcalidrawCrashStageBlock =
  | 'edit_requested'
  | 'editor_mounting'
  | 'api_attached'

export interface ExcalidrawCrashMarkerBlock {
  path: string
  stage: ExcalidrawCrashStageBlock
  markedAt: number
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readRawMarker(): ExcalidrawCrashMarkerBlock | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(EXCALIDRAW_CRASH_MARKER_KEY_BLOCK)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ExcalidrawCrashMarkerBlock>
    if (typeof parsed.path !== 'string' || typeof parsed.stage !== 'string' || typeof parsed.markedAt !== 'number') {
      return null
    }
    return {
      path: parsed.path,
      stage: parsed.stage as ExcalidrawCrashStageBlock,
      markedAt: parsed.markedAt,
    }
  } catch {
    return null
  }
}

export function markExcalidrawCrashStageBlock(path: string, stage: ExcalidrawCrashStageBlock): void {
  if (!canUseStorage()) return
  try {
    const marker: ExcalidrawCrashMarkerBlock = {
      path,
      stage,
      markedAt: Date.now(),
    }
    window.localStorage.setItem(EXCALIDRAW_CRASH_MARKER_KEY_BLOCK, JSON.stringify(marker))
  } catch {
    // Ignore storage failures. This is diagnostic only.
  }
}

export function clearExcalidrawCrashMarkerBlock(): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.removeItem(EXCALIDRAW_CRASH_MARKER_KEY_BLOCK)
  } catch {
    // Ignore storage failures. This is diagnostic only.
  }
}

export function consumeRecentExcalidrawCrashMarkerBlock(): ExcalidrawCrashMarkerBlock | null {
  const marker = readRawMarker()
  clearExcalidrawCrashMarkerBlock()
  if (!marker) return null
  if (Date.now() - marker.markedAt > EXCALIDRAW_CRASH_MARKER_MAX_AGE_MS) return null
  return marker
}
