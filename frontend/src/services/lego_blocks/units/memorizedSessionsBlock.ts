import { parseNote, stringifyNote } from '@/services/lego_blocks/units/yamlNoteBlock'

export function todayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function readMemorizedSessions(content: string): string[] {
  const note = parseNote(content)
  if (!note) return []
  const raw = note.frontmatter.memorized_sessions
  if (!Array.isArray(raw)) return []
  return raw.filter((v): v is string => typeof v === 'string')
}

/**
 * Append today's date to `memorized_sessions` and return the rewritten file
 * content. Returns null when the date is already present (no-op) or when the
 * file has no YAML frontmatter to update.
 */
export function appendTodayMemorizedSession(
  content: string,
  now: Date = new Date(),
): string | null {
  const note = parseNote(content)
  if (!note) return null

  const today = todayIsoDate(now)
  const existing = Array.isArray(note.frontmatter.memorized_sessions)
    ? note.frontmatter.memorized_sessions.filter((v): v is string => typeof v === 'string')
    : []

  if (existing.includes(today)) return null

  note.frontmatter.memorized_sessions = [...existing, today]
  return stringifyNote(note)
}
