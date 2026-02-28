import { isElectron } from '@/services/orchestrators/runtimeOrch'
import { getF9WebullConfigBlock, type F9WebullConfigBlock } from '../units/f9WebullConfigBlock'
import { buildF9WebullHeadersBlock } from '../units/f9WebullSigningBlock'

export interface F9WebullApiResultBlock {
  endpoint: string
  requestedAt: string
  data: unknown
  attempts: string[]
}

const DEFAULT_ACCOUNT_LIST_CANDIDATE_PATHS_BLOCK = [
  '/openapi/account/list',
  '/account/list',
  '/app/subscriptions/list',
]

const DEFAULT_ACCOUNT_BALANCE_CANDIDATE_PATHS_BLOCK = [
  '/openapi/account/balance',
  '/account/balance',
  '/app/account/balance',
]

const DEFAULT_ACCOUNT_POSITIONS_CANDIDATE_PATHS_BLOCK = [
  '/openapi/account/positions',
  '/account/positions',
  '/app/account/positions',
]

const DEFAULT_MARKET_QUOTES_CANDIDATE_PATHS_BLOCK = [
  '/openapi/market-data/stock/snapshot',
  '/openapi/market-data/stock/quotes',
  '/market-data/stock/snapshot',
  '/market-data/stock/quotes',
]

const QUOTE_QUERY_VARIANTS_BLOCK: Array<Record<string, string>> = [
  { symbols: '__SYMBOLS__' },
  { symbols: '__SYMBOLS__', category: 'US_STOCK' },
  { stock_ticker_ids: '__SYMBOLS__' },
  { stock_ticker_ids: '__SYMBOLS__', category: 'US_STOCK' },
  { ticker_ids: '__SYMBOLS__' },
]

const DEFAULT_POSITIONS_PAGE_SIZE_BLOCK = 100
const MAX_POSITIONS_PAGE_FETCH_BLOCK = 50

function parseJsonSafelyBlock(raw: string): unknown {
  if (!raw.trim()) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function buildErrorPreviewBlock(parsed: unknown): string {
  if (typeof parsed === 'string') return parsed.slice(0, 260)
  return JSON.stringify(parsed).slice(0, 260)
}

function assertElectronRuntimeBlock(): void {
  if (!isElectron()) {
    throw new Error('F9 Webull API currently requires Electron runtime because browser requests are blocked by CORS.')
  }
}

function resolvePathCandidatesBlock(overridePath: string | undefined, defaults: string[]): string[] {
  const seen = new Set<string>()
  const ordered = [overridePath, ...defaults]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.trim())

  const result: string[] = []
  for (const path of ordered) {
    if (seen.has(path)) continue
    seen.add(path)
    result.push(path)
  }
  return result
}

function buildEndpointBlock(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): string {
  const url = new URL(path, baseUrl)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined) continue
      const normalized = String(value).trim()
      if (!normalized) continue
      url.searchParams.set(key, normalized)
    }
  }
  return url.toString()
}

async function requestViaElectronBridgeBlock(
  endpoint: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: string }> {
  if (!window.electronAPI?.isElectron) {
    throw new Error('F9 Webull bridge is unavailable in this runtime.')
  }
  if (window.electronAPI.f9WebullGet) {
    return window.electronAPI.f9WebullGet({
      url: endpoint,
      headers,
    })
  }
  if (window.electronAPI.f9WebullAccountList) {
    return window.electronAPI.f9WebullAccountList({
      url: endpoint,
      headers,
    })
  }
  throw new Error('F9 Webull bridge is unavailable in this Electron build.')
}

async function signedGetBlock(
  endpoint: string,
  config: F9WebullConfigBlock,
): Promise<{ status: number; data: unknown }> {
  const signed = await buildF9WebullHeadersBlock({
    method: 'GET',
    url: endpoint,
    appKey: config.appKey,
    appSecret: config.appSecret,
    body: '',
  })

  const response = await requestViaElectronBridgeBlock(endpoint, signed.headers)
  return {
    status: response.status,
    data: parseJsonSafelyBlock(response.body),
  }
}

function resolveQuoteQueryVariantsBlock(symbols: string[]): Array<Record<string, string>> {
  const csv = symbols.join(',')
  return QUOTE_QUERY_VARIANTS_BLOCK.map(variant => {
    const next: Record<string, string> = {}
    for (const [key, value] of Object.entries(variant)) {
      next[key] = value === '__SYMBOLS__' ? csv : value
    }
    return next
  })
}

