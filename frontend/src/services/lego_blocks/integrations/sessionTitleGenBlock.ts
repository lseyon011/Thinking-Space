// Generate a short topic title for an AI session chain using the local
// `opensource-ai` server (MLX `mlx_lm.server`, LM Studio, etc.) configured
// in Settings → AI. Falls back silently if no server is reachable or no
// model is loaded — caller renders chain.topic (first user message) instead.
//
// Why local-only: titles are derivative metadata, generated frequently across
// every visible day-table row. Sending transcript text to a cloud model would
// be wasteful and privacy-leaky.

import {
  DEFAULT_OPENSOURCE_AI_BASE_URL,
  getManualOpenSourceAiCredentialsBlock,
} from '@/services/lego_blocks/integrations/aiCredentialStoreBlock'
import type { ActivityChain } from '@/services/lego_blocks/units/aiActivityParserBlock'
import { readNativeAiSession } from '@/services/lego_blocks/integrations/nativeAiSessionsBlock'

interface LocalLlmConfig {
  baseUrl: string
  apiKey?: string
  model?: string
}

function normalizeBaseUrl(raw: string | null | undefined): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  const normalized = (trimmed || DEFAULT_OPENSOURCE_AI_BASE_URL).replace(/\/+$/, '')
  return normalized.endsWith('/v1') ? normalized : `${normalized}/v1`
}

function resolveConfig(): LocalLlmConfig | null {
  const manual = getManualOpenSourceAiCredentialsBlock()
  if (!manual?.baseUrl) return null
  return {
    baseUrl: normalizeBaseUrl(manual.baseUrl),
    apiKey: manual.apiKey?.trim() || undefined,
    model: manual.model?.trim() || undefined,
  }
}

// 5s probe so a dead server doesn't stall the UI; the result is cached for
// the lifetime of the page so we don't probe per row.
let availabilityCache: { at: number; ok: boolean; model: string | null } | null = null
const AVAILABILITY_TTL_MS = 60_000

export interface LocalLlmAvailability {
  available: boolean
  baseUrl: string | null
  modelHint: string | null
}

export async function probeLocalLlmAvailabilityBlock(force = false): Promise<LocalLlmAvailability> {
  const config = resolveConfig()
  if (!config) return { available: false, baseUrl: null, modelHint: null }

  if (!force && availabilityCache && Date.now() - availabilityCache.at < AVAILABILITY_TTL_MS) {
    return {
      available: availabilityCache.ok,
      baseUrl: config.baseUrl,
      modelHint: availabilityCache.model,
    }
  }

  const url = `${config.baseUrl}/models`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(url, {
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      signal: controller.signal,
    })
    if (!res.ok) {
      availabilityCache = { at: Date.now(), ok: false, model: null }
      return { available: false, baseUrl: config.baseUrl, modelHint: null }
    }
    const body = (await res.json()) as { data?: Array<{ id?: string }> }
    const first = body?.data?.find(m => typeof m.id === 'string')?.id ?? null
    const modelHint = config.model || first
    const ok = !!modelHint
    availabilityCache = { at: Date.now(), ok, model: modelHint }
    return { available: ok, baseUrl: config.baseUrl, modelHint }
  } catch {
    availabilityCache = { at: Date.now(), ok: false, model: null }
    return { available: false, baseUrl: config.baseUrl, modelHint: null }
  } finally {
    clearTimeout(timeout)
  }
}

// What we feed the model:
//   - first 1-2 user turns: defines what was being asked / worked on
//   - up to 3 assistant turns that look like recaps (sub-task summaries
//     anywhere in the conversation — "Fix summary:", "What landed", headings,
//     "Done — X now does Y"). Claude emits these every time a task wraps,
//     even mid-chat when the user pivots to a follow-up, so the LAST turn is
//     not reliably a recap. We score for summary-ness instead.
const MAX_USER_TURNS = 2
const MAX_PROMPT_CHARS = 5000
const MAX_PER_TURN_CHARS = 1200

interface ExtractedTurn {
  role: 'user' | 'assistant'
  text: string
  /** Position in the chain — used to keep the order stable when we prompt. */
  order: number
}

function flattenContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const p = part as Record<string, unknown>
      if (p.type === 'text' && typeof p.text === 'string') parts.push(p.text)
    }
    return parts.join('\n')
  }
  return ''
}

