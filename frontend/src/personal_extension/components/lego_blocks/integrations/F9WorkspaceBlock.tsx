import { Button } from '@/components/lego_blocks/units/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import type { F9RuntimeSurfaceOrch, F9SelectedAccountOrch } from '@/personal_extension/services/orchestrators/f9OverallOrch'

interface F9SubtabBlock {
  id: 'overall'
  label: string
}

interface F9WorkspaceBlockProps {
  subtabs: F9SubtabBlock[]
  activeSubtabId: 'overall'
  onSelectSubtab: (id: 'overall') => void
  hasConfig: boolean
  loading: boolean
  error: string | null
  runtime: F9RuntimeSurfaceOrch | null
  fetchedAt: string | null
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
  warnings: string[]
  attempts: string[]
  onRefreshOverall: () => void
}

interface F9TabularPositionBlock {
  type: string
  symbol: string
  quantity: string
  lastPrice: string
  marketValue: string
  unrealizedPnl: string
}

interface F9TabularQuoteBlock {
  symbol: string
  lastPrice: string
  changePercent: string
}

function formatRuntimeLabelBlock(value: F9RuntimeSurfaceOrch | null): string {
  if (value === 'electron') return 'Electron'
  if (value === 'capacitor') return 'Capacitor'
  if (value === 'web') return 'Web'
  return 'Unknown'
}

function asRecordArrayBlock(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
  }

  if (value && typeof value === 'object') {
    const candidateLists = ['holdings', 'positions', 'items', 'rows', 'data', 'list', 'quotes', 'result']
    for (const key of candidateLists) {
      const nested = (value as Record<string, unknown>)[key]
      if (Array.isArray(nested)) {
        return nested.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      }
    }
  }

  return []
}

function firstStringBlock(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (typeof value === 'string') {
      const normalized = value.trim()
      if (normalized) return normalized
      continue
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }
  return '—'
}

function firstNumberBlock(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function formatCurrencyBlock(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })
}

