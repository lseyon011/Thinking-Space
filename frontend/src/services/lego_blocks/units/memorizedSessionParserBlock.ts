// Convert per-note `memorized_sessions` YAML frontmatter into the shared
// ParsedSession shape so memorization flows through the same chain / totals /
// trend / heatmap / digest pipeline as AI and reading sessions.
//
// Unlike GoodNotes (harvested into a durable JSONL) the memorization data is
// already first-party and durable: it lives in each note's YAML and is indexed
// into IndexedDB by the vault sync. So there's no harvester here — the loader
// reads the indexed nodes and this block maps them. The note title is the
// bucket, so the panel groups memorization per-thing-memorized.

import type { ParsedSession } from '@/services/lego_blocks/units/aiActivityParserBlock'
import {
  normalizeMemorizedSessions,
  type MemorizedSession,
} from '@/services/lego_blocks/units/memorizedSessionsBlock'

/** A memorized note as surfaced from the node index: its title, vault path, and
 *  the raw `memorized_sessions` frontmatter value (normalized downstream). */
export interface MemorizedNote {
  title: string
  filePath: string
  rawSessions: unknown
}

// A memorization sitting left open (timer never stopped) can report a huge
// span. Cap it so one forgotten session doesn't dwarf a week of real practice
// on the charts — same rationale as the GoodNotes reading cap.
const MAX_SESSION_MS = 4 * 3_600_000 // 4h

/** Local-noon anchor for legacy date-only entries that carry no timestamps.
 *  Gives them a stable position on the day without pretending to a wall-clock
 *  time we don't have (start === end, so they count as a session but add no
 *  duration). */
function noonMs(dateIso: string): number {
  const t = Date.parse(dateIso + 'T12:00:00')
  return Number.isFinite(t) ? t : NaN
}

function titleBucket(note: MemorizedNote): string {
  const t = (note.title ?? '').trim()
  if (t) return t
  const base = note.filePath.split('/').pop() ?? note.filePath
  return base.replace(/\.md$/i, '').trim() || note.filePath
}

/** Convert one memorized session entry into a ParsedSession. Returns null when
 *  there's no usable date/timestamp. */
export function memorizedSessionToParsed(
  note: MemorizedNote,
  session: MemorizedSession,
  index: number,
): ParsedSession | null {
  const startMs = session.startedAt ? Date.parse(session.startedAt) : noonMs(session.date)
  if (!Number.isFinite(startMs) || startMs <= 0) return null
  const endRaw = session.endedAt ? Date.parse(session.endedAt) : startMs
  const dur = Math.min(Math.max(0, (Number.isFinite(endRaw) ? endRaw : startMs) - startMs), MAX_SESSION_MS)
  const bucket = titleBucket(note)
  return {
    // Synthetic, stable, collision-free path under the memorized family. The
    // index disambiguates multiple sittings recorded on the same note.
    path: `memorized/${note.filePath}#${index}`,
    source: 'memorized',
    startedIso: new Date(startMs).toISOString(),
    endedIso: new Date(startMs + dur).toISOString(),
    project: bucket,
    userMsgCount: 1,
    topic: bucket,
    hadClear: false,
    mtime: Math.floor(startMs / 1000),
    sessionId: `memorized/${note.filePath}#${index}`,
  }
}

/** Map all memorized notes to ParsedSessions, skipping unusable entries. */
export function parseMemorizedNotes(notes: MemorizedNote[]): ParsedSession[] {
  const out: ParsedSession[] = []
  for (const note of notes) {
    const sessions = normalizeMemorizedSessions(note.rawSessions)
    sessions.forEach((session, i) => {
      const parsed = memorizedSessionToParsed(note, session, i)
      if (parsed) out.push(parsed)
    })
  }
  return out
}