function isLabelOnly(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (/^<command-name>/i.test(trimmed)) return true
  if (/^\//.test(trimmed) && trimmed.length < 40) return true
  return false
}

function clip(text: string): string {
  return text.length > MAX_PER_TURN_CHARS
    ? `${text.slice(0, MAX_PER_TURN_CHARS)}…`
    : text
}

// Heuristic: does this assistant turn look like a recap/summary? Claude's
// recaps anywhere in the conversation tend to use these markers — explicit
// headings, "Fix summary" / "What landed" phrasing, or a bullet list with
// past-tense action verbs. False positives are fine (we send them all to
// the model) but false negatives lose signal.
const SUMMARY_PHRASE_RE = /\b(fix summary|what landed|what changed|summary:|all done|done\s*[\-—]|here'?s what|changes:|the result is|to recap)\b/i
const HEADING_RE = /^\s*#{2,4}\s+\S/m
const ACTION_BULLET_RE = /^[\s>]*[-*]\s+(?:I\s+|We\s+)?(added|fixed|updated|refactored|moved|removed|wired|renamed|introduced|extracted|deleted|created|switched|migrated|tightened|loosened|reworked|simplified|inlined|replaced|gated|exposed|persisted|cached|invalidated|landed)\b/mi

function looksLikeSummary(text: string): boolean {
  if (text.length < 60) return false
  if (SUMMARY_PHRASE_RE.test(text)) return true
  if (HEADING_RE.test(text)) return true
  // Count action bullets — 2+ means it's almost certainly a recap.
  const matches = text.match(new RegExp(ACTION_BULLET_RE.source, 'gmi'))
  if (matches && matches.length >= 2) return true
  return false
}

interface ChainContext {
  userIntro: ExtractedTurn[]
  /** All assistant turns in the chain that look like summaries/recaps, in
   *  chronological order. May be empty for chains that never wrap. */
  summaryTurns: ExtractedTurn[]
}

async function extractChainContext(chain: ActivityChain): Promise<ChainContext> {
  const userIntro: ExtractedTurn[] = []
  const summaryTurns: ExtractedTurn[] = []
  const ordered = [...chain.sessions]
    .sort((a, b) => Date.parse(a.startedIso) - Date.parse(b.startedIso))
    .slice(0, 5)

  let order = 0
  for (const s of ordered) {
    const cleanPath = s.path.replace(/#w\d+$/, '')
    if (!cleanPath.startsWith('native/')) continue
    const rest = cleanPath.slice('native/'.length)
    const slash = rest.indexOf('/')
    if (slash < 0) continue
    const source = rest.slice(0, slash) as 'claude' | 'codex'
    const relPath = rest.slice(slash + 1)
    let jsonl: string
    try {
      jsonl = await readNativeAiSession(source, relPath)
    } catch {
      continue
    }
    for (const line of jsonl.split('\n')) {
      if (!line.trim()) continue
      let ev: Record<string, unknown>
      try {
        ev = JSON.parse(line)
      } catch {
        continue
      }
      if (ev.type !== 'user' && ev.type !== 'assistant') continue
      const msg = ev.message as Record<string, unknown> | undefined
      const text = flattenContent(msg?.content).trim()
      if (!text) continue
      order += 1
      if (ev.type === 'user') {
        if (isLabelOnly(text)) continue
        if (userIntro.length < MAX_USER_TURNS) {
          userIntro.push({ role: 'user', text: clip(text), order })
        }
      } else {
        if (looksLikeSummary(text)) {
          summaryTurns.push({ role: 'assistant', text: clip(text), order })
        }
      }
    }
  }

  // Budget cap. The full prompt is rendered as: 1-2 user intro turns + every
  // summary turn. If summary turns push us past the budget, keep the most
  // recent ones (they reflect the final state of the work).
  const introChars = userIntro.reduce((n, t) => n + t.text.length, 0)
  let summaryBudget = Math.max(0, MAX_PROMPT_CHARS - introChars)
  // Walk from newest to oldest, keep what fits, then reverse so we render
  // chronologically in the prompt.
  const kept: ExtractedTurn[] = []
  for (let i = summaryTurns.length - 1; i >= 0; i -= 1) {
    const t = summaryTurns[i]
    if (t.text.length > summaryBudget) break
    kept.push(t)
    summaryBudget -= t.text.length
  }
  kept.reverse()

  return { userIntro, summaryTurns: kept }
}

function buildPrompt(_chain: ActivityChain, ctx: ChainContext): { system: string; user: string } {
  // Neutral, low-echo section markers (`<<<…>>>`) so the model is less likely
  // to grab the label text and put it back into the output. We also avoid
  // passing the project name — small models echo any "Project: X" header.
  const system = [
    'You write a single-line description of what a Claude session was about.',
    'Sessions cover anything: coding, business research, studying, writing,',
    'math, life planning. Stay neutral on domain — describe the actual subject.',
    '',
    'INPUT FORMAT:',
    '  <<<USER>>>      one or two user messages (the original ask)',
    '  <<<RECAP>>>     zero or more assistant recaps (what was done or covered)',
    '',
    'OUTPUT FORMAT (strict):',
    '  - Plain text. ONE line. No line breaks. No bullet list. No paragraphs.',
    '  - NO preamble. NO "First user message:", "User 1:", "User input:",',
    '    "User message:", "Note:", "Topic:", "Title:", "Summary:" prefix.',
    '  - NO quoting of the input. Do not begin with the user\'s words verbatim.',
    '  - NO meta-commentary like "(Note: ...)" or "Looking at the recaps...".',
    '  - Just the description, nothing else.',
    '',
    'CONTENT GUIDELINES:',
    '  - Concrete and specific: name the feature, company, concept, file, or',
    '    decision actually being discussed. Avoid generic words like "prompt",',
    '    "request", "skill" when a real noun is available.',
    '  - Use past-tense action verbs when RECAPs are present ("Fixed…",',
    '    "Walked through…", "Researched…"). Use present-progressive when only',
    '    USER is present ("Studying…", "Debugging…", "Planning…").',
    '  - If multiple sub-tasks happened, lead with the dominant one and mention',
    '    a second briefly ("Studied TSMC capacity; also covered foundry pricing").',
    '  - Never just the project or app name.',
    '',
    'EXAMPLES (input → output):',
    'USER asks to start a study-company skill on TSMC, RECAP walks through',
    'foundry business and capex',
    '→ Studied TSMC business model, foundry capacity, and capex dynamics',
    '',
    'USER asks AI Activity topics to summarize the actual work, RECAP describes',
    'reworking the prompt and adding cache invalidation',
    '→ Fixed AI Activity titles to summarize actual work instead of echoing project name',
    '',
    'USER asks how DRAM capacitor cells look and to diagram one, no RECAP',
    '→ Studying DRAM cell structure and sketching the capacitor diagram',
    '',
    'USER asks to start a prostate cancer registry app on Minerva HPC, RECAP',
    'walks through the launch steps',
    '→ Started the prostate cancer registry app on Minerva HPC cluster',
  ].join('\n')

  const sections: string[] = ['<<<USER>>>']
  if (ctx.userIntro.length > 0) {
    sections.push(ctx.userIntro.map(t => t.text).join('\n---\n'))
  } else {
    sections.push('(none)')
  }
  sections.push('', '<<<RECAP>>>')
  if (ctx.summaryTurns.length > 0) {
    sections.push(ctx.summaryTurns.map(t => t.text).join('\n---\n'))
  } else {
    sections.push('(none — infer from the user messages alone)')
  }
  sections.push('', '<<<OUTPUT>>>')

  return { system, user: sections.join('\n') }
}

// One short descriptive line — long enough to name the work, short enough
// to fit the Topic column on a typical day-table row when truncated.
const MAX_TITLE_CHARS = 240

// Leading template-echo phrases the model sometimes emits as a header before
// the real summary. We try to STRIP these and keep the rest of the line —
// e.g. "User 1: A prompt to start a study-company skill" → "A prompt to
// start a study-company skill". If after stripping there's nothing left, the
// line is discarded and we look for another.
const LEAK_PREFIX_RE =
  /^(?:first user message|user (?:message|input|prompt|\d+)|recap \d+|the user(?:'s)?(?: message| input| prompt| ask)?|note|topic|title|label|summary|description|output|project|input|response|here(?:'s| is)|looking at|based on)\s*[:\-—–]\s*/i

// Lines that are entirely a quoted/paraphrased user message — drop them.
const USER_QUOTE_LEAD_RE = /^(?:hey|hi|hello|can you|could you|please|i want|i need|let'?s)\b/i

function stripWrappers(s: string): string {
  return s
    .replace(/^["'`*\-\s>]+/, '')
    .replace(/["'`*\s]+$/, '')
    .replace(/^<<<OUTPUT>>>\s*/i, '')
    .trim()
}

function sanitizeTitle(raw: string, projectName: string): string | null {
  let v = raw.trim()
  // Drop <think>…</think> blocks from thinking-mode models.
  v = v.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  // Drop parenthetical meta-commentary (whole-line "(Note: …)" blocks).
  v = v.replace(/^\s*\((?:note|comment)[^)]*\)\s*$/gim, '').trim()

  // Walk lines top-down. For each line:
  //   1. Strip any leaked template prefix ("User 1:", "User input:", "Topic:",
  //      "Note:", etc.) — preserve whatever follows.
  //   2. Discard if what's left looks like a verbatim user message ("hey",
  //      "can you", "please").
  //   3. Discard if too short (need 3+ words to be a real summary).
  // First line that survives wins. This salvages outputs like
  // "User 1: Initiates a study-company skill walkthrough" → "Initiates a
  // study-company skill walkthrough" instead of dropping the whole line.
  const lines = v.split('\n').map(stripWrappers).filter(Boolean)
  let pick: string | null = null
  for (const rawLine of lines) {
    let line = rawLine
    // Strip up to two layers of leaked prefix ("Output: Topic: Foo" → "Foo").
    for (let i = 0; i < 2; i += 1) {
      const next = line.replace(LEAK_PREFIX_RE, '').trim()
      if (next === line) break
      line = next
    }
    line = stripWrappers(line)
    if (!line) continue
    if (USER_QUOTE_LEAD_RE.test(line)) continue
    if (line.split(/\s+/).length < 3) continue
    pick = line
    break
  }
  if (!pick) return null

  // Strip any lingering "Foo:" prefix.
  pick = pick.replace(/^(topic( label)?|title|label|summary|description|project)\s*[:\-—]\s*/i, '').trim()
  // Drop trailing punctuation that adds nothing.
  pick = pick.replace(/[.!?;]+$/, '').trim()
  if (!pick) return null

  // Reject the dominant failure mode: just the project name.
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (projectName && normalize(pick) === normalize(projectName)) return null

  // Trim oversized output to one row's worth; the expanded row shows the
  // full thing if anyone wants more detail.
  if (pick.length > MAX_TITLE_CHARS) {
    const cut = pick.slice(0, MAX_TITLE_CHARS)
    const lastSpace = cut.lastIndexOf(' ')
    pick = (lastSpace > MAX_TITLE_CHARS * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + '…'
  }
  return pick
}

export interface GeneratedTitle {
  title: string
  model: string
}

// Bump this when the prompt or sanitizer changes meaningfully so previously
// cached titles (generated with the old prompt) get regenerated. The hook
// reads `record.promptVersion` and treats anything below this as stale.
export const TITLE_PROMPT_VERSION = 6

export async function generateChainTitleBlock(chain: ActivityChain): Promise<GeneratedTitle | null> {
  const availability = await probeLocalLlmAvailabilityBlock()
  if (!availability.available || !availability.baseUrl) return null

  const config = resolveConfig()
  if (!config) return null

  const model = config.model || availability.modelHint
  if (!model) return null

  const ctx = await extractChainContext(chain)
  // If we got nothing usable from JSONL (e.g. vault-only chain), seed the
  // user intro with the chain's first-message topic so the model still has
  // something to ground on.
  if (ctx.userIntro.length === 0 && chain.topic) {
    ctx.userIntro.push({ role: 'user', text: chain.topic, order: 0 })
  }
  if (ctx.userIntro.length === 0 && ctx.summaryTurns.length === 0) return null

  const { system, user } = buildPrompt(chain, ctx)

  const controller = new AbortController()
  // 30s budget — local inference on a 3-4B model should finish in <5s; the
  // cap is purely a runaway guard.
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 120,
        temperature: 0.2,
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      model?: string
    }
    const text = body?.choices?.[0]?.message?.content ?? ''
    const sanitized = sanitizeTitle(text, chain.project)
    if (!sanitized) return null
    return { title: sanitized, model: body.model || model }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
