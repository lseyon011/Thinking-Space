// Parse a Claude Code or Codex JSONL transcript (from the native CLI session
// stores under ~/.claude/projects or ~/.codex/sessions) into our shared
// ParsedSession shape.
//
// Both formats are JSONL — one JSON object per line. Differences:
//   - Claude Code: every event carries `cwd`, `sessionId`, `timestamp`, plus
//     `type: "user" | "assistant" | "file-history-snapshot" | ...`. User events
//     have `message.content` (string or array of typed blocks).
//   - Codex: first line is `type: "session_meta"` with `payload.{id,cwd,timestamp}`.
//     Subsequent events have `type: "response_item" | "event_msg" | ...` and a
//     `payload` whose `role` indicates user/assistant when applicable.
//
// We classify project directly from `cwd` (no heuristics needed — cwd is gold).

import type {
  ActivitySource,
  ParsedSession,
  SessionTokens,
} from '@/services/lego_blocks/units/aiActivityParserBlock'

export type NativeSource = 'claude' | 'codex'

const PERSONAL_GIT_RE = /\/PersonalGit\/([A-Za-z0-9_.-]+)/
const NESTED_RES: ReadonlyArray<{ root: string; re: RegExp }> = [
  { root: 'acceleration_core', re: /acceleration_core\/([A-Za-z0-9_.-]+)/ },
  { root: 'lifeblood_systems', re: /lifeblood_systems\/([A-Za-z0-9_.-]+)/ },
  { root: 'operations', re: /operations\/([A-Za-z0-9_.-]+)/ },
]
const VAULT_TOPLEVEL_RE = /Long-Term-Memory-iCloud\/([A-Za-z0-9_.-]+)/
const VAULT_INFRA_NAMES = new Set([
  '.cache', '.git', '.obsidian', '.thinking-space', '.trash',
  'AGENTS.md', 'CLAUDE.md', 'README.md',
])
const VAULT_TOPLEVEL_SKIP = new Set([
  'acceleration_core', 'lifeblood_systems', 'operations',
])

/** Classify an absolute cwd path into a project bucket. */
function classifyCwd(cwd: string): string {
  if (!cwd) return '<unknown>'
  const pg = PERSONAL_GIT_RE.exec(cwd)
  if (pg) return pg[1]
  for (const { re } of NESTED_RES) {
    const m = re.exec(cwd)
    if (m) return `LTM/${m[1]}`
  }
  const tl = VAULT_TOPLEVEL_RE.exec(cwd)
  if (tl && !VAULT_TOPLEVEL_SKIP.has(tl[1]) && !VAULT_INFRA_NAMES.has(tl[1])) {
    return `LTM/${tl[1]}`
  }
  if (/Long-Term-Memory-iCloud/.test(cwd)) return 'LTM'
  return '<unknown>'
}

function numericField(obj: Record<string, unknown>, key: string): number {
  const v = obj[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** Pull the displayable string content out of a Claude user message, which can
 *  be either a plain string or an array of typed content blocks. */
function flattenClaudeContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (typeof block === 'string') {
      parts.push(block)
    } else if (block && typeof block === 'object') {
      const b = block as Record<string, unknown>
      if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
      // skip tool_result, image, etc.
    }
  }
  return parts.join('\n')
}

/** True if a user message body is just /clear, /export, etc. (slash command). */
function isSlashCommand(body: string): { is: boolean; name?: string } {
  const m = /<command-name>([^<]+)<\/command-name>/.exec(body)
  if (m) return { is: true, name: m[1].trim() }
  return { is: false }
}

function isLocalCommandCaveat(body: string): boolean {
  return body.startsWith('<local-command-caveat>')
}

function isAutoCommit(body: string): boolean {
  return body.startsWith('You are writing a git commit message')
}

function isTelegram(body: string): boolean {
  return body.includes('TELEGRAM MODE')
}

interface UserMsgScan {
  count: number
  substantiveTopic: string
  fallbackTopic: string
}

function emptyScan(): UserMsgScan {
  return { count: 0, substantiveTopic: '', fallbackTopic: '' }
}

