export type CodexUsageProbeProviderBlock = 'openai' | 'generic'

export type CodexUsageProbeSessionStateBlock =
  | 'loading'
  | 'ready'
  | 'needs_login'
  | 'rate_limited'
  | 'error'
  | 'unknown'

export interface CodexUsageProbeSnapshotBlock {
  url: string
  title: string
  bodyText: string
  headings: string[]
  buttons: string[]
  alerts: string[]
  detectedAt: string
}

export interface CodexUsageProbeResultBlock {
  siteId: string
  provider: CodexUsageProbeProviderBlock
  sessionState: CodexUsageProbeSessionStateBlock
  sessionLabel: string
  summary: string
  usageLabel: string | null
  usageDetail: string | null
  usageSourceText: string | null
  accountLabel: string | null
  currentUrl: string | null
  pageTitle: string | null
  detectedAt: string | null
  error: string | null
}

export interface CodexUsageMetricBlock {
  label: string
  remainingPercent: number
  tone: 'healthy' | 'warning' | 'critical'
}

function normalizeTextBlock(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeTextListBlock(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((value) => (typeof value === 'string' ? normalizeTextBlock(value) : ''))
    .filter(Boolean)
    .slice(0, 24)
}

function buildSummaryTextBlock(snapshot: CodexUsageProbeSnapshotBlock): string {
  return [
    snapshot.title,
    snapshot.url,
    ...snapshot.headings,
    ...snapshot.buttons,
    ...snapshot.alerts,
    snapshot.bodyText,
  ]
    .filter(Boolean)
    .join('\n')
}

function extractFirstMatchBlock(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return normalizeTextBlock(match[1])
    if (match?.[0]) return normalizeTextBlock(match[0])
  }
  return null
}

function includesAnyBlock(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle))
}