function formatPercentBlock(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(2)}%`
}

function extractOverallValueBlock(balanceData: unknown): number | null {
  if (!balanceData || typeof balanceData !== 'object') return null
  const row = balanceData as Record<string, unknown>
  const currencyAssets = Array.isArray(row.account_currency_assets)
    ? row.account_currency_assets.find(item => !!item && typeof item === 'object') as Record<string, unknown> | undefined
    : undefined

  return firstNumberBlock(
    row.total_market_value,
    row.totalMarketValue,
    currencyAssets?.net_liquidation_value,
    currencyAssets?.positions_market_value,
    row.total_asset,
    row.total_assets,
    row.total_value,
    row.totalValue,
    row.net_liquidation_value,
    row.netLiquidationValue,
    row.market_value,
    row.marketValue,
    row.account_value,
    row.accountValue,
  )
}

function toPositionsBlock(data: unknown): F9TabularPositionBlock[] {
  return asRecordArrayBlock(data).map((row) => ({
    type: firstStringBlock(row.instrument_type, row.instrumentType, row.asset_type, row.assetType),
    symbol: firstStringBlock(
      row.symbol,
      row.ticker,
      row.stock,
      row.stock_code,
      row.stock_ticker,
      row.option_symbol,
      row.optionSymbol,
      row.option_display_symbol,
      row.optionDisplaySymbol,
      row.contract_code,
      row.contractCode,
      row.short_name,
      row.shortName,
      row.name,
    ),
    quantity: firstStringBlock(row.quantity, row.qty, row.position, row.holding_quantity, row.holdingQty),
    lastPrice: firstStringBlock(row.last_price, row.lastPrice, row.price),
    marketValue: firstStringBlock(row.market_value, row.marketValue, row.position_value, row.value),
    unrealizedPnl: firstStringBlock(row.unrealized_pnl, row.unrealizedPnL, row.unrealized_profit_loss, row.pnl),
  }))
}

function toQuotesBlock(data: unknown): F9TabularQuoteBlock[] {
  return asRecordArrayBlock(data).map((row) => ({
    symbol: firstStringBlock(row.symbol, row.ticker, row.stock, row.stock_code),
    lastPrice: firstStringBlock(row.last_price, row.lastPrice, row.price, row.latest_price, row.close),
    changePercent: (() => {
      const pct = firstNumberBlock(row.change_ratio, row.change_percent, row.changePercent, row.pct_change)
      if (pct !== null) return formatPercentBlock(pct)
      return firstStringBlock(row.change_ratio, row.change_percent, row.changePercent)
    })(),
  }))
}

function fallbackQuotesFromPositionsBlock(positions: F9TabularPositionBlock[]): F9TabularQuoteBlock[] {
  return positions
    .filter(position => position.symbol !== '—')
    .map(position => ({
      symbol: position.symbol,
      lastPrice: position.lastPrice,
      changePercent: '—',
    }))
}

function toJsonBlock(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2)
}

export default function F9WorkspaceBlock({
  subtabs,
  activeSubtabId,
  onSelectSubtab,
  hasConfig,
  loading,
  error,
  runtime,
  fetchedAt,
  endpoints,
  selectedAccount,
  accountList,
  accountBalance,
  accountPositions,
  marketQuotes,
  warnings,
  attempts,
  onRefreshOverall,
}: F9WorkspaceBlockProps) {
  const overallValue = extractOverallValueBlock(accountBalance)
  const positions = toPositionsBlock(accountPositions)
  const quotes = (() => {
    const direct = toQuotesBlock(marketQuotes)
    if (direct.length > 0) return direct
    return fallbackQuotesFromPositionsBlock(positions)
  })()

  return (
    <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
      <aside className="p-0">
        <div className="space-y-2">
          {subtabs.map((subtab) => {
            const active = activeSubtabId === subtab.id
            return (
              <button
                key={subtab.id}
                type="button"
                onClick={() => onSelectSubtab(subtab.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  active
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {subtab.label}
              </button>
            )
          })}
        </div>
      </aside>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Overall</CardTitle>
            <CardDescription>Positions, account value, and market quotes from your F9 Webull connections.</CardDescription>
          </div>
          <Button onClick={onRefreshOverall} disabled={!hasConfig || loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {!hasConfig && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              Missing Webull config. Set `VITE_F9_WEBULL_APP_KEY` and `VITE_F9_WEBULL_APP_SECRET` in your frontend env.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Runtime</p>
              <p className="mt-1 font-medium">{formatRuntimeLabelBlock(runtime)}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Fetched</p>
              <p className="mt-1 font-medium">{fetchedAt ?? 'Not requested yet'}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Overall Value</p>
              <p className="mt-1 font-medium">{formatCurrencyBlock(overallValue)}</p>
            </div>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border bg-background p-3">
              <p><span className="font-medium">Account Id:</span> {selectedAccount?.accountId ?? 'Not available'}</p>
              <p><span className="font-medium">Account Number:</span> {selectedAccount?.accountNumber ?? 'Not available'}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p><span className="font-medium">Positions:</span> {positions.length}</p>
              <p><span className="font-medium">Quotes:</span> {quotes.length}</p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border bg-background p-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Endpoints</p>
            <p className="text-xs"><span className="font-medium">Account list:</span> {endpoints.accountList ?? 'Not requested'}</p>
            <p className="text-xs"><span className="font-medium">Balance:</span> {endpoints.accountBalance ?? 'Not requested'}</p>
            <p className="text-xs"><span className="font-medium">Positions:</span> {endpoints.accountPositions ?? 'Not requested'}</p>
            <p className="text-xs"><span className="font-medium">Quotes:</span> {endpoints.marketQuotes ?? 'Not requested'}</p>
          </div>

          <div className="rounded-xl border bg-background">
            <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Positions
            </div>
            {positions.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No positions returned yet.</p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Quantity</th>
                      <th className="px-3 py-2">Last Price</th>
                      <th className="px-3 py-2">Market Value</th>
                      <th className="px-3 py-2">Unrealized PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position, index) => (
                      <tr key={`${position.symbol}-${index}`} className="border-b last:border-b-0">
                        <td className="px-3 py-2">{position.type}</td>
                        <td className="px-3 py-2">{position.symbol}</td>
                        <td className="px-3 py-2">{position.quantity}</td>
                        <td className="px-3 py-2">{position.lastPrice}</td>
                        <td className="px-3 py-2">{position.marketValue}</td>
                        <td className="px-3 py-2">{position.unrealizedPnl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-background">
            <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Market Quotes
            </div>
            {quotes.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No quotes returned yet.</p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Last Price</th>
                      <th className="px-3 py-2">Change %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((quote, index) => (
                      <tr key={`${quote.symbol}-${index}`} className="border-b last:border-b-0">
                        <td className="px-3 py-2">{quote.symbol}</td>
                        <td className="px-3 py-2">{quote.lastPrice}</td>
                        <td className="px-3 py-2">{quote.changePercent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <details className="rounded-xl border bg-background">
            <summary className="cursor-pointer border-b px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Raw Payloads
            </summary>
            <div className="space-y-3 p-3">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Account List</p>
                <pre className="max-h-48 overflow-auto rounded-md border p-2 text-xs leading-5">{toJsonBlock(accountList)}</pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Account Balance</p>
                <pre className="max-h-48 overflow-auto rounded-md border p-2 text-xs leading-5">{toJsonBlock(accountBalance)}</pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Positions</p>
                <pre className="max-h-48 overflow-auto rounded-md border p-2 text-xs leading-5">{toJsonBlock(accountPositions)}</pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Market Quotes</p>
                <pre className="max-h-48 overflow-auto rounded-md border p-2 text-xs leading-5">{toJsonBlock(marketQuotes)}</pre>
              </div>
              {attempts.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Attempt Log</p>
                  <pre className="max-h-48 overflow-auto rounded-md border p-2 text-xs leading-5">{attempts.join('\n')}</pre>
                </div>
              )}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}
