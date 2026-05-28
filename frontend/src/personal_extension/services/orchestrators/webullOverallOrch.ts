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

export interface WebullAccountSnapshotOrch {
  account: WebullSelectedAccountOrch
  accountBalanceLegacy: unknown | null
  accountPositionsLegacy: unknown | null
  assetsPositions: unknown | null
  warnings: string[]
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
  /** First account — kept for backward compatibility. */
  selectedAccount: WebullSelectedAccountOrch | null
  /** All resolved accounts with per-account data. */
  accounts: WebullAccountSnapshotOrch[]
  accountList: unknown
  /** Merged across all accounts (legacy compat — prefer accounts[]). */
  accountBalanceLegacy: unknown | null
  /** Merged across all accounts (legacy compat — prefer accounts[]). */
  accountPositionsLegacy: unknown | null
  assetsAccount: unknown | null
  /** Merged across all accounts (legacy compat — prefer accounts[]). */
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
    if (typeof candidate === 'string') {
      const normalized = candidate.trim()
      if (normalized) return normalized
      continue
    }
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate)
    }
  }
  return null
}

function firstFiniteNumberBlock(...candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate
    if (typeof candidate !== 'string') continue
    const normalized = candidate.trim()
    if (!normalized) continue
    const parsed = Number(normalized)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function resolveAllAccountsBlock(accountListData: unknown): WebullSelectedAccountOrch[] {
  const rows = asRecordArrayBlock(accountListData)
  const accounts: WebullSelectedAccountOrch[] = []
  for (const row of rows) {
    const accountId = firstNonEmptyStringBlock(row.account_id, row.accountId)
    if (!accountId) continue
    accounts.push({
      accountId,
      accountNumber: firstNonEmptyStringBlock(row.account_number, row.accountNumber),
      subscriptionId: firstNonEmptyStringBlock(row.subscription_id, row.subscriptionId),
    })
  }
  return accounts
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

function mergeBalancesBlock(balances: Array<unknown | null>): unknown | null {
  const valid = balances.filter((b): b is Record<string, unknown> => !!b && typeof b === 'object' && !Array.isArray(b))
  if (valid.length === 0) return null
  if (valid.length === 1) return valid[0]
  // Sum numeric balance fields across accounts
  const merged: Record<string, unknown> = {}
  const mergedCurrencyAssetsByKey = new Map<string, Record<string, unknown>>()
  const numericKeys = [
    'total_market_value', 'totalMarketValue', 'total_asset', 'total_assets',
    'total_value', 'totalValue', 'net_liquidation_value', 'netLiquidationValue',
    'total_cash', 'totalCash', 'buying_power', 'buyingPower',
  ]
  for (const balance of valid) {
    for (const key of Object.keys(balance)) {
      if (!(key in merged)) {
        merged[key] = balance[key]
      } else if (numericKeys.includes(key)) {
        const existing = Number(merged[key])
        const incoming = Number(balance[key])
        if (Number.isFinite(existing) && Number.isFinite(incoming)) {
          merged[key] = existing + incoming
        }
      }
    }
    // Sum inside account_currency_assets if present
    const currencyAssets = asRecordArrayBlock(balance.account_currency_assets)
    for (let index = 0; index < currencyAssets.length; index += 1) {
      const source = currencyAssets[index]
      const currencyKey = firstNonEmptyStringBlock(
        source.currency,
        source.currency_code,
        source.currencyCode,
        source.coin,
        source.asset_code,
        source.assetCode,
      ) ?? `currency-${index}`
      const existing = mergedCurrencyAssetsByKey.get(currencyKey)
      if (!existing) {
        mergedCurrencyAssetsByKey.set(currencyKey, { ...source })
        continue
      }
      for (const [key, value] of Object.entries(source)) {
        if (!(key in existing)) {
          existing[key] = value
          continue
        }
        const existingNumber = Number(existing[key])
        const incomingNumber = Number(value)
        if (Number.isFinite(existingNumber) && Number.isFinite(incomingNumber)) {
          existing[key] = existingNumber + incomingNumber
        }
      }
    }
  }
  if (mergedCurrencyAssetsByKey.size > 0) {
    merged.account_currency_assets = [...mergedCurrencyAssetsByKey.values()]
  }
  return merged
}

function extractHoldingsRowsBlock(dataset: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(dataset)) return asRecordArrayBlock(dataset)
  if (!dataset || typeof dataset !== 'object') return []
  const record = dataset as Record<string, unknown>
  for (const key of ['holdings', 'positions', 'items', 'rows', 'data', 'list', 'result']) {
    const nested = record[key]
    if (Array.isArray(nested)) {
      return asRecordArrayBlock(nested)
    }
  }
  return []
}

function buildAccountScopedPositionRowsBlock(
  account: WebullSelectedAccountOrch,
  dataset: unknown | null,
): Array<Record<string, unknown>> {
  return extractHoldingsRowsBlock(dataset).map((row) => ({
    ...row,
    account_id: firstNonEmptyStringBlock(row.account_id, row.accountId, account.accountId) ?? account.accountId,
    account_number: firstNonEmptyStringBlock(row.account_number, row.accountNumber, account.accountNumber) ?? account.accountNumber ?? '',
    subscription_id: firstNonEmptyStringBlock(row.subscription_id, row.subscriptionId, account.subscriptionId) ?? account.subscriptionId ?? '',
  }))
}

function buildCashRowsFromBalanceBlock(
  account: WebullSelectedAccountOrch,
  balanceData: unknown | null,
): Array<Record<string, unknown>> {
  if (!balanceData || typeof balanceData !== 'object' || Array.isArray(balanceData)) return []
  const balance = balanceData as Record<string, unknown>
  const rows: Array<Record<string, unknown>> = []
  const currencyAssets = asRecordArrayBlock(balance.account_currency_assets)

  for (const asset of currencyAssets) {
    const cashValue = firstFiniteNumberBlock(
      asset.total_cash,
      asset.totalCash,
      asset.cash_balance,
      asset.cashBalance,
      asset.settled_cash,
      asset.settledCash,
      asset.available_cash,
      asset.availableCash,
      asset.withdrawable_cash,
      asset.withdrawableCash,
      asset.cash,
      asset.balance,
    )
    if (cashValue === null) continue
    const currencyCode = firstNonEmptyStringBlock(
      asset.currency,
      asset.currency_code,
      asset.currencyCode,
      asset.coin,
      asset.asset_code,
      asset.assetCode,
    ) ?? 'USD'
    rows.push({
      symbol: 'CASH',
      ticker: 'CASH',
      instrument_type: 'CASH',
      cash_currency: currencyCode,
      cost: String(cashValue),
      quantity: '1',
      last_price: String(cashValue),
      market_value: String(cashValue),
      current_value: String(cashValue),
      unrealized_profit_loss: '0',
      day_profit_loss: '0',
      leg_id: `cash-${account.accountId}-${currencyCode.toLowerCase()}`,
      position_id: `cash-${account.accountId}-${currencyCode.toLowerCase()}`,
      account_id: account.accountId,
      account_number: account.accountNumber ?? '',
      subscription_id: account.subscriptionId ?? '',
    })
  }

  if (rows.length > 0) return rows

  const totalCash = firstFiniteNumberBlock(balance.total_cash, balance.totalCash)
  if (totalCash === null) return []
  return [{
    symbol: 'CASH',
    ticker: 'CASH',
    instrument_type: 'CASH',
    cash_currency: 'USD',
    cost: String(totalCash),
    quantity: '1',
    last_price: String(totalCash),
    market_value: String(totalCash),
    current_value: String(totalCash),
    unrealized_profit_loss: '0',
    day_profit_loss: '0',
    leg_id: `cash-${account.accountId}-usd`,
    position_id: `cash-${account.accountId}-usd`,
    account_id: account.accountId,
    account_number: account.accountNumber ?? '',
    subscription_id: account.subscriptionId ?? '',
  }]
}

function mergeHoldingsArraysBlock(datasets: Array<{
  account: WebullSelectedAccountOrch
  positions: unknown | null
  balance: unknown | null
}>): unknown[] {
  const merged: unknown[] = []
  for (const dataset of datasets) {
    merged.push(...buildAccountScopedPositionRowsBlock(dataset.account, dataset.positions))
    merged.push(...buildCashRowsFromBalanceBlock(dataset.account, dataset.balance))
  }
  return merged
}

function waitMsBlock(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Webull's OpenAPI rate limits are strict (roughly 1 req/sec sustained per
// account scope). Combined with retry-with-backoff in the API block this
// stagger keeps the steady-state below the limit so retries are rare.
const WEBULL_API_STAGGER_MS_BLOCK = 800

async function fetchAccountSnapshotBlock(
  account: WebullSelectedAccountOrch,
): Promise<{
  snapshot: WebullAccountSnapshotOrch
  legacyBalanceResult: WebullApiResultBlock | null
  legacyPositionsResult: WebullApiResultBlock | null
  assetsPositionsResult: WebullApiResultBlock | null
}> {
  const warnings: string[] = []

  // Stagger API calls to avoid 429 rate limits
  const legacyBalanceSettled = await Promise.allSettled([fetchWebullAccountBalanceBlock(account.accountId)])
  await waitMsBlock(WEBULL_API_STAGGER_MS_BLOCK)
  const legacyPositionsSettled = await Promise.allSettled([fetchWebullAccountPositionsBlock(account.accountId)])
  await waitMsBlock(WEBULL_API_STAGGER_MS_BLOCK)
  const assetsPositionsSettled = await Promise.allSettled([fetchWebullAssetsPositionsBlock(account.accountId)])

  const balanceSettled = legacyBalanceSettled[0]
  const positionsSettled = legacyPositionsSettled[0]
  const assetsSettled = assetsPositionsSettled[0]

  const legacyBalanceResult = balanceSettled.status === 'fulfilled'
    ? balanceSettled.value
    : null
  const legacyPositionsResult = positionsSettled.status === 'fulfilled'
    ? positionsSettled.value
    : null
  const assetsPositionsResult = assetsSettled.status === 'fulfilled'
    ? assetsSettled.value
    : null

  const accountLabel = account.accountNumber ?? account.accountId
  if (balanceSettled.status === 'rejected') {
    warnings.push(summarizeApiUnavailableBlock(`Account balance [${accountLabel}]`, balanceSettled.reason))
  }
  if (positionsSettled.status === 'rejected') {
    warnings.push(summarizeApiUnavailableBlock(`Positions [${accountLabel}]`, positionsSettled.reason))
  }
  if (assetsSettled.status === 'rejected') {
    warnings.push(summarizeApiUnavailableBlock(`OpenAPI assets positions [${accountLabel}]`, assetsSettled.reason))
  }

  return {
    snapshot: {
      account,
      accountBalanceLegacy: legacyBalanceResult?.data ?? null,
      accountPositionsLegacy: legacyPositionsResult?.data ?? null,
      assetsPositions: assetsPositionsResult?.data ?? null,
      warnings,
    },
    legacyBalanceResult,
    legacyPositionsResult,
    assetsPositionsResult,
  }
}

export async function fetchWebullOverallSnapshotOrch(): Promise<WebullOverallSnapshotOrch> {
  const accountListResult = await fetchWebullAccountListBlock()
  const allAccounts = resolveAllAccountsBlock(accountListResult.data)
  const warnings: string[] = []

  if (allAccounts.length === 0) {
    warnings.push('No account_id found in account list payload; positions and balance were skipped.')
  }

  // Fetch data for accounts sequentially to avoid 429 rate limits.
  const accountResults: Awaited<ReturnType<typeof fetchAccountSnapshotBlock>>[] = []
  for (let i = 0; i < allAccounts.length; i++) {
    if (i > 0) await waitMsBlock(WEBULL_API_STAGGER_MS_BLOCK)
    accountResults.push(await fetchAccountSnapshotBlock(allAccounts[i]))
  }

  const accountSnapshots: WebullAccountSnapshotOrch[] = accountResults.map(r => r.snapshot)
  const allAttempts: WebullApiResultBlock[] = [accountListResult]

  // Collect merged data for backward-compat top-level fields.
  const allLegacyBalances: Array<unknown | null> = []
  const allLegacyPositions: Array<{
    account: WebullSelectedAccountOrch
    positions: unknown | null
    balance: unknown | null
  }> = []
  const allAssetsPositions: Array<{
    account: WebullSelectedAccountOrch
    positions: unknown | null
    balance: unknown | null
  }> = []
  let firstLegacyBalanceEndpoint: string | null = null
  let firstLegacyPositionsEndpoint: string | null = null
  let firstAssetsPositionsEndpoint: string | null = null

  for (const result of accountResults) {
    warnings.push(...result.snapshot.warnings)

    if (result.legacyBalanceResult) {
      allAttempts.push(result.legacyBalanceResult)
      allLegacyBalances.push(result.legacyBalanceResult.data)
      if (!firstLegacyBalanceEndpoint) firstLegacyBalanceEndpoint = result.legacyBalanceResult.endpoint
    }
    allLegacyPositions.push({
      account: result.snapshot.account,
      positions: result.legacyPositionsResult?.data ?? null,
      balance: result.legacyBalanceResult?.data ?? null,
    })
    if (result.legacyPositionsResult) {
      allAttempts.push(result.legacyPositionsResult)
      if (!firstLegacyPositionsEndpoint) firstLegacyPositionsEndpoint = result.legacyPositionsResult.endpoint
    }
    allAssetsPositions.push({
      account: result.snapshot.account,
      positions: result.assetsPositionsResult?.data ?? null,
      balance: result.legacyBalanceResult?.data ?? null,
    })
    if (result.assetsPositionsResult) {
      allAttempts.push(result.assetsPositionsResult)
      if (!firstAssetsPositionsEndpoint) firstAssetsPositionsEndpoint = result.assetsPositionsResult.endpoint
    }
  }

  // Merge holdings from all accounts into single top-level payloads for backward compat.
  const mergedLegacyHoldingRows = mergeHoldingsArraysBlock(allLegacyPositions)
  const mergedAssetsHoldingRows = mergeHoldingsArraysBlock(allAssetsPositions)
  const mergedLegacyPositions = mergedLegacyHoldingRows.length > 0
    ? { holdings: mergedLegacyHoldingRows }
    : null
  const mergedAssetsPositions = mergedAssetsHoldingRows.length > 0
    ? { holdings: mergedAssetsHoldingRows }
    : null

  return {
    runtime: getWebullRuntimeSurfaceOrch(),
    fetchedAt: accountListResult.requestedAt,
    endpoints: {
      accountList: accountListResult.endpoint,
      accountBalanceLegacy: firstLegacyBalanceEndpoint,
      accountPositionsLegacy: firstLegacyPositionsEndpoint,
      assetsAccount: null,
      assetsPositions: firstAssetsPositionsEndpoint,
      marketQuotes: null,
    },
    selectedAccount: allAccounts[0] ?? null,
    accounts: accountSnapshots,
    accountList: accountListResult.data,
    accountBalanceLegacy: mergeBalancesBlock(allLegacyBalances),
    accountPositionsLegacy: mergedLegacyPositions,
    assetsAccount: null,
    assetsPositions: mergedAssetsPositions,
    marketQuotes: null,
    attempts: mergeAttemptsBlock(...allAttempts),
    warnings,
  }
}
