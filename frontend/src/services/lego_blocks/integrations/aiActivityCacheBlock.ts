// Vault-backed cache for parsed Claude Code / Codex sessions.
//
// Three layers, fastest first:
//   1. Module-level in-memory snapshot (shared across every hook / component).
//      Returned instantly on subsequent calls — second mount is free.
//   2. On-disk JSON cache in the vault (survives app restarts; shared with the
//      Python script that uses the same parser).
//   3. Parse from the raw session markdown (only for files whose mtime changed
//      since the on-disk cache was written).
//
// Concurrent callers share the same in-flight load promise so the post-it
// hook and the activity panel never duplicate the vault walk.

import type { VaultFS, VaultEntry } from '@/services/lego_blocks/integrations/fsBlock'
import {
  parseSession,
  type ParsedSession,
} from '@/services/lego_blocks/units/aiActivityParserBlock'
import {
  listNativeAiSessions,
  loadAndParseNativeAiSession,
  nativeAiSourcesAvailable,
} from '@/services/lego_blocks/integrations/nativeAiSessionsBlock'
import { sessionIdOf } from '@/services/lego_blocks/units/nativeAiSessionParserBlock'

const CACHE_PATH = '.thinking-space/ai-activity-cache.json'
const CACHE_DIR = '.thinking-space'
const SOURCE_PREFIXES = ['ai_raw/raw/claude-code/', 'ai_raw/raw/codex/']
// v11: Anthropic cache-creation now splits by TTL (`cacheCreation1h`) so the
// cost math charges the 2.0x rate on 1-hour cache writes instead of treating
// everything as 1.25x 5-minute TTL. Existing v10 rows lack the field and
// would underbill 1h-heavy sessions — bump to reparse Claude transcripts.
const CACHE_VERSION = 11

/** How long to trust the in-memory snapshot before re-walking on the next load call. */
const MEM_TTL_MS = 5 * 60 * 1000
/** Max concurrent fs.read calls when re-parsing changed sessions. */
const READ_CONCURRENCY = 16

interface CacheFile {
  version: number
  /** Map of path -> parsed session, keyed by vault-relative path. */
  sessions: Record<string, ParsedSession>
  /** Unix-seconds timestamp when the cache was last written. */
  updatedAt: number
}

function emptyCache(): CacheFile {
  return { version: CACHE_VERSION, sessions: {}, updatedAt: 0 }
}

async function readCache(fs: VaultFS): Promise<CacheFile> {
  try {
    if (!(await fs.exists(CACHE_PATH))) return emptyCache()
    const raw = await fs.read(CACHE_PATH)
    const parsed = JSON.parse(raw) as CacheFile
    if (parsed.version !== CACHE_VERSION) return emptyCache()
    if (!parsed.sessions || typeof parsed.sessions !== 'object') return emptyCache()
    return parsed
  } catch {
    return emptyCache()
  }
}

async function writeCache(fs: VaultFS, cache: CacheFile): Promise<void> {
  try {
    if (!(await fs.exists(CACHE_DIR))) {
      await fs.mkdir(CACHE_DIR)
    }
    await fs.write(CACHE_PATH, JSON.stringify(cache))
  } catch {
    // Cache write failures are silent — next launch just re-parses.
  }
}

export interface LoadResult {
  sessions: ParsedSession[]
  /** Count of files re-parsed this load (0 means everything hit the cache). */
  reparsed: number
}

// ── Module-level snapshot ──────────────────────────────────────────────────
//
// _snapshot holds the most recent successful result. _inflight dedupes
// concurrent callers so a panel + a post-it hook + a refresh all share one
// vault walk.

let _snapshot: { result: LoadResult; ts: number } | null = null
let _inflight: Promise<LoadResult> | null = null

export function getCachedSnapshot(): LoadResult | null {
  return _snapshot?.result ?? null
}

export function clearAiActivitySnapshot(): void {
  _snapshot = null
  _inflight = null
}

async function runParallel<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  async function pull(): Promise<void> {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      out[i] = await worker(items[i], i)
    }
  }
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, () => pull())
  await Promise.all(lanes)
  return out
}

interface LoadOptions {
  /** Bypass the in-memory snapshot and force a fresh vault walk. */
  force?: boolean
}

