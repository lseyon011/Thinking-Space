// Convert harvested GoodNotes reading records (from the durable vault JSONL) into
// the shared ParsedSession shape so reading flows through the same chain /
// totals / trend / heatmap / digest pipeline as AI coding sessions.
//
// Each record is one document edit/reading session with a true wall-clock start
// and an open-duration (see electron goodnotesReadingBlock). We bucket every
// session under its (cleaned) document title so the panel groups reading
// per-book — "Norwegian Wood — 2h this week" is the whole point of the feature.
// The `goodnotes` source tag drives the "Reading" pill; title cleaning is done
// here (not at harvest time) so it's tweakable without re-harvesting.

import type { ParsedSession } from '@/services/lego_blocks/units/aiActivityParserBlock'

export interface GoodnotesReadingRecord {
  key: string
  documentId: string
  /** Raw fts.sqlite document name. May be '' when fts had no row. */
  title: string
  /** Wall-clock session end, epoch ms. */
  timeMs: number
  /** Session open-duration in ms. */
  durationMs: number
  numPage: number
  documentType: string
  harvestedAt: number
  /** The document's latest fts.sqlite `last_modified`, epoch ms — i.e. the last
   *  time an annotation/edit touched the file. Absent on older records. Used by
   *  the annotation gate to tell real reading (file was marked up) from an idle
   *  document-open session (no edit, so this stays before the session day). */
  docModifiedMs?: number
}

// Reading-session durations from GoodNotes' "document open" telemetry can be
// huge (a book left open for hours). Cap the per-session duration so one
// forgotten-open document doesn't dwarf a week of real reading on the charts.
const MAX_SESSION_MS = 4 * 3_600_000 // 4h

// Publisher keywords used to gate the trailing "- <Publisher>" strip. Gating on
// these (rather than any trailing "- Words") is deliberate: an ungated rule ate
// real titles like "F9 - Launches" → "F9" and "... - Norwegian Wood" → author.
const PUBLISHER_KEYWORDS =
  /\b(press|books?|publish(?:ing|ers?)|house|verlag|editions?|classics|library|ltd|inc|co|wiley|penguin|vintage|routledge|springer|norton|harpercollins|bloomsbury|macmillan|profile)\b/i

/**
 * Clean a raw fts.sqlite document name into a readable book/title bucket, e.g.
 *   "Murakami, Haruki - Norwegian Wood (2000, Random House) - libgen.li.pdf"
 *     → "Norwegian Wood"
 * Conservative and order-sensitive: strips known noise (extension, library-dump
 * tags, a leading "Surname, First - " author prefix, a trailing "(year …)"
 * paren, and a trailing "- <Publisher>" ONLY when it carries a publisher
 * keyword) but never invents text and never strips an un-gated trailing dash
 * segment (which could be the real title/subtitle). Falls back to the
 * documentId tail when there's no usable name.
 */
