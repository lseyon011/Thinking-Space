export interface WebullConfigBlock {
  baseUrl: string
  openApiBaseUrl: string
  accountListPath?: string
  accountBalancePath?: string
  accountPositionsPath?: string
  marketSnapshotPath?: string
  marketQuotesPath?: string
  quoteSymbols: string[]
}

export interface WebullCredentialStatusBlock {
  secureStorageAvailable: boolean
  configured: boolean
  appKeyHint: string | null
}

export interface WebullAccessTokenBlock {
  token: string
  expires: number | null
  status: string | null
}

const DEFAULT_WEBULL_BASE_URL_BLOCK = 'https://api.webull.com'
const DEFAULT_WEBULL_OPENAPI_BASE_URL_BLOCK = 'https://us-openapi-alb.uat.webullbroker.com'
const DEFAULT_QUOTE_SYMBOLS_BLOCK = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA']

function normalizeValueBlock(value: string | undefined): string {
  return value?.trim() ?? ''
}

function assertElectronWebullBridgeBlock(): NonNullable<Window['electronAPI']> {
  if (!window.electronAPI?.isElectron) {
    throw new Error('Webull secure credential storage is currently available only in Electron runtime.')
  }
  return window.electronAPI
}

function readConfigBlock(): WebullConfigBlock {
  const baseUrl = normalizeValueBlock(import.meta.env.VITE_WEBULL_BASE_URL) || DEFAULT_WEBULL_BASE_URL_BLOCK
  const openApiBaseUrl = normalizeValueBlock(import.meta.env.VITE_WEBULL_OPENAPI_BASE_URL) || DEFAULT_WEBULL_OPENAPI_BASE_URL_BLOCK
  const accountListPath = normalizeValueBlock(import.meta.env.VITE_WEBULL_ACCOUNT_LIST_PATH)
  const accountBalancePath = normalizeValueBlock(import.meta.env.VITE_WEBULL_ACCOUNT_BALANCE_PATH)
  const accountPositionsPath = normalizeValueBlock(import.meta.env.VITE_WEBULL_ACCOUNT_POSITIONS_PATH)
  const marketSnapshotPath = normalizeValueBlock(import.meta.env.VITE_WEBULL_MARKET_SNAPSHOT_PATH)
  const marketQuotesPath = normalizeValueBlock(import.meta.env.VITE_WEBULL_MARKET_QUOTES_PATH)
  const quoteSymbolsRaw = normalizeValueBlock(import.meta.env.VITE_WEBULL_QUOTE_SYMBOLS)
  const quoteSymbols = quoteSymbolsRaw
    ? quoteSymbolsRaw
      .split(',')
      .map(symbol => symbol.trim().toUpperCase())
      .filter(Boolean)
    : DEFAULT_QUOTE_SYMBOLS_BLOCK

  return {
    baseUrl,
    openApiBaseUrl,
    accountListPath: accountListPath || undefined,
    accountBalancePath: accountBalancePath || undefined,
    accountPositionsPath: accountPositionsPath || undefined,
    marketSnapshotPath: marketSnapshotPath || undefined,
    marketQuotesPath: marketQuotesPath || undefined,
    quoteSymbols,
  }
}

export async function readWebullCredentialStatusBlock(): Promise<WebullCredentialStatusBlock> {
  if (!window.electronAPI?.isElectron || !window.electronAPI.webullCredentialStatus) {
    return {
      secureStorageAvailable: false,
      configured: false,
      appKeyHint: null,
    }
  }
  return window.electronAPI.webullCredentialStatus()
}

export async function saveWebullCredentialsBlock(input: {
  appKey: string
  appSecret: string
}): Promise<WebullCredentialStatusBlock> {
  const api = assertElectronWebullBridgeBlock()
  if (!api.webullCredentialSet) {
    throw new Error('Webull secure credential bridge is unavailable in this Electron build.')
  }
  return api.webullCredentialSet({
    appKey: input.appKey,
    appSecret: input.appSecret,
  })
}

export async function clearWebullCredentialsBlock(): Promise<WebullCredentialStatusBlock> {
  const api = assertElectronWebullBridgeBlock()
  if (!api.webullCredentialClear) {
    throw new Error('Webull secure credential bridge is unavailable in this Electron build.')
  }
  return api.webullCredentialClear()
}

export async function readStoredWebullAccessTokenBlock(): Promise<WebullAccessTokenBlock | null> {
  const api = assertElectronWebullBridgeBlock()
  if (!api.webullTokenGet) {
    throw new Error('Webull secure token bridge is unavailable in this Electron build.')
  }
  const token = await api.webullTokenGet()
  if (!token || typeof token !== 'object') return null
  const normalizedToken = typeof token.token === 'string' ? token.token.trim() : ''
  if (!normalizedToken) return null
  return {
    token: normalizedToken,
    expires: typeof token.expires === 'number' && Number.isFinite(token.expires) ? token.expires : null,
    status: typeof token.status === 'string' ? token.status.trim() : null,
  }
}

export async function writeStoredWebullAccessTokenBlock(
  token: WebullAccessTokenBlock | null,
): Promise<void> {
  const api = assertElectronWebullBridgeBlock()
  if (!api.webullTokenSet) {
    throw new Error('Webull secure token bridge is unavailable in this Electron build.')
  }
  if (!token) {
    await api.webullTokenSet(null)
    return
  }
  await api.webullTokenSet({
    token: token.token,
    expires: token.expires,
    status: token.status,
  })
}

export function getWebullConfigBlock(): WebullConfigBlock {
  const config = readConfigBlock()

  try {
    // Validate URL early so error handling in the UI is clearer.
    new URL(config.baseUrl)
  } catch {
    throw new Error('VITE_WEBULL_BASE_URL must be a valid absolute URL.')
  }
  try {
    new URL(config.openApiBaseUrl)
  } catch {
    throw new Error('VITE_WEBULL_OPENAPI_BASE_URL must be a valid absolute URL.')
  }

  if (config.accountListPath) {
    if (!config.accountListPath.startsWith('/')) {
      throw new Error('VITE_WEBULL_ACCOUNT_LIST_PATH must start with "/".')
    }
  }

  if (config.accountBalancePath && !config.accountBalancePath.startsWith('/')) {
    throw new Error('VITE_WEBULL_ACCOUNT_BALANCE_PATH must start with "/".')
  }
  if (config.accountPositionsPath && !config.accountPositionsPath.startsWith('/')) {
    throw new Error('VITE_WEBULL_ACCOUNT_POSITIONS_PATH must start with "/".')
  }
  if (config.marketSnapshotPath && !config.marketSnapshotPath.startsWith('/')) {
    throw new Error('VITE_WEBULL_MARKET_SNAPSHOT_PATH must start with "/".')
  }
  if (config.marketQuotesPath && !config.marketQuotesPath.startsWith('/')) {
    throw new Error('VITE_WEBULL_MARKET_QUOTES_PATH must start with "/".')
  }
  if (config.quoteSymbols.length === 0) {
    throw new Error('VITE_WEBULL_QUOTE_SYMBOLS must include at least one symbol.')
  }

  return config
}