function asRecordBlock(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
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
  if (Array.isArray(value)) return asRecordArrayBlock(value)
  const row = asRecordBlock(value)
  if (!row) return []
  return asRecordArrayBlock(row.holdings)
}

function readHasNextFlagBlock(value: unknown): boolean {
  const row = asRecordBlock(value)
  if (!row) return false
  const raw = row.has_next ?? row.hasNext
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase()
    return normalized === 'true' || normalized === '1'
  }
  return false
}

function resolveLastInstrumentCursorBlock(value: unknown): string | null {
  const row = asRecordBlock(value)
  const fromPage = firstNonEmptyStringBlock(
    row?.last_instrument_id,
    row?.lastInstrumentId,
    row?.next_last_instrument_id,
    row?.nextLastInstrumentId,
    row?.next_cursor,
    row?.nextCursor,
    row?.cursor,
  )
  if (fromPage) return fromPage

  const holdings = extractHoldingsRowsBlock(value)
  if (holdings.length === 0) return null
  const lastHolding = holdings[holdings.length - 1]
  return firstNonEmptyStringBlock(
    lastHolding.instrument_id,
    lastHolding.instrumentId,
    lastHolding.position_id,
    lastHolding.positionId,
    lastHolding.id,
  )
}

async function fetchByPathCandidatesBlock(
  config: F9WebullConfigBlock,
  candidatePaths: string[],
  options?: {
    query?: Record<string, string | number | boolean | null | undefined>
    continueStatuses?: number[]
    errorLabel?: string
  },
): Promise<F9WebullApiResultBlock> {
  const continueStatuses = new Set(options?.continueStatuses ?? [404])
  const requestedAt = new Date().toISOString()
  const attempts: string[] = []

  for (const path of candidatePaths) {
    const endpoint = buildEndpointBlock(config.baseUrl, path, options?.query)
    const response = await signedGetBlock(endpoint, config)

    if (response.status >= 200 && response.status < 300) {
      attempts.push(`${path} -> HTTP ${response.status}`)
      return {
        endpoint,
        requestedAt,
        data: response.data,
        attempts,
      }
    }

    attempts.push(`${path} -> HTTP ${response.status}`)

    if (continueStatuses.has(response.status)) {
      continue
    }

    const label = options?.errorLabel ?? 'Webull request'
    throw new Error(`${label} failed at ${path} (HTTP ${response.status}): ${buildErrorPreviewBlock(response.data)}`)
  }

  const label = options?.errorLabel ?? 'Webull request'
  throw new Error(`${label} route not found for candidate paths: ${attempts.join(', ')}`)
}

export async function fetchF9WebullAccountListBlock(): Promise<F9WebullApiResultBlock> {
  assertElectronRuntimeBlock()
  const config = getF9WebullConfigBlock()
  const candidatePaths = resolvePathCandidatesBlock(config.accountListPath, DEFAULT_ACCOUNT_LIST_CANDIDATE_PATHS_BLOCK)
  return fetchByPathCandidatesBlock(config, candidatePaths, {
    continueStatuses: [404],
    errorLabel: 'Webull account list',
  })
}

export async function fetchF9WebullAccountBalanceBlock(accountId: string): Promise<F9WebullApiResultBlock> {
  assertElectronRuntimeBlock()
  const normalizedAccountId = accountId.trim()
  if (!normalizedAccountId) {
    throw new Error('Account id is required for account balance request.')
  }

  const config = getF9WebullConfigBlock()
  const candidatePaths = resolvePathCandidatesBlock(config.accountBalancePath, DEFAULT_ACCOUNT_BALANCE_CANDIDATE_PATHS_BLOCK)
  return fetchByPathCandidatesBlock(config, candidatePaths, {
    query: { account_id: normalizedAccountId },
    continueStatuses: [404],
    errorLabel: 'Webull account balance',
  })
}

