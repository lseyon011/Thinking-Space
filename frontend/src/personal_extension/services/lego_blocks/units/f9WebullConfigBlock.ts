export interface F9WebullConfigBlock {
  appKey: string
  appSecret: string
  baseUrl: string
  accountListPath?: string
  accountBalancePath?: string
  accountPositionsPath?: string
  marketSnapshotPath?: string
  marketQuotesPath?: string
  quoteSymbols: string[]
}

const DEFAULT_WEBULL_BASE_URL_BLOCK = 'https://api.webull.com'
const DEFAULT_QUOTE_SYMBOLS_BLOCK = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA']

function normalizeValueBlock(value: string | undefined): string {
  return value?.trim() ?? ''
}

function readConfigBlock(): F9WebullConfigBlock {
  const appKey = normalizeValueBlock(import.meta.env.VITE_F9_WEBULL_APP_KEY)
  const appSecret = normalizeValueBlock(import.meta.env.VITE_F9_WEBULL_APP_SECRET)
  const baseUrl = normalizeValueBlock(import.meta.env.VITE_F9_WEBULL_BASE_URL) || DEFAULT_WEBULL_BASE_URL_BLOCK
  const accountListPath = normalizeValueBlock(import.meta.env.VITE_F9_WEBULL_ACCOUNT_LIST_PATH)
  const accountBalancePath = normalizeValueBlock(import.meta.env.VITE_F9_WEBULL_ACCOUNT_BALANCE_PATH)
  const accountPositionsPath = normalizeValueBlock(import.meta.env.VITE_F9_WEBULL_ACCOUNT_POSITIONS_PATH)
  const marketSnapshotPath = normalizeValueBlock(import.meta.env.VITE_F9_WEBULL_MARKET_SNAPSHOT_PATH)
  const marketQuotesPath = normalizeValueBlock(import.meta.env.VITE_F9_WEBULL_MARKET_QUOTES_PATH)
  const quoteSymbolsRaw = normalizeValueBlock(import.meta.env.VITE_F9_WEBULL_QUOTE_SYMBOLS)
  const quoteSymbols = quoteSymbolsRaw
    ? quoteSymbolsRaw
      .split(',')
      .map(symbol => symbol.trim().toUpperCase())
      .filter(Boolean)
    : DEFAULT_QUOTE_SYMBOLS_BLOCK

  return {
    appKey,
    appSecret,
    baseUrl,
    accountListPath: accountListPath || undefined,
    accountBalancePath: accountBalancePath || undefined,
    accountPositionsPath: accountPositionsPath || undefined,
    marketSnapshotPath: marketSnapshotPath || undefined,
    marketQuotesPath: marketQuotesPath || undefined,
    quoteSymbols,
  }
}

export function hasF9WebullConfigBlock(): boolean {
  const config = readConfigBlock()
  return config.appKey.length > 0 && config.appSecret.length > 0
}

export function getF9WebullConfigBlock(): F9WebullConfigBlock {
  const config = readConfigBlock()
  const missing: string[] = []

  if (!config.appKey) missing.push('VITE_F9_WEBULL_APP_KEY')
  if (!config.appSecret) missing.push('VITE_F9_WEBULL_APP_SECRET')

  if (missing.length > 0) {
    throw new Error(`Missing F9 Webull configuration: ${missing.join(', ')}`)
  }

  try {
    // Validate URL early so error handling in the UI is clearer.
    new URL(config.baseUrl)
  } catch {
    throw new Error('VITE_F9_WEBULL_BASE_URL must be a valid absolute URL.')
  }

  if (config.accountListPath) {
    if (!config.accountListPath.startsWith('/')) {
      throw new Error('VITE_F9_WEBULL_ACCOUNT_LIST_PATH must start with "/".')
    }
  }

  if (config.accountBalancePath && !config.accountBalancePath.startsWith('/')) {
    throw new Error('VITE_F9_WEBULL_ACCOUNT_BALANCE_PATH must start with "/".')
  }
  if (config.accountPositionsPath && !config.accountPositionsPath.startsWith('/')) {
    throw new Error('VITE_F9_WEBULL_ACCOUNT_POSITIONS_PATH must start with "/".')
  }
  if (config.marketSnapshotPath && !config.marketSnapshotPath.startsWith('/')) {
    throw new Error('VITE_F9_WEBULL_MARKET_SNAPSHOT_PATH must start with "/".')
  }
  if (config.marketQuotesPath && !config.marketQuotesPath.startsWith('/')) {
    throw new Error('VITE_F9_WEBULL_MARKET_QUOTES_PATH must start with "/".')
  }
  if (config.quoteSymbols.length === 0) {
    throw new Error('VITE_F9_WEBULL_QUOTE_SYMBOLS must include at least one symbol.')
  }

  return config
}
