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
    if (typeof candidate !== 'string') continue
    const normalized = candidate.trim()
    if (normalized) return normalized
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
    const currencyAssets = balance.account_currency_assets
    if (Array.isArray(currencyAssets) && currencyAssets.length > 0) {
      if (!Array.isArray(merged.account_currency_assets)) {
        merged.account_currency_assets = currencyAssets.map((a: unknown) => ({ ...(a as Record<string, unknown>) }))
      } else {
        const mergedAssets = merged.account_currency_assets as Array<Record<string, unknown>>
        for (let i = 0; i < currencyAssets.length && i < mergedAssets.length; i++) {
          const source = currencyAssets[i] as Record<string, unknown> | undefined
          if (!source) continue
          for (const key of Object.keys(source)) {
            const existing = Number(mergedAssets[i][key])
            const incoming = Number(source[key])
            if (Number.isFinite(existing) && Number.isFinite(incoming)) {
              mergedAssets[i][key] = existing + incoming
            }
          }
        }
      }
    }
  }
  return merged
}

function mergeHoldingsArraysBlock(datasets: Array<unknown | null>): unknown[] {
  const merged: unknown[] = []
  for (const dataset of datasets) {
    if (!dataset) continue
    if (Array.isArray(dataset)) {
      merged.push(...dataset)
      continue
    }
    const record = dataset as Record<string, unknown>
    const holdings = record?.holdings
    if (Array.isArray(holdings)) {
      merged.push(...holdings)
    }
  }
  return merged
}

function waitMsBlock(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const WEBULL_API_STAGGER_MS_BLOCK = 350

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
  const allLegacyPositions: Array<unknown | null> = []
  const allAssetsPositions: Array<unknown | null> = []
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
    if (result.legacyPositionsResult) {
      allAttempts.push(result.legacyPositionsResult)
      allLegacyPositions.push(result.legacyPositionsResult.data)
      if (!firstLegacyPositionsEndpoint) firstLegacyPositionsEndpoint = result.legacyPositionsResult.endpoint
    }
    if (result.assetsPositionsResult) {
      allAttempts.push(result.assetsPositionsResult)
      allAssetsPositions.push(result.assetsPositionsResult.data)
      if (!firstAssetsPositionsEndpoint) firstAssetsPositionsEndpoint = result.assetsPositionsResult.endpoint
    }
  }

  // Merge holdings from all accounts into single top-level payloads for backward compat.
  const mergedLegacyPositions = allLegacyPositions.length > 0
    ? { holdings: mergeHoldingsArraysBlock(allLegacyPositions) }
    : null
  const mergedAssetsPositions = allAssetsPositions.length > 0
    ? { holdings: mergeHoldingsArraysBlock(allAssetsPositions) }
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