function buildOpenAiUsageLabelBlock(text: string): string | null {
  return extractFirstMatchBlock(text, [
    /((?:\b\d+\b[^.\n]{0,80}\b(?:messages?|prompts?)\b[^.\n]{0,80}\b(?:remaining|left)\b[^.\n]{0,80}))/i,
    /((?:you(?:'|’)ve reached[^.\n]{0,140}))/i,
    /((?:usage limit[^.\n]{0,140}))/i,
    /((?:message limit[^.\n]{0,140}))/i,
    /((?:resets?\s+(?:at|after)[^.\n]{0,120}))/i,
    /((?:try again later[^.\n]{0,120}))/i,
    /((?:too many requests[^.\n]{0,120}))/i,
  ])
}

function buildAccountLabelBlock(text: string): string | null {
  const email = extractFirstMatchBlock(text, [/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i])
  return email
}

function detectOpenAiProbeResultBlock(
  siteId: string,
  snapshot: CodexUsageProbeSnapshotBlock,
): CodexUsageProbeResultBlock {
  const summaryText = buildSummaryTextBlock(snapshot)
  const normalized = summaryText.toLowerCase()
  const usageLabel = buildOpenAiUsageLabelBlock(summaryText)
  const accountLabel = buildAccountLabelBlock(summaryText)

  const loginNeedles = [
    'log in',
    'sign up',
    'continue with google',
    'continue with apple',
    'continue with microsoft',
    'welcome back',
    'verify you are human',
    'create your account',
  ]
  const rateLimitedNeedles = [
    'usage limit',
    'message limit',
    'rate limit',
    'too many requests',
    'try again later',
    'our systems are a bit busy',
    'at capacity',
    'reached your limit',
  ]
  const errorNeedles = [
    'something went wrong',
    'unable to load',
    'request failed',
    'network error',
  ]

  if (includesAnyBlock(normalized, loginNeedles)) {
    return {
      siteId,
      provider: 'openai',
      sessionState: 'needs_login',
      sessionLabel: 'Needs login',
      summary: 'Visible page content indicates the account session is signed out or waiting for login.',
      usageLabel,
      usageDetail: null,
      usageSourceText: snapshot.bodyText,
      accountLabel,
      currentUrl: snapshot.url,
      pageTitle: snapshot.title,
      detectedAt: snapshot.detectedAt,
      error: null,
    }
  }

  if (includesAnyBlock(normalized, rateLimitedNeedles)) {
    return {
      siteId,
      provider: 'openai',
      sessionState: 'rate_limited',
      sessionLabel: 'Rate limited',
      summary: usageLabel ?? 'Visible page content indicates this session is limited or temporarily blocked.',
      usageLabel,
      usageDetail: 'Detected from visible page text in the loaded web session.',
      usageSourceText: snapshot.bodyText,
      accountLabel,
      currentUrl: snapshot.url,
      pageTitle: snapshot.title,
      detectedAt: snapshot.detectedAt,
      error: null,
    }
  }

  if (includesAnyBlock(normalized, errorNeedles)) {
    return {
      siteId,
      provider: 'openai',
      sessionState: 'error',
      sessionLabel: 'Error',
      summary: 'The loaded session shows an error state.',
      usageLabel,
      usageDetail: null,
      usageSourceText: snapshot.bodyText,
      accountLabel,
      currentUrl: snapshot.url,
      pageTitle: snapshot.title,
      detectedAt: snapshot.detectedAt,
      error: null,
    }
  }

  return {
    siteId,
    provider: 'openai',
    sessionState: 'ready',
    sessionLabel: usageLabel ? 'Ready' : 'Active',
    summary: usageLabel ?? 'Session appears logged in. No visible limit banner was detected on the page.',
    usageLabel,
    usageDetail: usageLabel ? 'Extracted from visible page text in the loaded web session.' : null,
    usageSourceText: snapshot.bodyText,
    accountLabel,
    currentUrl: snapshot.url,
    pageTitle: snapshot.title,
    detectedAt: snapshot.detectedAt,
    error: null,
  }
}

function detectGenericProbeResultBlock(
  siteId: string,
  snapshot: CodexUsageProbeSnapshotBlock,
): CodexUsageProbeResultBlock {
  return {
    siteId,
    provider: 'generic',
    sessionState: 'unknown',
    sessionLabel: 'Unknown',
    summary: 'No provider-specific usage detector is available for this site yet.',
    usageLabel: null,
    usageDetail: null,
    usageSourceText: snapshot.bodyText,
    accountLabel: buildAccountLabelBlock(buildSummaryTextBlock(snapshot)),
    currentUrl: snapshot.url,
    pageTitle: snapshot.title,
    detectedAt: snapshot.detectedAt,
    error: null,
  }
}

export function parseCodexUsageProbeSnapshotBlock(raw: unknown): CodexUsageProbeSnapshotBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (typeof record.url !== 'string' || typeof record.title !== 'string' || typeof record.bodyText !== 'string') {
    return null
  }
  return {
    url: record.url,
    title: record.title,
    bodyText: normalizeTextBlock(record.bodyText).slice(0, 16000),
    headings: normalizeTextListBlock(record.headings),
    buttons: normalizeTextListBlock(record.buttons),
    alerts: normalizeTextListBlock(record.alerts),
    detectedAt: typeof record.detectedAt === 'string' ? record.detectedAt : new Date().toISOString(),
  }
}

export function codexUsageProbeScriptBlock(): string {
  return `(() => {
    const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim()
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.visibility !== 'hidden'
        && style.display !== 'none'
        && rect.width > 0
        && rect.height > 0
    }
    const collect = (selector, limit = 24) => Array.from(document.querySelectorAll(selector))
      .filter(isVisible)
      .map((element) => normalize(element.textContent || ''))
      .filter(Boolean)
      .slice(0, limit)

    return {
      url: window.location.href,
      title: document.title || '',
      bodyText: normalize(document.body?.innerText || ''),
      headings: collect('h1, h2, h3, [role="heading"]', 12),
      buttons: collect('button, [role="button"]', 20),
      alerts: collect('[role="alert"], [aria-live="assertive"], [aria-live="polite"]', 20),
      detectedAt: new Date().toISOString(),
    }
  })()`
}

export function buildCodexUsageProbeLoadingResultBlock(siteId: string): CodexUsageProbeResultBlock {
  return {
    siteId,
    provider: 'generic',
    sessionState: 'loading',
    sessionLabel: 'Checking…',
    summary: 'Loading the account session and scanning the visible page state.',
    usageLabel: null,
    usageDetail: null,
    usageSourceText: null,
    accountLabel: null,
    currentUrl: null,
    pageTitle: null,
    detectedAt: null,
    error: null,
  }
}

export function buildCodexUsageProbeErrorResultBlock(siteId: string, error: string): CodexUsageProbeResultBlock {
  return {
    siteId,
    provider: 'generic',
    sessionState: 'error',
    sessionLabel: 'Error',
    summary: 'The dashboard could not read this web session.',
    usageLabel: null,
    usageDetail: null,
    usageSourceText: null,
    accountLabel: null,
    currentUrl: null,
    pageTitle: null,
    detectedAt: new Date().toISOString(),
    error,
  }
}

function normalizeUsageMetricLabelBlock(input: string): string {
  return input
    .replace(/\busage breakdown\b/gi, '')
    .replace(/\bpersonal usage\b/gi, 'Personal')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildUsageMetricSourceTextBlock(result: CodexUsageProbeResultBlock | null | undefined): string {
  return [result?.usageSourceText, result?.usageLabel, result?.summary].filter(Boolean).join(' ')
}

export function extractCodexUsageMetricsBlock(
  result: CodexUsageProbeResultBlock | null | undefined,
): CodexUsageMetricBlock[] {
  const source = buildUsageMetricSourceTextBlock(result).replace(/\bResets?\s+[^.\n]{0,80}/gi, ' ')
  if (!source) return []

  const seen = new Set<string>()
  const metrics: CodexUsageMetricBlock[] = []
  const pattern = /\b([A-Za-z][A-Za-z /-]{0,40}?)\s+(\d{1,3})%\s+remaining\b/gi

  for (const match of source.matchAll(pattern)) {
    const label = normalizeUsageMetricLabelBlock(match[1] ?? '')
    const remainingPercent = Number(match[2] ?? NaN)
    if (!label || !Number.isFinite(remainingPercent)) continue
    const key = `${label}:${remainingPercent}`
    if (seen.has(key)) continue
    seen.add(key)
    metrics.push({
      label,
      remainingPercent: Math.max(0, Math.min(100, remainingPercent)),
      tone: remainingPercent <= 10 ? 'critical' : remainingPercent <= 40 ? 'warning' : 'healthy',
    })
  }

  return metrics
}

export function extractCodexUsageResetTextBlock(
  result: CodexUsageProbeResultBlock | null | undefined,
): string | null {
  const source = buildUsageMetricSourceTextBlock(result)
  const match = source.match(/\b(Resets?\s+[^.\n]{0,80})/i)
  return match?.[1] ? normalizeTextBlock(match[1]) : null
}

export function detectCodexUsageProbeResultBlock(
  siteId: string,
  siteUrl: string,
  snapshot: CodexUsageProbeSnapshotBlock,
): CodexUsageProbeResultBlock {
  let hostname = ''
  try {
    hostname = new URL(siteUrl).hostname.toLowerCase()
  } catch {
    hostname = ''
  }

  if (hostname === 'chatgpt.com' || hostname === 'chat.openai.com' || hostname.endsWith('.openai.com')) {
    return detectOpenAiProbeResultBlock(siteId, snapshot)
  }

  return detectGenericProbeResultBlock(siteId, snapshot)
}