async function performLoad(fs: VaultFS): Promise<LoadResult> {
  // ── 1. Discover the universe of session files across both source families ──
  // On non-Electron clients (iPhone/web) the native IPC isn't present, so
  // `listNativeAiSessions()` returns []. We still want the cached native
  // sessions (Electron wrote them, iCloud synced them) — handled in step 3
  // by carrying every cached native row through unchanged when the native
  // source isn't available locally.
  const nativeAvailable = nativeAiSourcesAvailable()
  const [vaultEntries, nativeEntries] = await Promise.all([
    fs.walkVault(['.md']),
    listNativeAiSessions(),
  ])

  const vaultSessions: VaultEntry[] = vaultEntries.filter(e =>
    SOURCE_PREFIXES.some(prefix => e.path.startsWith(prefix)),
  )

  const cache = await readCache(fs)
  const next: Record<string, ParsedSession> = {}
  const present = new Set<string>()
  let reparsed = 0

  // ── 2. Vault markdown — cached by relative vault path. ──────────────────────
  const vaultToParse: VaultEntry[] = []
  for (const entry of vaultSessions) {
    present.add(entry.path)
    const cached = cache.sessions[entry.path]
    if (cached && cached.mtime === entry.mtime) {
      next[entry.path] = cached
    } else {
      vaultToParse.push(entry)
    }
  }
  const vaultParsed = await runParallel(vaultToParse, READ_CONCURRENCY, async entry => {
    try {
      const text = await fs.read(entry.path)
      return parseSession({ path: entry.path, text, mtime: entry.mtime })
    } catch {
      return cache.sessions[entry.path] ?? null
    }
  })
  for (const s of vaultParsed) {
    if (!s) continue
    next[s.path] = s
    reparsed += 1
  }

  // ── 3. Native sessions — cached by `native/<source>/<relPath>` synthetic key.
  // One file can produce multiple window entries (`key`, `key#w1`, `key#w2`, …)
  // when there are long idle gaps. All windows from the same file share an
  // mtime, so on a cache hit we restore every sibling row for that key. ──
  const nativeToParse: typeof nativeEntries = []
  const cachedByFileKey = new Map<string, ParsedSession[]>()
  for (const [path, sess] of Object.entries(cache.sessions)) {
    if (!path.startsWith('native/')) continue
    const fileKey = path.split('#', 1)[0]
    const arr = cachedByFileKey.get(fileKey) ?? []
    arr.push(sess)
    cachedByFileKey.set(fileKey, arr)
  }
  if (!nativeAvailable) {
    // iPhone / web: no native IPC, so we can't list or re-parse native files.
    // Carry every cached native window through unchanged — Electron wrote
    // them, iCloud synced them to us. Without this, the prune step below
    // would treat all native entries as stale and the next writeCache would
    // wipe them from the shared cache, poisoning the next Electron launch.
    for (const [, windows] of cachedByFileKey) {
      for (const s of windows) {
        present.add(s.path)
        next[s.path] = s
      }
    }
  } else {
    for (const entry of nativeEntries) {
      const key = `native/${entry.source}/${entry.relPath}`
      const cachedWindows = cachedByFileKey.get(key) ?? []
      const fresh = cachedWindows.length > 0 && cachedWindows.every(s => s.mtime === entry.mtime)
      if (fresh) {
        for (const s of cachedWindows) {
          present.add(s.path)
          next[s.path] = s
        }
      } else {
        // Mark the base key present so a later prune step (if any) doesn't drop
        // the file just because its window suffixes haven't been written yet.
        present.add(key)
        nativeToParse.push(entry)
      }
    }
  }
  const nativeParsed = await runParallel(nativeToParse, READ_CONCURRENCY, async entry => {
    const parsed = await loadAndParseNativeAiSession(entry)
    if (parsed.length > 0) return parsed
    // Parse failure: fall back to whatever windows we have cached for this file.
    const key = `native/${entry.source}/${entry.relPath}`
    return cachedByFileKey.get(key) ?? []
  })
  for (const windows of nativeParsed) {
    for (const s of windows) {
      present.add(s.path)
      next[s.path] = s
    }
    if (windows.length > 0) reparsed += 1
  }

  // ── 4. Persist the merged cache (raw, pre-dedup). ───────────────────────────
  // Only Electron writes the cache — it's the only client that can actually
  // re-parse native files, so it's the source of truth. iPhone/web stays
  // read-only on the shared cache so it can't drop entries it can't verify.
  const stale = Object.keys(cache.sessions).filter(p => !present.has(p))
  if (nativeAvailable && (reparsed > 0 || stale.length > 0 || Object.keys(cache.sessions).length === 0)) {
    await writeCache(fs, {
      version: CACHE_VERSION,
      sessions: next,
      updatedAt: Math.floor(Date.now() / 1000),
    })
  }

  // ── 5. Dedupe before returning to consumers. ────────────────────────────────
  // For each session id (full UUID for native, 8-char short id for vault),
  // prefer the richer native record when both exist — it has explicit cwd,
  // millisecond timestamps, and the full sessionId.
  const all = Object.values(next)
  const byId = new Map<string, ParsedSession>()
  for (const s of all) {
    const id = sessionIdOf(s)
    // Normalize vault short ids onto the matching native UUID prefix when
    // we have one, so the same session collapses into one entry.
    const normalizedId = id.length === 8
      ? findUuidByPrefix(all, id) ?? id
      : id
    const existing = byId.get(normalizedId)
    if (!existing) {
      byId.set(normalizedId, s)
      continue
    }
    // Prefer native (path starts with "native/"). If both same type, keep the
    // one with the higher userMsgCount (more complete).
    const existingIsNative = existing.path.startsWith('native/')
    const candidateIsNative = s.path.startsWith('native/')
    if (candidateIsNative && !existingIsNative) {
      byId.set(normalizedId, s)
    } else if (candidateIsNative === existingIsNative && s.userMsgCount > existing.userMsgCount) {
      byId.set(normalizedId, s)
    }
  }

  const sessions = [...byId.values()].sort(
    (a, b) => Date.parse(a.startedIso) - Date.parse(b.startedIso),
  )
  return { sessions, reparsed }
}

function findUuidByPrefix(sessions: ParsedSession[], short: string): string | null {
  for (const s of sessions) {
    const id = sessionIdOf(s)
    if (id.length > 8 && id.startsWith(short)) return id
  }
  return null
}

/**
 * Load all session activity from the vault, using both an in-memory snapshot
 * and the on-disk JSON cache. Safe to call from many hooks at once — concurrent
 * callers share one in-flight load.
 */
export async function loadAiActivity(
  fs: VaultFS,
  options: LoadOptions = {},
): Promise<LoadResult> {
  const { force = false } = options

  if (!force && _snapshot) {
    const age = Date.now() - _snapshot.ts
    if (age < MEM_TTL_MS) return _snapshot.result
  }

  if (!force && _inflight) return _inflight

  if (force) {
    _snapshot = null
    _inflight = null
  }

  const promise = performLoad(fs).then(result => {
    _snapshot = { result, ts: Date.now() }
    _inflight = null
    return result
  }).catch(err => {
    _inflight = null
    throw err
  })

  _inflight = promise
  return promise
}
