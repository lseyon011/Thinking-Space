import { isElectron } from '@/services/orchestrators/runtimeOrch'
import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import { getStoredVaultRoot } from '@/services/lego_blocks/units/storageKeyBlock'
import { getF9WebullConfigBlock, type F9WebullConfigBlock } from '../units/f9WebullConfigBlock'
import { buildF9WebullHeadersBlock } from '../units/f9WebullSigningBlock'

export interface F9WebullApiResultBlock {
  endpoint: string
  requestedAt: string
  data: unknown
  attempts: string[]
}

const DEFAULT_ACCOUNT_POSITIONS_CANDIDATE_PATHS_BLOCK = [
  '/openapi/account/positions',
  '/account/positions',
  '/app/account/positions',
]

const DEFAULT_ASSETS_ACCOUNT_CANDIDATE_PATHS_BLOCK = [
  '/openapi/assets/account',
  '/openapi/assets/balance',
  '/assets/account',
  '/assets/balance',
]

const DEFAULT_INSTRUMENT_STOCK_BY_TICKER_IDS_CANDIDATE_PATHS_BLOCK = [
  '/openapi/instrument/stock/list-by-ticker-ids',
]

const DEFAULT_INSTRUMENT_OPTION_BY_TICKER_IDS_CANDIDATE_PATHS_BLOCK = [
  '/openapi/instrument/option/list-by-ticker-ids',
]

