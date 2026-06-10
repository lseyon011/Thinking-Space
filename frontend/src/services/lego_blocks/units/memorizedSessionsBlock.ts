import { parseNote, stringifyNote } from '@/services/lego_blocks/units/yamlNoteBlock'

export function todayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface MemorizedSession {
  /** Local calendar date (YYYY-MM-DD) the session started on. */
  date: string
  /** ISO timestamp — absent on legacy date-only entries. */
  startedAt?: string
  endedAt?: string
}

/**
 * Normalize a raw `memorized_sessions` frontmatter value. Legacy entries are
 * bare YYYY-MM-DD strings; current entries are objects with start/end
 * timestamps. Anything else is dropped.
 */
export function normalizeMemorizedSessions(raw: unknown): MemorizedSession[] {
  if (!Array.isArray(raw)) return []
  const out: MemorizedSession[] = []
  for (const entry of raw) {
    if (typeof entry === 'string') {
      out.push({ date: entry })
    } else if (entry && typeof entry === 'object') {
      const rec = entry as Record<string, unknown>
      if (typeof rec.date !== 'string') continue
      out.push({
        date: rec.date,
        startedAt: typeof rec.started_at === 'string' ? rec.started_at : undefined,
        endedAt: typeof rec.ended_at === 'string' ? rec.ended_at : undefined,
      })
    }
  }
  return out
}

export function readMemorizedSessions(content: string): MemorizedSession[] {
  const note = parseNote(content)
  if (!note) return []
  return normalizeMemorizedSessions(note.frontmatter.memorized_sessions)
}

/**
 * Append a memorization session with start/end timestamps to
 * `memorized_sessions` and return the rewritten file content. Every session
 * gets its own entry (multiple per day allowed). Existing legacy date-string
 * entries are preserved as-is. Returns null when the file has no YAML
 * frontmatter to update.
 */
export function appendMemorizedSession(
  content: string,
  startedAt: Date,
  endedAt: Date = new Date(),
): string | null {
  const note = parseNote(content)
  if (!note) return null

  const existing = Array.isArray(note.frontmatter.memorized_sessions)
    ? note.frontmatter.memorized_sessions
    : []

  note.frontmatter.memorized_sessions = [
    ...existing,
    {
      date: todayIsoDate(startedAt),
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
    },
  ]
  return stringifyNote(note)
}