export async function fetchF9WebullAccountPositionsBlock(accountId: string): Promise<F9WebullApiResultBlock> {
  assertElectronRuntimeBlock()
  const normalizedAccountId = accountId.trim()
  if (!normalizedAccountId) {
    throw new Error('Account id is required for positions request.')
  }

  const config = getF9WebullConfigBlock()
  const candidatePaths = resolvePathCandidatesBlock(config.accountPositionsPath, DEFAULT_ACCOUNT_POSITIONS_CANDIDATE_PATHS_BLOCK)
  const requestedAt = new Date().toISOString()
  const attempts: string[] = []

  for (const path of candidatePaths) {
    let firstEndpoint: string | null = null
    let pageCursor: string | null = null
    let mergedHoldings: Array<Record<string, unknown>> = []
    let lastPageRecord: Record<string, unknown> | null = null

    for (let pageIndex = 0; pageIndex < MAX_POSITIONS_PAGE_FETCH_BLOCK; pageIndex += 1) {
      const endpoint = buildEndpointBlock(config.baseUrl, path, {
        account_id: normalizedAccountId,
        page_size: DEFAULT_POSITIONS_PAGE_SIZE_BLOCK,
        last_instrument_id: pageCursor,
      })
      const response = await signedGetBlock(endpoint, config)
      const queryString = new URL(endpoint).searchParams.toString()
      attempts.push(`${path}?${queryString} -> HTTP ${response.status}`)

      if (response.status < 200 || response.status >= 300) {
        if (!firstEndpoint && response.status === 404) {
          break
        }
        throw new Error(`Webull account positions failed at ${path} (HTTP ${response.status}): ${buildErrorPreviewBlock(response.data)}`)
      }

      if (!firstEndpoint) firstEndpoint = endpoint
      lastPageRecord = asRecordBlock(response.data)

      const pageHoldings = extractHoldingsRowsBlock(response.data)
      mergedHoldings = mergedHoldings.concat(pageHoldings)

      const hasNext = readHasNextFlagBlock(response.data)
      if (!hasNext) {
        return {
          endpoint: firstEndpoint,
          requestedAt,
          data: {
            ...(lastPageRecord ?? {}),
            has_next: false,
            holdings: mergedHoldings,
          },
          attempts,
        }
      }

      pageCursor = resolveLastInstrumentCursorBlock(response.data)
      if (!pageCursor) {
        attempts.push(`${path} pagination stopped: has_next=true but last_instrument_id cursor was missing`)
        return {
          endpoint: firstEndpoint,
          requestedAt,
          data: {
            ...(lastPageRecord ?? {}),
            has_next: true,
            holdings: mergedHoldings,
            pagination_truncated: true,
            pagination_truncated_reason: 'has_next=true but last_instrument_id cursor was missing',
          },
          attempts,
        }
      }
    }

    if (firstEndpoint) {
      attempts.push(`${path} pagination stopped: reached safety limit of ${MAX_POSITIONS_PAGE_FETCH_BLOCK} pages`)
      return {
        endpoint: firstEndpoint,
        requestedAt,
        data: {
          ...(lastPageRecord ?? {}),
          has_next: true,
          holdings: mergedHoldings,
          pagination_truncated: true,
          pagination_truncated_reason: `reached safety limit of ${MAX_POSITIONS_PAGE_FETCH_BLOCK} pages`,
        },
        attempts,
      }
    }
  }

  throw new Error(`Webull account positions route not found for candidate paths: ${attempts.join(', ')}`)
}

export async function fetchF9WebullMarketQuotesBlock(symbols: string[]): Promise<F9WebullApiResultBlock> {
  assertElectronRuntimeBlock()
  const normalizedSymbols = symbols
    .map(symbol => symbol.trim().toUpperCase())
    .filter(Boolean)

  if (normalizedSymbols.length === 0) {
    throw new Error('At least one quote symbol is required.')
  }

  const config = getF9WebullConfigBlock()
  const candidatePaths = resolvePathCandidatesBlock(
    config.marketSnapshotPath,
    [
      ...(config.marketQuotesPath ? [config.marketQuotesPath] : []),
      ...DEFAULT_MARKET_QUOTES_CANDIDATE_PATHS_BLOCK,
    ],
  )
  const queryVariants = resolveQuoteQueryVariantsBlock(normalizedSymbols)

  const requestedAt = new Date().toISOString()
  const attempts: string[] = []

  for (const path of candidatePaths) {
    for (const query of queryVariants) {
      const endpoint = buildEndpointBlock(config.baseUrl, path, query)
      const response = await signedGetBlock(endpoint, config)

      if (response.status >= 200 && response.status < 300) {
        attempts.push(`${path}?${new URL(endpoint).searchParams.toString()} -> HTTP ${response.status}`)
        return {
          endpoint,
          requestedAt,
          data: response.data,
          attempts,
        }
      }

      attempts.push(`${path}?${new URL(endpoint).searchParams.toString()} -> HTTP ${response.status}`)
      if (response.status === 404 || response.status === 400 || response.status === 422) {
        continue
      }

      throw new Error(`Webull market quotes failed at ${path} (HTTP ${response.status}): ${buildErrorPreviewBlock(response.data)}`)
    }
  }

  const sample = attempts.slice(0, 4).join(', ')
  throw new Error(`Webull market quotes route/params not found after ${attempts.length} attempts. Sample: ${sample}`)
}