const DEFAULT_TRADE_INSTRUMENT_CANDIDATE_PATHS_BLOCK = [
  '/trade/instrument',
  '/openapi/trade/instrument',
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
const MAX_INSTRUMENT_LOOKUP_IDS_PER_REQUEST_BLOCK = 40

const INSTRUMENT_QUERY_VARIANTS_BLOCK: Array<(idsCsv: string) => Record<string, string>> = [
  idsCsv => ({ ticker_ids: idsCsv }),
  idsCsv => ({ stock_ticker_ids: idsCsv }),
  idsCsv => ({ instrument_ids: idsCsv }),
  idsCsv => ({ ids: idsCsv }),
]

const TRADE_INSTRUMENT_QUERY_VARIANTS_BLOCK: Array<(instrumentId: string) => Record<string, string>> = [
  instrumentId => ({ instrument_id: instrumentId }),
  instrumentId => ({ ticker_id: instrumentId }),
  instrumentId => ({ id: instrumentId }),
]

interface F9WebullAccessTokenBlock {
  token: string
  expires: number | null
  status: string | null
}

const WEBULL_TOKEN_EXPIRY_SAFETY_MS_BLOCK = 60_000
const WEBULL_TOKEN_CHECK_DURATION_MS_BLOCK = 300_000
const WEBULL_TOKEN_CHECK_INTERVAL_MS_BLOCK = 5_000
const WEBULL_TOKEN_CACHE_DIR_BLOCK = '.thinking-space/f9'
let cachedWebullAccessTokenBlock: F9WebullAccessTokenBlock | null = null
let pendingWebullTokenInitPromiseBlock: Promise<string> | null = null
let loadedWebullTokenCachePathBlock: string | null = null

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

function withOpenApiBaseUrlBlock(config: F9WebullConfigBlock): F9WebullConfigBlock {
  return {
    ...config,
    baseUrl: config.openApiBaseUrl,
  }
}

async function requestViaElectronBridgeBlock(
  endpoint: string,
  headers: Record<string, string>,
  method: 'GET' | 'POST' = 'GET',
  body = '',
): Promise<{ status: number; body: string }> {
  if (!window.electronAPI?.isElectron) {
    throw new Error('F9 Webull bridge is unavailable in this runtime.')
  }
  if (window.electronAPI.f9WebullGet) {
    return window.electronAPI.f9WebullGet({
      url: endpoint,
      headers,
      method,
      body,
    })
  }
  if (window.electronAPI.f9WebullAccountList) {
    return window.electronAPI.f9WebullAccountList({
      url: endpoint,
      headers,
      method,
      body,
    })
  }
  throw new Error('F9 Webull bridge is unavailable in this Electron build.')
}

async function signedV2RequestBlock(
  method: 'GET' | 'POST',
  endpoint: string,
  config: F9WebullConfigBlock,
  options?: {
    accessToken?: string
    body?: string
  },
): Promise<{ status: number; data: unknown }> {
  if (!window.electronAPI?.f9WebullSignedRequest) {
    throw new Error('F9 Webull signed bridge is unavailable in this Electron build.')
  }
  const response = await window.electronAPI.f9WebullSignedRequest({
    method,
    url: endpoint,
    appKey: config.appKey,
    appSecret: config.appSecret,
    version: 'v2',
    accessToken: options?.accessToken,
    body: options?.body,
  })
  return {
    status: response.status,
    data: parseJsonSafelyBlock(response.body),
  }
}

function parseAccessTokenBlock(value: unknown): F9WebullAccessTokenBlock | null {
  const row = asRecordBlock(value)
  if (!row) return null

  const token = firstNonEmptyStringBlock(row.token, row.access_token, row.accessToken)
  if (!token) return null
  const status = firstNonEmptyStringBlock(row.status)

  let expires: number | null = null
  const rawExpires = row.expires
  if (typeof rawExpires === 'number' && Number.isFinite(rawExpires)) {
    expires = rawExpires
  } else if (typeof rawExpires === 'string') {
    const parsed = Number(rawExpires)
    if (Number.isFinite(parsed)) {
      expires = parsed
    }
  }

  return {
    token,
    expires,
    status,
  }
}

function normalizeAccessTokenStatusBlock(token: F9WebullAccessTokenBlock | null): string {
  if (!token?.status) return ''
  return token.status.trim().toUpperCase()
}

function isAccessTokenExpiredBlock(token: F9WebullAccessTokenBlock): boolean {
  if (token.expires === null) return false
  return token.expires <= (Date.now() + WEBULL_TOKEN_EXPIRY_SAFETY_MS_BLOCK)
}

function isCachedAccessTokenUsableBlock(token: F9WebullAccessTokenBlock | null): boolean {
  if (!token?.token) return false
  if (isAccessTokenExpiredBlock(token)) return false
  return normalizeAccessTokenStatusBlock(token) === 'NORMAL'
}

function isCachedPendingAccessTokenBlock(token: F9WebullAccessTokenBlock | null): boolean {
  if (!token?.token) return false
  if (isAccessTokenExpiredBlock(token)) return false
  return normalizeAccessTokenStatusBlock(token) === 'PENDING'
}

function buildWebullTokenCachePathBlock(config: F9WebullConfigBlock): string {
  const hostSegment = new URL(config.baseUrl).hostname
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
  const appKeySegment = config.appKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const normalizedAppKeySegment = appKeySegment || 'default'
  return `${WEBULL_TOKEN_CACHE_DIR_BLOCK}/webull-token-${hostSegment}-${normalizedAppKeySegment}.json`
}

function hasVaultRootForWebullTokenCacheBlock(): boolean {
  const vaultRoot = getStoredVaultRoot()
  return typeof vaultRoot === 'string' && vaultRoot.trim().length > 0
}

async function persistCachedWebullAccessTokenToVaultBlock(
  config: F9WebullConfigBlock,
  token: F9WebullAccessTokenBlock | null,
): Promise<void> {
  if (!hasVaultRootForWebullTokenCacheBlock()) return
  const path = buildWebullTokenCachePathBlock(config)
  const payload = token
    ? {
      token: token.token,
      expires: token.expires,
      status: token.status,
      updated_at: new Date().toISOString(),
    }
    : {}

  try {
    const vaultFs = getVaultFS()
    await vaultFs.write(path, JSON.stringify(payload, null, 2))
  } catch {
    // Token persistence is best-effort; auth flow should continue even when vault writes fail.
  }
}

async function setCachedWebullAccessTokenBlock(
  config: F9WebullConfigBlock,
  token: F9WebullAccessTokenBlock | null,
): Promise<void> {
  cachedWebullAccessTokenBlock = token
  await persistCachedWebullAccessTokenToVaultBlock(config, token)
}

async function hydrateCachedWebullAccessTokenFromVaultBlock(config: F9WebullConfigBlock): Promise<void> {
  if (!hasVaultRootForWebullTokenCacheBlock()) return
  const path = buildWebullTokenCachePathBlock(config)
  if (loadedWebullTokenCachePathBlock === path) return
  loadedWebullTokenCachePathBlock = path

  try {
    const vaultFs = getVaultFS()
    if (!(await vaultFs.exists(path))) return
    const raw = await vaultFs.read(path)
    const parsed = parseAccessTokenBlock(parseJsonSafelyBlock(raw))
    if (!parsed) return
    if (isAccessTokenExpiredBlock(parsed)) return
    cachedWebullAccessTokenBlock = parsed
  } catch {
    // Best-effort hydration from vault cache.
  }
}

function waitForMsBlock(ms: number): Promise<void> {
  return new Promise(resolve => {
    window.setTimeout(resolve, Math.max(0, ms))
  })
}

async function pollWebullTokenUntilNormalBlock(
  config: F9WebullConfigBlock,
  token: string,
): Promise<string> {
  const normalizedToken = token.trim()
  if (!normalizedToken) {
    throw new Error('Webull token check requires a non-empty token.')
  }

  const checkEndpoint = buildEndpointBlock(config.baseUrl, '/openapi/auth/token/check')
  const deadline = Date.now() + WEBULL_TOKEN_CHECK_DURATION_MS_BLOCK
  let tokenToCheck = normalizedToken

  while (true) {
    const checkResponse = await signedV2RequestBlock(
      'POST',
      checkEndpoint,
      config,
      { body: JSON.stringify({ token: tokenToCheck }) },
    )
    if (checkResponse.status < 200 || checkResponse.status >= 300) {
      throw new Error(`Webull token check failed (HTTP ${checkResponse.status}): ${buildErrorPreviewBlock(checkResponse.data)}`)
    }

    const parsed = parseAccessTokenBlock(checkResponse.data)
    if (!parsed) {
      throw new Error(`Webull token check returned malformed payload: ${buildErrorPreviewBlock(checkResponse.data)}`)
    }
    await setCachedWebullAccessTokenBlock(config, parsed)

    const normalizedStatus = normalizeAccessTokenStatusBlock(parsed)
    if (normalizedStatus === 'NORMAL') {
      return parsed.token
    }
    if (normalizedStatus === 'INVALID' || normalizedStatus === 'EXPIRED') {
      throw new Error(`Webull token status became ${normalizedStatus}. Please restart token verification.`)
    }

    tokenToCheck = parsed.token
    if (Date.now() >= deadline) {
      throw new Error('Webull token verification is still pending. Approve the 2FA prompt on phone and retry.')
    }

    await waitForMsBlock(WEBULL_TOKEN_CHECK_INTERVAL_MS_BLOCK)
  }
}

async function ensureWebullAccessTokenInnerBlock(config: F9WebullConfigBlock): Promise<string> {
  await hydrateCachedWebullAccessTokenFromVaultBlock(config)

  if (isCachedAccessTokenUsableBlock(cachedWebullAccessTokenBlock)) {
    return cachedWebullAccessTokenBlock!.token
  }
  if (isCachedPendingAccessTokenBlock(cachedWebullAccessTokenBlock)) {
    return pollWebullTokenUntilNormalBlock(config, cachedWebullAccessTokenBlock!.token)
  }

  const createEndpoint = buildEndpointBlock(config.baseUrl, '/openapi/auth/token/create')
  const createBody = cachedWebullAccessTokenBlock?.token
    ? JSON.stringify({ token: cachedWebullAccessTokenBlock.token })
    : '{}'
  const createResponse = await signedV2RequestBlock('POST', createEndpoint, config, { body: createBody })
  if (createResponse.status < 200 || createResponse.status >= 300) {
    throw new Error(`Webull token create failed (HTTP ${createResponse.status}): ${buildErrorPreviewBlock(createResponse.data)}`)
  }

  const parsed = parseAccessTokenBlock(createResponse.data)
  if (!parsed) {
    throw new Error(`Webull token create returned malformed payload: ${buildErrorPreviewBlock(createResponse.data)}`)
  }
  await setCachedWebullAccessTokenBlock(config, parsed)

  const normalizedStatus = normalizeAccessTokenStatusBlock(parsed)
  if (normalizedStatus === 'NORMAL') {
    return parsed.token
  }
  if (normalizedStatus === 'PENDING') {
    return pollWebullTokenUntilNormalBlock(config, parsed.token)
  }
  if (normalizedStatus === 'INVALID' || normalizedStatus === 'EXPIRED') {
    throw new Error(`Webull token create returned ${normalizedStatus} status. Please restart token verification.`)
  }

  throw new Error(`Webull token create returned unsupported status: ${parsed.status ?? 'unknown'}`)
}

async function ensureWebullAccessTokenBlock(config: F9WebullConfigBlock): Promise<string> {
  if (pendingWebullTokenInitPromiseBlock) {
    return pendingWebullTokenInitPromiseBlock
  }

  pendingWebullTokenInitPromiseBlock = ensureWebullAccessTokenInnerBlock(config)
    .finally(() => {
      pendingWebullTokenInitPromiseBlock = null
    })
  return pendingWebullTokenInitPromiseBlock
}

async function signedGetBlock(
  endpoint: string,
  config: F9WebullConfigBlock,
  options?: {
    version?: string
    accessToken?: string
  },
): Promise<{ status: number; data: unknown }> {
  const signed = await buildF9WebullHeadersBlock({
    method: 'GET',
    url: endpoint,
    appKey: config.appKey,
    appSecret: config.appSecret,
    body: '',
    version: options?.version,
    accessToken: options?.accessToken,
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
  const candidateKeys = ['holdings', 'positions', 'items', 'rows', 'data', 'list', 'result']
  for (const key of candidateKeys) {
    const nested = row[key]
    if (Array.isArray(nested)) {
      return asRecordArrayBlock(nested)
    }
  }
  return []
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

function extractCollectionRowsBlock(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return asRecordArrayBlock(value)
  const row = asRecordBlock(value)
  if (!row) return []

  const candidateKeys = ['items', 'list', 'data', 'rows', 'result', 'instruments', 'holdings', 'positions']
  for (const key of candidateKeys) {
    const nested = row[key]
    if (Array.isArray(nested)) {
      return asRecordArrayBlock(nested)
    }
  }
  return []
}

function splitIntoChunksBlock<T>(items: T[], chunkSize: number): T[][] {
  if (items.length === 0) return []
  const normalizedChunkSize = Math.max(1, chunkSize)
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += normalizedChunkSize) {
    chunks.push(items.slice(index, index + normalizedChunkSize))
  }
  return chunks
}

async function fetchPaginatedPositionsByCandidatePathsBlock(
  config: F9WebullConfigBlock,
  candidatePaths: string[],
  accountId: string,
  errorLabel: string,
): Promise<F9WebullApiResultBlock> {
  const requestedAt = new Date().toISOString()
  const attempts: string[] = []

  for (const path of candidatePaths) {
    let firstEndpoint: string | null = null
    let pageCursor: string | null = null
    let mergedHoldings: Array<Record<string, unknown>> = []
    let lastPageRecord: Record<string, unknown> | null = null

    for (let pageIndex = 0; pageIndex < MAX_POSITIONS_PAGE_FETCH_BLOCK; pageIndex += 1) {
      const endpoint = buildEndpointBlock(config.baseUrl, path, {
        account_id: accountId,
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
        throw new Error(`${errorLabel} failed at ${path} (HTTP ${response.status}): ${buildErrorPreviewBlock(response.data)}`)
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

  throw new Error(`${errorLabel} route not found for candidate paths: ${attempts.join(', ')}`)
}

async function fetchInstrumentByTickerIdsBlock(
  config: F9WebullConfigBlock,
  candidatePaths: string[],
  ids: string[],
  errorLabel: string,
): Promise<F9WebullApiResultBlock> {
  const normalizedIds = Array.from(new Set(
    ids
      .map(value => value.trim())
      .filter(Boolean),
  ))
  if (normalizedIds.length === 0) {
    throw new Error(`${errorLabel} requires at least one ticker id.`)
  }

  const requestedAt = new Date().toISOString()
  const attempts: string[] = []
  const mergedRows: Array<Record<string, unknown>> = []
  const rawResponses: unknown[] = []
  let firstSuccessEndpoint: string | null = null

  const chunks = splitIntoChunksBlock(normalizedIds, MAX_INSTRUMENT_LOOKUP_IDS_PER_REQUEST_BLOCK)
  for (const chunk of chunks) {
    const idsCsv = chunk.join(',')
    let chunkResolved = false

    for (const path of candidatePaths) {
      for (const queryFactory of INSTRUMENT_QUERY_VARIANTS_BLOCK) {
        const endpoint = buildEndpointBlock(config.baseUrl, path, queryFactory(idsCsv))
        const response = await signedGetBlock(endpoint, config)
        const queryString = new URL(endpoint).searchParams.toString()
        attempts.push(`${path}?${queryString} -> HTTP ${response.status}`)

        if (response.status >= 200 && response.status < 300) {
          if (!firstSuccessEndpoint) firstSuccessEndpoint = endpoint
          rawResponses.push(response.data)
          mergedRows.push(...extractCollectionRowsBlock(response.data))
          chunkResolved = true
          break
        }

        if (response.status === 404 || response.status === 400 || response.status === 422) {
          continue
        }

        throw new Error(`${errorLabel} failed at ${path} (HTTP ${response.status}): ${buildErrorPreviewBlock(response.data)}`)
      }

      if (chunkResolved) break
    }

    if (!chunkResolved) {
      throw new Error(`${errorLabel} route/params not found for ids chunk: ${idsCsv}`)
    }
  }

  return {
    endpoint: firstSuccessEndpoint ?? 'not-requested',
    requestedAt,
    data: {
      items: mergedRows,
      raw_responses: rawResponses,
      request_id_count: normalizedIds.length,
    },
    attempts,
  }
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
  const accessToken = await ensureWebullAccessTokenBlock(config)
  const requestedAt = new Date().toISOString()
  const path = '/openapi/account/list'
  const endpoint = buildEndpointBlock(config.baseUrl, path)
  const response = await signedV2RequestBlock('GET', endpoint, config, { accessToken })
  const attempts = [`${path} -> HTTP ${response.status}`]

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Webull account list failed at ${path} (HTTP ${response.status}): ${buildErrorPreviewBlock(response.data)}`)
  }

  return {
    endpoint,
    requestedAt,
    data: response.data,
    attempts,
  }
}

export async function fetchF9WebullAccountBalanceBlock(accountId: string): Promise<F9WebullApiResultBlock> {
  assertElectronRuntimeBlock()
  const normalizedAccountId = accountId.trim()
  if (!normalizedAccountId) {
    throw new Error('Account id is required for account balance request.')
  }

  const config = getF9WebullConfigBlock()
  const accessToken = await ensureWebullAccessTokenBlock(config)
  const requestedAt = new Date().toISOString()
  const path = '/openapi/assets/balance'
  const endpoint = buildEndpointBlock(config.baseUrl, path, { account_id: normalizedAccountId })
  const response = await signedV2RequestBlock('GET', endpoint, config, { accessToken })
  const attempts = [`${path}?${new URL(endpoint).searchParams.toString()} -> HTTP ${response.status}`]

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Webull account balance failed at ${path} (HTTP ${response.status}): ${buildErrorPreviewBlock(response.data)}`)
  }

  return {
    endpoint,
    requestedAt,
    data: response.data,
    attempts,
  }
}

export async function fetchF9WebullAccountPositionsBlock(accountId: string): Promise<F9WebullApiResultBlock> {
  assertElectronRuntimeBlock()
  const normalizedAccountId = accountId.trim()
  if (!normalizedAccountId) {
    throw new Error('Account id is required for positions request.')
  }

  const config = getF9WebullConfigBlock()
  const candidatePaths = resolvePathCandidatesBlock(config.accountPositionsPath, DEFAULT_ACCOUNT_POSITIONS_CANDIDATE_PATHS_BLOCK)
  return fetchPaginatedPositionsByCandidatePathsBlock(
    config,
    candidatePaths,
    normalizedAccountId,
    'Webull account positions',
  )
}

export async function fetchF9WebullAssetsAccountBlock(accountId: string): Promise<F9WebullApiResultBlock> {
  assertElectronRuntimeBlock()
  const normalizedAccountId = accountId.trim()
  if (!normalizedAccountId) {
    throw new Error('Account id is required for assets account request.')
  }

  const config = withOpenApiBaseUrlBlock(getF9WebullConfigBlock())
  const candidatePaths = resolvePathCandidatesBlock(undefined, DEFAULT_ASSETS_ACCOUNT_CANDIDATE_PATHS_BLOCK)
  try {
    return await fetchByPathCandidatesBlock(config, candidatePaths, {
      continueStatuses: [404, 400, 422],
      errorLabel: 'Webull OpenAPI assets account',
    })
  } catch {
    return fetchByPathCandidatesBlock(config, candidatePaths, {
      query: { account_id: normalizedAccountId },
      continueStatuses: [404, 400, 422],
      errorLabel: 'Webull OpenAPI assets account',
    })
  }
}

export async function fetchF9WebullAssetsPositionsBlock(accountId: string): Promise<F9WebullApiResultBlock> {
  assertElectronRuntimeBlock()
  const normalizedAccountId = accountId.trim()
  if (!normalizedAccountId) {
    throw new Error('Account id is required for assets positions request.')
  }

  // Match Python SDK TradeClient.account_v2.get_account_position(account_id):
  // single signed request, no fallback routes, raw payload passthrough.
  const config = getF9WebullConfigBlock()
  const accessToken = await ensureWebullAccessTokenBlock(config)
  const requestedAt = new Date().toISOString()
  const path = '/openapi/assets/positions'
  const endpoint = buildEndpointBlock(config.baseUrl, path, {
    account_id: normalizedAccountId,
  })
  const response = await signedV2RequestBlock('GET', endpoint, config, { accessToken })
  const attempts = [`${path}?${new URL(endpoint).searchParams.toString()} -> HTTP ${response.status}`]

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Webull OpenAPI assets positions failed at ${path} (HTTP ${response.status}): ${buildErrorPreviewBlock(response.data)}`)
  }

  return {
    endpoint,
    requestedAt,
    data: response.data,
    attempts,
  }
}

export async function fetchF9WebullStockInstrumentsByTickerIdsBlock(
  tickerIds: string[],
): Promise<F9WebullApiResultBlock> {
  assertElectronRuntimeBlock()
  const config = getF9WebullConfigBlock()
  const candidatePaths = resolvePathCandidatesBlock(undefined, DEFAULT_INSTRUMENT_STOCK_BY_TICKER_IDS_CANDIDATE_PATHS_BLOCK)
  return fetchInstrumentByTickerIdsBlock(config, candidatePaths, tickerIds, 'Webull stock instrument lookup')
}

export async function fetchF9WebullOptionInstrumentsByTickerIdsBlock(
  tickerIds: string[],
): Promise<F9WebullApiResultBlock> {
  assertElectronRuntimeBlock()
  const config = getF9WebullConfigBlock()
  const candidatePaths = resolvePathCandidatesBlock(undefined, DEFAULT_INSTRUMENT_OPTION_BY_TICKER_IDS_CANDIDATE_PATHS_BLOCK)
  return fetchInstrumentByTickerIdsBlock(config, candidatePaths, tickerIds, 'Webull option instrument lookup')
}

export async function fetchF9WebullTradeInstrumentsByIdsBlock(
  instrumentIds: string[],
): Promise<F9WebullApiResultBlock> {
  assertElectronRuntimeBlock()
  const normalizedIds = Array.from(new Set(
    instrumentIds
      .map(value => value.trim())
      .filter(Boolean),
  ))
  if (normalizedIds.length === 0) {
    throw new Error('Webull trade instrument lookup requires at least one instrument id.')
  }

  const config = getF9WebullConfigBlock()
  const candidatePaths = resolvePathCandidatesBlock(undefined, DEFAULT_TRADE_INSTRUMENT_CANDIDATE_PATHS_BLOCK)
  const requestedAt = new Date().toISOString()
  const attempts: string[] = []

  const rowsById = new Map<string, Record<string, unknown>>()
  let firstSuccessEndpoint: string | null = null
  let sawRateLimit = false
  const unresolvedIds: string[] = []

  for (const instrumentId of normalizedIds) {
    let resolved = false

    for (const path of candidatePaths) {
      for (const queryFactory of TRADE_INSTRUMENT_QUERY_VARIANTS_BLOCK) {
        const endpoint = buildEndpointBlock(config.baseUrl, path, queryFactory(instrumentId))
        const response = await signedGetBlock(endpoint, config)
        const queryString = new URL(endpoint).searchParams.toString()
        attempts.push(`${path}?${queryString} -> HTTP ${response.status}`)

        if (response.status >= 200 && response.status < 300) {
          if (!firstSuccessEndpoint) firstSuccessEndpoint = endpoint
          const rows = extractCollectionRowsBlock(response.data)
          if (rows.length > 0) {
            for (const row of rows) {
              const key = firstNonEmptyStringBlock(
                row.instrument_id,
                row.instrumentId,
                row.id,
                instrumentId,
              )
              if (!key) continue
              rowsById.set(key, row)
            }
          } else {
            const single = asRecordBlock(response.data)
            if (single) {
              const key = firstNonEmptyStringBlock(
                single.instrument_id,
                single.instrumentId,
                single.id,
                instrumentId,
              )
              if (key) {
                rowsById.set(key, single)
              }
            }
          }
          resolved = true
          break
        }

        if (response.status === 404 || response.status === 400 || response.status === 422) {
          continue
        }
        if (response.status === 429) {
          sawRateLimit = true
          continue
        }

        throw new Error(`Webull trade instrument lookup failed at ${path} (HTTP ${response.status}): ${buildErrorPreviewBlock(response.data)}`)
      }

      if (resolved) break
    }

    if (!resolved) {
      unresolvedIds.push(instrumentId)
    }
  }

  if (rowsById.size === 0) {
    if (sawRateLimit) {
      throw new Error('Webull trade instrument lookup hit rate limit before resolving any metadata.')
    }
    const sample = unresolvedIds.slice(0, 8).join(',')
    throw new Error(`Webull trade instrument lookup route/params not found for ids. Sample unresolved ids: ${sample}`)
  }

  return {
    endpoint: firstSuccessEndpoint ?? 'not-requested',
    requestedAt,
    data: {
      items: Array.from(rowsById.values()),
      requested_id_count: normalizedIds.length,
      resolved_id_count: rowsById.size,
      unresolved_ids: unresolvedIds,
      rate_limited: sawRateLimit,
    },
    attempts,
  }
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