function ingestUserBody(scan: UserMsgScan, raw: string): void {
  const body = raw.trim()
  if (!body) return
  if (isLocalCommandCaveat(body)) return // caveat doesn't count as a real message
  const slash = isSlashCommand(body)
  if (slash.is) {
    if (!scan.fallbackTopic && slash.name) scan.fallbackTopic = `[${slash.name}]`
    scan.count += 1
    return
  }
  if (isAutoCommit(body)) {
    if (!scan.fallbackTopic) scan.fallbackTopic = '[auto commit message]'
    scan.count += 1
    return
  }
  scan.count += 1
  if (!scan.substantiveTopic) {
    scan.substantiveTopic = body.split('\n')[0].slice(0, 140)
  }
}

interface ParseEnvelope {
  source: NativeSource
  /** Relative path under the source root (e.g. `2026/04/25/rollout-...jsonl`). */
  relPath: string
  /** File mtime in unix seconds. */
  mtime: number
  /** File contents (full JSONL). */
  text: string
}

/**
 * Parse a JSONL session file into a ParsedSession. Returns null when the file
 * has no recognisable events. The output uses the SAME ParsedSession shape the
 * vault markdown parser produces so downstream aggregation is identical.
 */
export function parseNativeAiSession(env: ParseEnvelope): ParsedSession | null {
  const lines = env.text.split('\n')
  const scan = emptyScan()

  let cwd = ''
  let sessionId = ''
  let firstTimestamp = ''
  let lastTimestamp = ''
  let hadClear = false
  let hadTelegram = false
  let hadAutoCommit = false
  let model: string | undefined
  // Claude usage is per-turn — we sum. Codex emits running totals — we take last.
  const claudeTotals: SessionTokens = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }
  let codexTotals: SessionTokens | null = null

  for (const raw of lines) {
    if (!raw) continue
    let evt: Record<string, unknown>
    try {
      evt = JSON.parse(raw) as Record<string, unknown>
    } catch {
      continue
    }
    const type = String(evt.type ?? '')
    const ts = typeof evt.timestamp === 'string' ? evt.timestamp : ''

    // ── Claude Code event shape ─────────────────────────────────────────────
    if (env.source === 'claude') {
      if (!cwd && typeof evt.cwd === 'string') cwd = evt.cwd
      if (!sessionId && typeof evt.sessionId === 'string') sessionId = evt.sessionId
      // Session bounds only from actual conversation events. Background events
      // like `last-prompt`, `permission-mode`, `ai-title`, `attachment`,
      // `queue-operation`, `system` etc. fire independently of user activity
      // (e.g. when you re-open the session next morning to glance at it) and
      // would push lastTimestamp hours past when you actually stopped working.
      if (ts && (type === 'user' || type === 'assistant')) {
        if (!firstTimestamp) firstTimestamp = ts
        lastTimestamp = ts
      }

      if (type === 'user') {
        const message = evt.message as Record<string, unknown> | undefined
        const content = message ? message.content : undefined
        const body = flattenClaudeContent(content)
        if (/<command-name>\/clear<\/command-name>/.test(body)) hadClear = true
        if (isAutoCommit(body)) hadAutoCommit = true
        if (isTelegram(body)) hadTelegram = true
        ingestUserBody(scan, body)
      }
      if (type === 'assistant') {
        const message = evt.message as Record<string, unknown> | undefined
        if (message && typeof message.model === 'string') model = message.model
        const usage = message ? (message.usage as Record<string, unknown> | undefined) : undefined
        if (usage) {
          claudeTotals.input += numericField(usage, 'input_tokens')
          claudeTotals.output += numericField(usage, 'output_tokens')
          claudeTotals.cacheRead += numericField(usage, 'cache_read_input_tokens')
          claudeTotals.cacheCreation += numericField(usage, 'cache_creation_input_tokens')
        }
      }
    }

    // ── Codex event shape ───────────────────────────────────────────────────
    if (env.source === 'codex') {
      const payload = (evt.payload as Record<string, unknown> | undefined) ?? {}
      if (type === 'session_meta') {
        if (typeof payload.cwd === 'string') cwd = payload.cwd
        if (typeof payload.id === 'string') sessionId = payload.id
        const pts = typeof payload.timestamp === 'string' ? payload.timestamp : ''
        if (pts) {
          firstTimestamp = pts
          lastTimestamp = pts
        }
        continue
      }
      if (type === 'turn_context' && typeof payload.model === 'string') {
        model = payload.model
      }
      if (type === 'event_msg') {
        const ep = payload as Record<string, unknown>
        if (ep.type === 'token_count') {
          const info = ep.info as Record<string, unknown> | undefined
          const total = info?.total_token_usage as Record<string, unknown> | undefined
          if (total) {
            // Running totals — overwrite each time so we end with the last seen.
            codexTotals = {
              input: numericField(total, 'input_tokens'),
              output: numericField(total, 'output_tokens'),
              cacheRead: numericField(total, 'cached_input_tokens'),
              cacheCreation: 0, // Codex doesn't split out cache creation
            }
          }
        }
      }
      // Session bounds: only count actual conversation events (response_item
      // for user/agent messages, or event_msg of those subtypes). Background
      // emissions like `token_count`, `turn_context`, `task_started/complete`
      // can fire at idle moments and would push lastTimestamp incorrectly.
      const isConversationEvent =
        type === 'response_item' ||
        (type === 'event_msg' &&
          ((payload as Record<string, unknown>).type === 'user_message' ||
            (payload as Record<string, unknown>).type === 'agent_message'))
      if (ts && isConversationEvent) {
        if (!firstTimestamp) firstTimestamp = ts
        lastTimestamp = ts
      }
      // Detect user-authored events: response_item with role:user OR event_msg
      // payloads tagged as user input. Codex format evolves; be lenient.
      const role = typeof payload.role === 'string' ? payload.role : ''
      const looksUserContent =
        role === 'user' ||
        type === 'user_input' ||
        (type === 'response_item' && role === 'user')
      if (looksUserContent) {
        // Try common content fields.
        const content =
          (typeof payload.content === 'string' && payload.content) ||
          (typeof payload.text === 'string' && payload.text) ||
          (Array.isArray(payload.content) ? flattenClaudeContent(payload.content) : '')
        ingestUserBody(scan, String(content))
      }
    }
  }

  // Fall back to filename-derived sessionId if the file didn't yield one.
  if (!sessionId) {
    const base = env.relPath.split('/').pop() ?? ''
    const m = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(base)
    if (m) sessionId = m[1]
  }
  if (!sessionId) return null

  // Project: prefer cwd; fall back to noise buckets when relevant.
  let project: string
  if (hadAutoCommit) project = '[auto-commit]'
  else if (hadTelegram) project = '[telegram]'
  else project = classifyCwd(cwd)

  // Timestamp: prefer first event ts; fall back to file mtime so we never
  // stamp a session as "now" on parse failure (same rule as vault parser).
  const startedIso = firstTimestamp
    ? new Date(firstTimestamp).toISOString()
    : new Date(env.mtime * 1000).toISOString()
  // End: last event timestamp gives the real "session length" for the timeline.
  const endedIso = lastTimestamp
    ? new Date(lastTimestamp).toISOString()
    : startedIso

  const topic = scan.substantiveTopic || scan.fallbackTopic || '(no user message)'
  const sourceTag: ActivitySource = env.source === 'codex' ? 'codex' : 'claude-code'

  // Pick the right token bundle: Claude sums per-turn; Codex provides totals.
  const tokens =
    env.source === 'claude'
      ? (claudeTotals.input || claudeTotals.output ? claudeTotals : undefined)
      : codexTotals ?? undefined

  return {
    path: `native/${env.source}/${env.relPath}`,
    source: sourceTag,
    startedIso,
    endedIso,
    project,
    userMsgCount: scan.count,
    topic,
    hadClear,
    mtime: env.mtime,
    tokens,
    model,
    sessionId: sessionId.toLowerCase(),
    // Stash sessionId on the path tail so the cache layer can dedupe by it.
    // We don't add a new field to ParsedSession to keep the cache schema stable.
  } as ParsedSession & { sessionId?: string } as ParsedSession
}

/** Extract the session id from a ParsedSession. Prefers the explicit
 *  `sessionId` field (full UUID extracted at parse time); falls back to path-
 *  based heuristics for older cached entries. */
export function sessionIdOf(session: ParsedSession): string {
  if (session.sessionId) return session.sessionId
  const base = session.path.split('/').pop() ?? session.path
  // Native: <uuid>.jsonl or rollout-...-<uuid>.jsonl
  const uuid = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(base)
  if (uuid) return uuid[1].toLowerCase()
  // Vault: <date>_<8-hex>.md  → return the 8-hex (will be matched against the
  // first 8 chars of any native UUID during dedup).
  const short = /_(\b[0-9a-f]{8}\b)\.(md|txt)$/i.exec(base)
  if (short) return short[1].toLowerCase()
  return session.path
}
