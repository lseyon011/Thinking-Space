// Reconstruct AI activity sessions from `~/.claude/history.jsonl`.
//
// Claude Code's `cleanupPeriodDays` (default 30) deletes full transcripts from
// ~/.claude/projects, but history.jsonl is a permanent append-only prompt log:
// one line per user prompt with `{display, timestamp(ms), project(cwd),
// sessionId}`. When a transcript is gone, we can still rebuild a faithful
// skeleton: prompt count, project (from cwd), topic (first prompt), and a
// rough time window (first→last prompt). No tokens, model, or assistant turns
// — sessions are flagged `reconstructed` so the UI can disclose that.
//
// Used as the LOWEST-priority source: the cache layer drops any reconstructed
// session whose sessionId is covered by a real native or vault transcript.

import type { ParsedSession } from '@/services/lego_blocks/units/aiActivityParserBlock'
import { autoInferProjectFromPathBlock } from '@/services/lego_blocks/units/aiActivityMappingBlock'

interface HistoryEntry {
  ts: number // unix ms
  display: string
  cwd: string
}

/** Same idle threshold as the native transcript parser: a 1h+ silence between
 *  prompts splits one sessionId into multiple activity windows. */
const WINDOW_GAP_MS = 3_600_000

function isSlashCommand(display: string): { is: boolean; name?: string } {
  const trimmed = display.trim()
  if (/^\/[a-z][\w:-]*(\s|$)/i.test(trimmed)) {
    return { is: true, name: trimmed.split(/\s/, 1)[0] }
  }
  return { is: false }
}

/**
 * Parse the full history.jsonl text into reconstructed ParsedSessions, one per
 * activity window per sessionId. Paths are `history/claude/<sessionId>` with
 * `#wN` suffixes for later windows, mirroring the native parser's scheme.
 */
export function parseClaudeHistoryBlock(text: string, mtime: number): ParsedSession[] {
  const bySession = new Map<string, HistoryEntry[]>()
  for (const raw of text.split('\n')) {
    if (!raw) continue
    let evt: Record<string, unknown>
    try {
      evt = JSON.parse(raw) as Record<string, unknown>
    } catch {
      continue
    }
    const sessionId = typeof evt.sessionId === 'string' ? evt.sessionId.toLowerCase() : ''
    const ts = typeof evt.timestamp === 'number' && Number.isFinite(evt.timestamp)
      ? evt.timestamp
      : NaN
    if (!sessionId || !Number.isFinite(ts)) continue
    const entry: HistoryEntry = {
      ts,
      display: typeof evt.display === 'string' ? evt.display : '',
      cwd: typeof evt.project === 'string' ? evt.project : '',
    }
    const arr = bySession.get(sessionId)
    if (arr) arr.push(entry)
    else bySession.set(sessionId, [entry])
  }

  const out: ParsedSession[] = []
  for (const [sessionId, entries] of bySession) {
    entries.sort((a, b) => a.ts - b.ts)

    const windows: HistoryEntry[][] = []
    let cur: HistoryEntry[] = []
    for (const e of entries) {
      if (cur.length > 0 && e.ts - cur[cur.length - 1].ts > WINDOW_GAP_MS) {
        windows.push(cur)
        cur = []
      }
      cur.push(e)
    }
    if (cur.length > 0) windows.push(cur)

    const basePath = `history/claude/${sessionId}`
    windows.forEach((win, idx) => {
      let substantiveTopic = ''
      let fallbackTopic = ''
      let hadClear = false
      const cwd = win.find(e => e.cwd)?.cwd ?? ''
      for (const e of win) {
        const body = e.display.trim()
        if (!body) continue
        const slash = isSlashCommand(body)
        if (slash.is) {
          if (slash.name === '/clear') hadClear = true
          if (!fallbackTopic && slash.name) fallbackTopic = `[${slash.name}]`
          continue
        }
        if (!substantiveTopic) substantiveTopic = body.split('\n')[0].slice(0, 140)
      }

      const isFirst = idx === 0
      out.push({
        path: isFirst ? basePath : `${basePath}#w${idx}`,
        source: 'claude-code',
        startedIso: new Date(win[0].ts).toISOString(),
        endedIso: new Date(win[win.length - 1].ts).toISOString(),
        project: (cwd && autoInferProjectFromPathBlock(cwd)) || '<unknown>',
        cwd: cwd || undefined,
        userMsgCount: win.length,
        topic: substantiveTopic || fallbackTopic || '(no user message)',
        hadClear,
        mtime,
        sessionId: isFirst ? sessionId : `${sessionId}::w${idx}`,
        reconstructed: true,
      })
    })
  }
  return out
}
