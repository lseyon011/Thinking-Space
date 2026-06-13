import { useEffect, useRef } from 'react'
import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import { isExcalidrawPathBlock } from '@/services/lego_blocks/units/excalidrawPathBlock'
import { appendReadingSession } from '@/services/lego_blocks/integrations/thinkingspaceReadingBlock'
import {
  readingTitleFromPathBlock,
  type ThinkingspaceReadingSource,
} from '@/services/lego_blocks/units/thinkingspaceReadingParserBlock'

// Only a sitting this long counts as a reading/drawing session. Set high on
// purpose: every open/close would spam the log with noise — a session only
// matters once you've genuinely sat with the document.
const MIN_DWELL_MS = 20 * 60 * 1000 // 20 minutes

function sourceForPath(path: string): ThinkingspaceReadingSource {
  return isExcalidrawPathBlock(path) ? 'reading-draw' : 'reading-md'
}

/**
 * Track open-time for a markdown/excalidraw document and, when the component
 * unmounts (the document is closed or switched), append a reading session to
 * the durable vault log — but only if it was open past MIN_DWELL_MS. The emit
 * is fire-and-forget so unmount stays synchronous; failures are swallowed by
 * the writer.
 *
 * Mount one of these per open document (keyed on path) so mount == open and
 * unmount == close. Pass `enabled: false` for transient/embedded mounts that
 * shouldn't count (e.g. inline previews).
 */
export function useReadingDwellBlock(path: string | null, enabled = true): void {
  // Hold the latest path in a ref so the unmount cleanup reads the value that
  // was current when this sitting started, not a stale closure.
  const startedAtRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled || !path) return
    const startMs = Date.now()
    startedAtRef.current = startMs
    return () => {
      const endMs = Date.now()
      const dwell = endMs - startMs
      if (dwell < MIN_DWELL_MS) return
      const source = sourceForPath(path)
      const record = {
        key: `${source}|${path}|${startMs}`,
        source,
        filePath: path,
        title: readingTitleFromPathBlock(path),
        startMs,
        endMs,
        recordedAt: endMs,
      }
      // Fire-and-forget: the writer is module-level and serialized, so it
      // outlives this component's unmount.
      void appendReadingSession(getVaultFS(), record)
    }
  }, [path, enabled])
}
