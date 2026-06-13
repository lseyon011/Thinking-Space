// Convert in-app reading/drawing dwell records (TS markdown + Excalidraw) into
// the shared ParsedSession shape so they flow through the same chain / totals /
// trend / heatmap / digest pipeline as AI and other reading sessions.
//
// These are first-party: the markdown/excalidraw viewers emit one record per
// sitting once the document has been open past a dwell threshold (see
// useReadingDwellBlock), appended to a durable vault JSONL. The document title
// is the bucket so the panel groups by what was read/drawn. The record's own
// `source` ('reading-md' | 'reading-draw') drives the sub-source pill.

import type {
  ActivitySource,
  ParsedSession,
} from '@/services/lego_blocks/units/aiActivityParserBlock'

export type ThinkingspaceReadingSource = Extract<ActivitySource, 'reading-md' | 'reading-draw'>

export interface ThinkingspaceReadingRecord {
  /** Unique, idempotent key: `${source}|${filePath}|${startMs}`. */
  key: string
  source: ThinkingspaceReadingSource
  /** Vault-relative path of the document read/drawn. */
  filePath: string
  /** Display title (best-effort, derived from the filename at emit time). */
  title: string
  /** Wall-clock session start, epoch ms. */
  startMs: number
  /** Wall-clock session end, epoch ms. */
  endMs: number
  /** When the record was appended, epoch ms. */
  recordedAt: number
}

// Cap a single sitting so a document left open all day (timer never stopped)
// doesn't dwarf real activity on the charts — same rationale as GoodNotes.
const MAX_SESSION_MS = 4 * 3_600_000 // 4h

/** Derive a readable title from a vault path, stripping the markdown/excalidraw
 *  extensions. Used at emit time when no better title is on hand. */
export function readingTitleFromPathBlock(filePath: string): string {
  const base = filePath.split('/').pop() ?? filePath
  return base.replace(/\.excalidraw\.md$/i, '').replace(/\.(excalidraw|md)$/i, '').trim() || filePath
}

/** Convert one dwell record into a ParsedSession. Returns null for unusable
 *  timestamps. */
export function readingRecordToSession(rec: ThinkingspaceReadingRecord): ParsedSession | null {
  const startMs = rec.startMs
  if (!Number.isFinite(startMs) || startMs <= 0) return null
  const dur = Math.min(Math.max(0, rec.endMs - startMs), MAX_SESSION_MS)
  const title = (rec.title ?? '').trim() || readingTitleFromPathBlock(rec.filePath)
  return {
    path: `${rec.source}/${rec.filePath}#${startMs}`,
    source: rec.source,
    startedIso: new Date(startMs).toISOString(),
    endedIso: new Date(startMs + dur).toISOString(),
    project: title,
    userMsgCount: 1,
    topic: title,
    hadClear: false,
    mtime: Math.floor((rec.recordedAt || startMs) / 1000),
    sessionId: rec.key,
  }
}

export function parseThinkingspaceReadingLog(
  records: ThinkingspaceReadingRecord[],
): ParsedSession[] {
  const out: ParsedSession[] = []
  for (const rec of records) {
    const s = readingRecordToSession(rec)
    if (s) out.push(s)
  }
  return out
}
