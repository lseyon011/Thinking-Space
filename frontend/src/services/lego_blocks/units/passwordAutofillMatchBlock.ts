import type { PasswordVaultEntryBlock } from '@/services/lego_blocks/integrations/passwordVaultBlock'

export interface PasswordAutofillFieldRectBlock {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface PasswordAutofillWebContextBlock {
  url: string
  origin: string
  hostname: string
  pageTitle: string
  usernameValue: string
  passwordValue: string
  activeField: 'username' | 'password' | 'other'
  rect: PasswordAutofillFieldRectBlock | null
}

function normalizeTextBlock(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeHostnameBlock(value: string | null | undefined): string {
  const normalized = normalizeTextBlock(value).toLowerCase()
  if (!normalized) return ''
  return normalized.startsWith('www.') ? normalized.slice(4) : normalized
}

export function hostnameFromUrlBlock(value: string | null | undefined): string {
  const normalized = normalizeTextBlock(value)
  if (!normalized) return ''
  try {
    return normalizeHostnameBlock(new URL(normalized).hostname)
  } catch {
    return normalizeHostnameBlock(normalized)
  }
}

export function derivePasswordEntryTitleBlock(pageTitle: string, hostname: string): string {
  const normalizedTitle = normalizeTextBlock(pageTitle)
  if (!normalizedTitle) return hostname || 'Website'
  const parts = normalizedTitle
    .split(/\s+[|·-]\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  return parts[0] || hostname || normalizedTitle
}

export function passwordEntryHostnameBlock(entry: Pick<PasswordVaultEntryBlock, 'website'>): string {
  return hostnameFromUrlBlock(entry.website)
}

function entryMatchesHostnameBlock(entryHost: string, contextHost: string): boolean {
  if (!entryHost || !contextHost) return false
  if (entryHost === contextHost) return true
  return contextHost.endsWith(`.${entryHost}`) || entryHost.endsWith(`.${contextHost}`)
}

function entryMatchScoreBlock(entry: PasswordVaultEntryBlock, context: PasswordAutofillWebContextBlock): number {
  const entryHost = passwordEntryHostnameBlock(entry)
  const contextHost = normalizeHostnameBlock(context.hostname)
  if (!entryHost || !contextHost) return -1
  if (!entryMatchesHostnameBlock(entryHost, contextHost)) return -1

  let score = 10
  if (entryHost === contextHost) score += 10
  if (normalizeTextBlock(entry.username).toLowerCase() === normalizeTextBlock(context.usernameValue).toLowerCase()) {
    score += 6
  }
  if (normalizeTextBlock(entry.title).toLowerCase() === derivePasswordEntryTitleBlock(context.pageTitle, contextHost).toLowerCase()) {
    score += 4
  }
  return score
}

export function findMatchingPasswordEntriesBlock(
  entries: PasswordVaultEntryBlock[],
  context: PasswordAutofillWebContextBlock,
  limit = 5,
): PasswordVaultEntryBlock[] {
  return [...entries]
    .map((entry) => ({ entry, score: entryMatchScoreBlock(entry, context) }))
    .filter((row) => row.score >= 0)
    .sort((left, right) => {
      const byScore = right.score - left.score
      if (byScore !== 0) return byScore
      return right.entry.updatedAt.localeCompare(left.entry.updatedAt)
    })
    .slice(0, limit)
    .map((row) => row.entry)
}

export function findPasswordSaveTargetBlock(
  entries: PasswordVaultEntryBlock[],
  context: PasswordAutofillWebContextBlock,
): PasswordVaultEntryBlock | null {
  const normalizedUsername = normalizeTextBlock(context.usernameValue).toLowerCase()
  const matches = findMatchingPasswordEntriesBlock(entries, context, 10)
  if (matches.length === 0) return null

  if (normalizedUsername) {
    const exactUsername = matches.find(
      (entry) => normalizeTextBlock(entry.username).toLowerCase() === normalizedUsername,
    )
    if (exactUsername) return exactUsername
  }

  if (matches.length === 1) return matches[0]
  return null
}
