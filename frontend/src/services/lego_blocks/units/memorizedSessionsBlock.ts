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

/**
 * Append a memorization session by editing ONLY the `memorized_sessions` list in
 * the frontmatter — every other byte of the file (key order, quoting, comments,
 * spacing) is preserved. This is the path the ruled-notebook auto-recorder uses,
 * since it writes on every qualifying open and must never reflow a note.
 *
 * Returns the rewritten content, or null when there's no frontmatter to update.
 * Handles the shapes the app actually produces — key absent, an existing block
 * list, or an inline empty `[]` — and falls back to the full-reflow writer only
 * for an exotic inline non-empty flow value (which Thinking Space never emits).
 */
export function appendMemorizedSessionInPlace(
  content: string,
  startedAt: Date,
  endedAt: Date = new Date(),
): string | null {
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(/\r?\n/)

  // Locate the leading frontmatter fences.
  let open = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '') continue
    if (lines[i].trim() === '---') { open = i; break }
    return null
  }
  if (open === -1) return null
  let close = -1
  for (let i = open + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') { close = i; break }
  }
  if (close === -1) return null

  const date = todayIsoDate(startedAt)
  const startedIso = startedAt.toISOString()
  const endedIso = endedAt.toISOString()
  const buildItem = (itemIndent: number): string[] => {
    const pad = ' '.repeat(itemIndent)
    const childPad = ' '.repeat(itemIndent + 2)
    return [
      `${pad}- date: "${date}"`,
      `${childPad}started_at: "${startedIso}"`,
      `${childPad}ended_at: "${endedIso}"`,
    ]
  }

  // Find the key line inside the frontmatter.
  let keyIdx = -1
  for (let i = open + 1; i < close; i += 1) {
    if (/^\s*memorized_sessions\s*:/.test(lines[i])) { keyIdx = i; break }
  }

  if (keyIdx === -1) {
    // Key absent — insert a fresh block right before the closing fence.
    lines.splice(close, 0, 'memorized_sessions:', ...buildItem(2))
    return lines.join(eol)
  }

  const keyLine = lines[keyIdx]
  const keyIndent = keyLine.match(/^(\s*)/)?.[1].length ?? 0
  const afterColon = keyLine.slice(keyLine.indexOf(':') + 1).trim()

  // An inline non-empty flow value (e.g. `[{...}]`) is too risky to splice; the
  // app never writes this, so reflow just that case via the full writer.
  if (afterColon && afterColon !== '[]') {
    return appendMemorizedSession(content, startedAt, endedAt)
  }

  // Walk the block value: blank lines or anything indented deeper than the key.
  let blockEnd = keyIdx + 1
  let detectedItemIndent = -1
  for (let i = keyIdx + 1; i < close; i += 1) {
    const ln = lines[i]
    if (ln.trim() === '') { blockEnd = i + 1; continue }
    const indent = ln.match(/^(\s*)/)?.[1].length ?? 0
    if (indent <= keyIndent) break
    if (detectedItemIndent === -1 && /^\s*-\s/.test(ln)) detectedItemIndent = indent
    blockEnd = i + 1
  }
  const itemIndent = detectedItemIndent !== -1 ? detectedItemIndent : keyIndent + 2

  // Normalize an inline empty `[]` into a block key so the item is valid YAML.
  if (afterColon === '[]') {
    lines[keyIdx] = `${' '.repeat(keyIndent)}memorized_sessions:`
  }

  // Attach to the last real entry, not after a trailing blank gap.
  let insertAt = blockEnd
  while (insertAt > keyIdx + 1 && lines[insertAt - 1].trim() === '') insertAt -= 1

  lines.splice(insertAt, 0, ...buildItem(itemIndent))
  return lines.join(eol)
}
