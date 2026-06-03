// Tracks recent file writes initiated by this app so the fs-watcher driven
// vault sync can ignore events it caused itself. Without this, every save
// from inside the app (markdown editor, capability runner, webull writer,
// auto-heal rewrites) bounces back as a chokidar event and triggers a full
// incremental sync — death by feedback loop on chatty paths.
//
// Bounded ring buffer; entries expire after WINDOW_MS. Older entries get
// trimmed on access so we never pay GC cost on the write path.

const WINDOW_MS = 3000
const MAX_ENTRIES = 256

const recentWrites = new Map<string, number>()

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function prune(now: number): void {
  if (recentWrites.size <= MAX_ENTRIES) {
    // Cheap pass: drop only expired entries when under the cap.
    for (const [path, ts] of recentWrites) {
      if (now - ts > WINDOW_MS) recentWrites.delete(path)
    }
    return
  }
  // Over cap: drop expired + oldest until back under.
  const entries = [...recentWrites.entries()].sort((a, b) => a[1] - b[1])
  for (const [path, ts] of entries) {
    if (recentWrites.size <= MAX_ENTRIES && now - ts <= WINDOW_MS) break
    recentWrites.delete(path)
  }
}

export function recordSelfWriteBlock(filePath: string): void {
  const normalized = normalizePath(filePath)
  if (!normalized) return
  const now = Date.now()
  recentWrites.set(normalized, now)
  prune(now)
}

export function wasRecentSelfWriteBlock(filePath: string, withinMs: number = WINDOW_MS): boolean {
  const normalized = normalizePath(filePath)
  if (!normalized) return false
  const ts = recentWrites.get(normalized)
  if (ts === undefined) return false
  const now = Date.now()
  if (now - ts > withinMs) {
    recentWrites.delete(normalized)
    return false
  }
  return true
}

/** Test-only: wipe the tracker. */
export function resetSelfWriteTrackerBlock(): void {
  recentWrites.clear()
}