export function cleanReadingTitleBlock(rawTitle: string, documentId: string): string {
  let t = (rawTitle ?? '').trim()
  if (!t) return `Document ${documentId.slice(0, 8)}`

  // 1. Drop a file extension.
  t = t.replace(/\.(pdf|epub|goodnotes|note|docx?|txt)$/i, '').trim()
  // 2. Drop common library-dump tags and everything after them.
  t = t.replace(/\s*[-–—|]?\s*(libgen(\.\w+)?|z-?lib(\.\w+)?|annas?[-\s]?archive|sci-?hub)\b.*$/i, '').trim()
  // 3. Strip a leading "Surname, First - " author prefix — BEFORE any trailing
  //    strip, so the separator it needs isn't consumed first.
  const authorPrefix = /^[A-Z][\w.'’-]+,\s+[A-Z][\w.'’\s-]*?\s+[-–—]\s+(?=\S)/u
  if (authorPrefix.test(t)) t = t.replace(authorPrefix, '').trim()
  // 4. Normalise underscores-as-spaces so glued separators (e.g. "is_-Profile")
  //    become visible to the publisher strip below.
  t = t.replace(/[_]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  // 5. Drop a trailing "(2015, Publisher)" / "(2000)" metadata paren.
  t = t.replace(/\s*\((?:\d{4}|[^()]*\b\d{4}\b[^()]*)\)\s*$/g, '').trim()
  // 6. Drop a trailing "- <Publisher>" tail, gated on a publisher keyword.
  const trailing = /\s*[-–—]\s*([^-–—]{2,40})$/u.exec(t)
  if (trailing && PUBLISHER_KEYWORDS.test(trailing[1])) {
    t = t.slice(0, trailing.index).trim()
  }
  // 7. Final tidy: collapse whitespace, trim dangling separators.
  t = t.replace(/\s{2,}/g, ' ').replace(/^[-–—|,\s]+|[-–—|,\s]+$/g, '').trim()

  if (!t) return `Document ${documentId.slice(0, 8)}`
  return t.length > 80 ? t.slice(0, 79).trim() + '…' : t
}

/** Convert one durable reading record into a ParsedSession. Returns null for
 *  records with no usable timestamp. */
export function readingRecordToSession(rec: GoodnotesReadingRecord): ParsedSession | null {
  const startMs = rec.timeMs - Math.max(0, rec.durationMs)
  if (!Number.isFinite(startMs) || startMs <= 0) return null
  const dur = Math.min(Math.max(0, rec.durationMs), MAX_SESSION_MS)
  const title = cleanReadingTitleBlock(rec.title, rec.documentId)
  const startedIso = new Date(startMs).toISOString()
  const endedIso = new Date(startMs + dur).toISOString()
  return {
    // Synthetic, stable, collision-free path under the goodnotes family.
    path: `goodnotes/${rec.key}`,
    source: 'goodnotes',
    startedIso,
    endedIso,
    // Per-book bucket — the cleaned title is the project so chips/heatmap/trend
    // group reading by what was read.
    project: title,
    // Pages read is the natural unit for reading; feeds the "msgs" stat + the
    // project ranking. Min 1 so a zero-page record still counts as a session.
    userMsgCount: Math.max(1, Math.round(rec.numPage) || 1),
    topic: title,
    hadClear: false,
    mtime: rec.harvestedAt || Math.floor(startMs / 1000),
    sessionId: rec.key,
  }
}

export interface ParseGoodnotesOptions {
  /** When true, drop duration-bearing sessions whose day falls AFTER the
   *  document's last annotation (fts modification). Filters idle document-open
   *  sessions for readers who always mark up what they read. Default false. */
  annotationGate?: boolean
}

const dayKeyMs = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Parse the full durable JSONL log into ParsedSessions, newest-friendly order
 *  left to the caller's pipeline (buildChains sorts). Skips unparseable rows. */
export function parseGoodnotesReadingLog(
  records: GoodnotesReadingRecord[],
  opts: ParseGoodnotesOptions = {},
): ParsedSession[] {
  // A real, duration-bearing session (from the Amplitude queue) always wins over
  // a duration-less fts "touch" for the same document on the same day. This is
  // the authoritative guard against double-counting a day we have an accurate
  // session for, regardless of the order the two sources landed in the log.
  const dayOf = (rec: GoodnotesReadingRecord) =>
    `${rec.documentId}|${dayKeyMs(rec.timeMs)}`
  const coveredByRealSession = new Set<string>()
  for (const rec of records) {
    if (rec.durationMs > 0) coveredByRealSession.add(dayOf(rec))
  }

  // Annotation gate: the document's last-modified day. Two sources, strongest
  // first — the record's own `docModifiedMs` stamp (harvester-supplied), else the
  // newest fts "touch" (duration 0) day seen for that doc in the log. A touch IS
  // an annotation, so its day is a known modification day.
  const lastModifiedDay = new Map<string, string>()
  if (opts.annotationGate) {
    const bump = (docId: string, day: string) => {
      const prev = lastModifiedDay.get(docId)
      if (!prev || day > prev) lastModifiedDay.set(docId, day)
    }
    for (const rec of records) {
      if (typeof rec.docModifiedMs === 'number' && rec.docModifiedMs > 0) {
        bump(rec.documentId, dayKeyMs(rec.docModifiedMs))
      }
      if (rec.durationMs <= 0) bump(rec.documentId, dayKeyMs(rec.timeMs))
    }
  }

  const out: ParsedSession[] = []
  for (const rec of records) {
    if (rec.durationMs <= 0 && coveredByRealSession.has(dayOf(rec))) continue
    // Idle-open filter: a duration-bearing session dated strictly after the
    // document's last annotation never marked up the file, so it's an
    // open-and-idle session, not reading. Keep when we have no modification
    // signal at all (can't gate on missing data).
    if (opts.annotationGate && rec.durationMs > 0) {
      const modDay = lastModifiedDay.get(rec.documentId)
      if (modDay && dayKeyMs(rec.timeMs) > modDay) continue
    }
    const s = readingRecordToSession(rec)
    if (s) out.push(s)
  }
  return out
}
