// Durable store + loader for in-app reading/drawing sessions (TS markdown +
// Excalidraw). The markdown/excalidraw viewers call appendReadingSession once a
// sitting crosses the dwell threshold; the AI activity pipeline reads the log
// back via loadThinkingspaceReadingSessions. The log lives in the vault and
// syncs, so iPhone/web see the same sessions.

import type { VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import type { ParsedSession } from '@/services/lego_blocks/units/aiActivityParserBlock'
import {
  parseThinkingspaceReadingLog,
  type ThinkingspaceReadingRecord,
} from '@/services/lego_blocks/units/thinkingspaceReadingParserBlock'

const READING_DIR = 'ai_raw/raw/thinkingspace'
const READING_LOG_PATH = `${READING_DIR}/reading.jsonl`

function parseLogText(text: string): ThinkingspaceReadingRecord[] {
  const out: ThinkingspaceReadingRecord[] = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      out.push(JSON.parse(t) as ThinkingspaceReadingRecord)
    } catch {
      // Skip a corrupt line rather than dropping the whole log.
    }
  }
  return out
}

async function ensureReadingDir(fs: VaultFS): Promise<void> {
  // mkdir each segment progressively; ignore "already exists". Cheap and avoids
  // assuming a recursive mkdir.
  const segments = READING_DIR.split('/')
  let prefix = ''
  for (const seg of segments) {
    prefix = prefix ? `${prefix}/${seg}` : seg
    try {
      if (!(await fs.exists(prefix))) await fs.mkdir(prefix)
    } catch {
      // Concurrent create or already-exists — fine.
    }
  }
}

// Appends are read-modify-write (VaultFS has no atomic append), so serialize
// them through a module-level promise chain. Two near-simultaneous document
// closes then can't clobber each other's line.
let _writeChain: Promise<void> = Promise.resolve()

/**
 * Append one reading session to the durable log, deduped by key (idempotent —
 * a repeated emit for the same sitting is a no-op). Best-effort: swallows all
 * errors so a logging failure never disrupts the viewer.
 */
export async function appendReadingSession(
  fs: VaultFS,
  record: ThinkingspaceReadingRecord,
): Promise<void> {
  _writeChain = _writeChain.then(async () => {
    try {
      let existingText = ''
      if (await fs.exists(READING_LOG_PATH)) {
        existingText = await fs.read(READING_LOG_PATH)
      } else {
        await ensureReadingDir(fs)
      }
      const existing = parseLogText(existingText)
      if (existing.some(r => r.key === record.key)) return
      const line = JSON.stringify(record)
      const next = existingText && !existingText.endsWith('\n')
        ? `${existingText}\n${line}\n`
        : `${existingText}${line}\n`
      await fs.write(READING_LOG_PATH, next)
    } catch {
      // Logging is best-effort; never throw into the caller.
    }
  })
  return _writeChain
}

/**
 * Load in-app reading/drawing sessions from the durable vault log. Returns []
 * when nothing has been logged yet.
 */
export async function loadThinkingspaceReadingSessions(fs: VaultFS): Promise<ParsedSession[]> {
  try {
    if (!(await fs.exists(READING_LOG_PATH))) return []
    const text = await fs.read(READING_LOG_PATH)
    return parseThinkingspaceReadingLog(parseLogText(text))
  } catch {
    return []
  }
}
