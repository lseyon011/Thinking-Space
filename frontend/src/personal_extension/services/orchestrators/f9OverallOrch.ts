import { isCapacitorNative, isElectron } from '@/services/orchestrators/runtimeOrch'
import { getF9WebullConfigBlock } from '../lego_blocks/units/f9WebullConfigBlock'
import {
  fetchF9WebullAccountBalanceBlock,
  fetchF9WebullAccountListBlock,
  fetchF9WebullAccountPositionsBlock,
  fetchF9WebullMarketQuotesBlock,
  type F9WebullApiResultBlock,
} from '../lego_blocks/integrations/f9WebullApiBlock'

export type F9RuntimeSurfaceOrch = 'electron' | 'capacitor' | 'web'

export interface F9SelectedAccountOrch {
  accountId: string
  accountNumber: string | null
  subscriptionId: string | null
}

export interface F9OverallSnapshotOrch {
  runtime: F9RuntimeSurfaceOrch
  fetchedAt: string
  endpoints: {
    accountList: string | null
    accountBalance: string | null
    accountPositions: string | null
    marketQuotes: string | null
  }
  selectedAccount: F9SelectedAccountOrch | null
  accountList: unknown
  accountBalance: unknown | null
  accountPositions: unknown | null
  marketQuotes: unknown | null
  attempts: string[]
  warnings: string[]
}

function asErrorMessageBlock(value: unknown): string {
  if (value instanceof Error) return value.message
  return String(value)
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

function extractHoldingsRowsBlock(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
  }
  if (!value || typeof value !== 'object') return []

  const row = value as Record<string, unknown>
  const nested = row.holdings
  if (Array.isArray(nested)) {
    return nested.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
  }
  return []
}

function buildMarketQuoteFallbackFromPositionsBlock(positionsData: unknown): unknown {
  const rows = extractHoldingsRowsBlock(positionsData)
  const mapped = rows
    .map((row) => {
      const symbol = firstNonEmptyStringBlock(row.symbol, row.ticker, row.stock_symbol)
      if (!symbol) return null
      return {
        symbol,
        last_price: firstNonEmptyStringBlock(row.last_price, row.lastPrice, row.price),
        change_percent: firstNonEmptyStringBlock(row.change_percent, row.unrealized_profit_loss_rate),
        source: 'positions_holding_fallback',
      }
    })
  return mapped.filter((item): item is NonNullable<typeof item> => item !== null)
}

function resolveSelectedAccountBlock(accountListData: unknown): F9SelectedAccountOrch | null {
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
  ...sources: Array<F9WebullApiResultBlock | null | undefined>
): string[] {
  const merged: string[] = []
  for (const source of sources) {
    if (!source) continue
    merged.push(...source.attempts)
  }
  return merged
}

export function getF9RuntimeSurfaceOrch(): F9RuntimeSurfaceOrch {
  if (isElectron()) return 'electron'
  if (isCapacitorNative()) return 'capacitor'
  return 'web'
}

export async function fetchF9OverallSnapshotOrch(): Promise<F9OverallSnapshotOrch> {
  const accountListResult = await fetchF9WebullAccountListBlock()
  const selectedAccount = resolveSelectedAccountBlock(accountListResult.data)
  const warnings: string[] = []
  const quoteSymbols = getF9WebullConfigBlock().quoteSymbols
  const hasAccountId = !!selectedAccount?.accountId
  if (!hasAccountId) {
    warnings.push('No account_id found in account list payload; positions and balance were skipped.')
  }

  const [balanceSettled, positionsSettled, quotesSettled] = await Promise.allSettled([
    hasAccountId && selectedAccount
      ? fetchF9WebullAccountBalanceBlock(selectedAccount.accountId)
      : Promise.resolve<F9WebullApiResultBlock | null>(null),
    hasAccountId && selectedAccount
      ? fetchF9WebullAccountPositionsBlock(selectedAccount.accountId)
      : Promise.resolve<F9WebullApiResultBlock | null>(null),
    fetchF9WebullMarketQuotesBlock(quoteSymbols),
  ])

  const accountBalanceResult = balanceSettled.status === 'fulfilled'
    ? balanceSettled.value
    : null
  const accountPositionsResult = positionsSettled.status === 'fulfilled'
    ? positionsSettled.value
    : null
  let marketQuotesResult = quotesSettled.status === 'fulfilled'
    ? quotesSettled.value
    : null

  if (balanceSettled.status === 'rejected') {
    warnings.push(`Account balance unavailable: ${asErrorMessageBlock(balanceSettled.reason)}`)
  }
  if (positionsSettled.status === 'rejected') {
    warnings.push(`Positions unavailable: ${asErrorMessageBlock(positionsSettled.reason)}`)
  }
  if (quotesSettled.status === 'rejected') {
    if (accountPositionsResult) {
      marketQuotesResult = {
        endpoint: `${accountPositionsResult.endpoint} (fallback from positions last_price)`,
        requestedAt: accountPositionsResult.requestedAt,
        data: buildMarketQuoteFallbackFromPositionsBlock(accountPositionsResult.data),
        attempts: [],
      }
      warnings.push('Market quote endpoint unavailable; using positions last_price as quote fallback.')
    } else {
      warnings.push(`Market quotes unavailable: ${asErrorMessageBlock(quotesSettled.reason)}`)
    }
  }

  return {
    runtime: getF9RuntimeSurfaceOrch(),
    fetchedAt: accountListResult.requestedAt,
    endpoints: {
      accountList: accountListResult.endpoint,
      accountBalance: accountBalanceResult?.endpoint ?? null,
      accountPositions: accountPositionsResult?.endpoint ?? null,
      marketQuotes: marketQuotesResult?.endpoint ?? null,
    },
    selectedAccount,
    accountList: accountListResult.data,
    accountBalance: accountBalanceResult?.data ?? null,
    accountPositions: accountPositionsResult?.data ?? null,
    marketQuotes: marketQuotesResult?.data ?? null,
    attempts: mergeAttemptsBlock(
      accountListResult,
      accountBalanceResult,
      accountPositionsResult,
      marketQuotesResult,
    ),
    warnings,
  }
}
