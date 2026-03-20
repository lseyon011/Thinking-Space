import { isCapacitorNative, isElectron } from '@/services/orchestrators/runtimeOrch'
import {
  fetchWebullAssetsPositionsBlock,
  fetchWebullAccountBalanceBlock,
  fetchWebullAccountListBlock,
  fetchWebullAccountPositionsBlock,
  type WebullApiResultBlock,
} from '../lego_blocks/integrations/webullApiBlock'

export type WebullRuntimeSurfaceOrch = 'electron' | 'capacitor' | 'web'

export interface WebullSelectedAccountOrch {
  accountId: string
  accountNumber: string | null
  subscriptionId: string | null
}

export interface WebullOverallSnapshotOrch {
  runtime: WebullRuntimeSurfaceOrch
  fetchedAt: string
  endpoints: {
    accountList: string | null
    accountBalanceLegacy: string | null
    accountPositionsLegacy: string | null
    assetsAccount: string | null
    assetsPositions: string | null
    marketQuotes: string | null
  }
  selectedAccount: WebullSelectedAccountOrch | null
  accountList: unknown
  accountBalanceLegacy: unknown | null
  accountPositionsLegacy: unknown | null
  assetsAccount: unknown | null
  assetsPositions: unknown | null
  marketQuotes: unknown | null
  attempts: string[]
  warnings: string[]
}

function asErrorMessageBlock(value: unknown): string {
  if (value instanceof Error) return value.message
  return String(value)
}

function summarizeApiUnavailableBlock(label: string, value: unknown): string {
  const message = asErrorMessageBlock(value)
  if (message.includes('route not found for candidate paths')) {
    return `${label} unavailable (Webull returned HTTP 404 for all candidate routes).`
  }
  if (message.includes('route/params not found')) {
    return `${label} unavailable (route/params not found for this app key).`
  }
  return `${label} unavailable: ${message}`
}

function asRecordArrayBlock(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
}

function firstNonEmptyStringBlock(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const normalized = candidate.trim()
    if (normalized) return normalized
  }
  return null
}

function resolveSelectedAccountBlock(accountListData: unknown): WebullSelectedAccountOrch | null {
  const rows = asRecordArrayBlock(accountListData)
  if (rows.length === 0) return null
  const first = rows[0]

  const accountId = firstNonEmptyStringBlock(
    first.account_id,
    first.accountId,
  )
  if (!accountId) return null

  return {
    accountId,
    accountNumber: firstNonEmptyStringBlock(first.account_number, first.accountNumber),
    subscriptionId: firstNonEmptyStringBlock(first.subscription_id, first.subscriptionId),
  }
}

function mergeAttemptsBlock(
  ...sources: Array<WebullApiResultBlock | null | undefined>
): string[] {
  const merged: string[] = []
  for (const source of sources) {
    if (!source) continue
    merged.push(...source.attempts)
  }
  return merged
}

export function getWebullRuntimeSurfaceOrch(): WebullRuntimeSurfaceOrch {
  if (isElectron()) return 'electron'
  if (isCapacitorNative()) return 'capacitor'
  return 'web'
}

export async function fetchWebullOverallSnapshotOrch(): Promise<WebullOverallSnapshotOrch> {
  const accountListResult = await fetchWebullAccountListBlock()
  const selectedAccount = resolveSelectedAccountBlock(accountListResult.data)
  const warnings: string[] = []
  const hasAccountId = !!selectedAccount?.accountId
  if (!hasAccountId) {
    warnings.push('No account_id found in account list payload; positions and balance were skipped.')
  }

  const [legacyBalanceSettled, legacyPositionsSettled, assetsPositionsSettled] = await Promise.allSettled([
    hasAccountId && selectedAccount
      ? fetchWebullAccountBalanceBlock(selectedAccount.accountId)
      : Promise.resolve<WebullApiResultBlock | null>(null),
    hasAccountId && selectedAccount
      ? fetchWebullAccountPositionsBlock(selectedAccount.accountId)
      : Promise.resolve<WebullApiResultBlock | null>(null),
    hasAccountId && selectedAccount
      ? fetchWebullAssetsPositionsBlock(selectedAccount.accountId)
      : Promise.resolve<WebullApiResultBlock | null>(null),
  ])

  const legacyAccountBalanceResult = legacyBalanceSettled.status === 'fulfilled'
    ? legacyBalanceSettled.value
    : null
  const legacyAccountPositionsResult = legacyPositionsSettled.status === 'fulfilled'
    ? legacyPositionsSettled.value
    : null
  let assetsPositionsResult = assetsPositionsSettled.status === 'fulfilled'
    ? assetsPositionsSettled.value
    : null

  if (legacyBalanceSettled.status === 'rejected') {
    warnings.push(summarizeApiUnavailableBlock('Account balance', legacyBalanceSettled.reason))
  }
  if (legacyPositionsSettled.status === 'rejected') {
    warnings.push(summarizeApiUnavailableBlock('Positions', legacyPositionsSettled.reason))
  }
  if (assetsPositionsSettled.status === 'rejected') {
    warnings.push(summarizeApiUnavailableBlock('OpenAPI assets positions', assetsPositionsSettled.reason))
  }

  return {
    runtime: getWebullRuntimeSurfaceOrch(),
    fetchedAt: accountListResult.requestedAt,
    endpoints: {
      accountList: accountListResult.endpoint,
      accountBalanceLegacy: legacyAccountBalanceResult?.endpoint ?? null,
      accountPositionsLegacy: legacyAccountPositionsResult?.endpoint ?? null,
      assetsAccount: null,
      assetsPositions: assetsPositionsResult?.endpoint ?? null,
      marketQuotes: null,
    },
    selectedAccount,
    accountList: accountListResult.data,
    accountBalanceLegacy: legacyAccountBalanceResult?.data ?? null,
    accountPositionsLegacy: legacyAccountPositionsResult?.data ?? null,
    assetsAccount: null,
    assetsPositions: assetsPositionsResult?.data ?? null,
    marketQuotes: null,
    attempts: mergeAttemptsBlock(
      accountListResult,
      legacyAccountBalanceResult,
      legacyAccountPositionsResult,
      assetsPositionsResult,
    ),
    warnings,
  }
}
