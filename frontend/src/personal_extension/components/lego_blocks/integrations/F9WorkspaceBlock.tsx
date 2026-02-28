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
    accountBalanceLegacy: string | null
    accountPositionsLegacy: string | null
    assetsAccount: string | null
    assetsPositions: string | null
    marketQuotes: string | null
  }
  selectedAccount: F9SelectedAccountOrch | null
  accountList: unknown
  accountBalanceLegacy: unknown | null
  accountPositionsLegacy: unknown | null
  assetsAccount: unknown | null
  assetsPositions: unknown | null
  marketQuotes: unknown | null
  warnings: string[]
  attempts: string[]
  onRefreshOverall: () => void
}

interface F9TabularQuoteBlock {
  symbol: string
  lastPrice: string
  changePercent: string
}

interface F9OptionLegRowBlock extends Record<string, unknown> {
  position_symbol: string
  position_instrument_id: string
  leg_index: number
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

function asRecordBlock(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
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

function toDisplayCellBlock(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized || '—'
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function extractPositionRowsBlock(data: unknown): Array<Record<string, unknown>> {
  return asRecordArrayBlock(data)
}

function extractPositionMetaFieldsBlock(data: unknown): Array<{ key: string; value: string }> {
  const top = asRecordBlock(data)
  if (!top) return []
  return Object.entries(top)
    .filter(([key]) => key !== 'holdings')
    .map(([key, value]) => ({ key, value: toDisplayCellBlock(value) }))
}

function collectTableColumnsBlock(rows: Array<Record<string, unknown>>): string[] {
  const columns: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue
      seen.add(key)
      columns.push(key)
    }
  }
  return columns
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

function extractOptionLegRowsBlock(data: unknown): F9OptionLegRowBlock[] {
  const rows = extractPositionRowsBlock(data)
  const optionLegRows: F9OptionLegRowBlock[] = []
  for (const row of rows) {
    const legs = row.legs
    if (!Array.isArray(legs)) continue
    const positionSymbol = firstStringBlock(
      row.symbol,
      row.option_symbol,
      row.optionSymbol,
      row.option_display_symbol,
      row.optionDisplaySymbol,
      row.short_name,
      row.shortName,
    )
    const positionInstrumentId = firstStringBlock(
      row.instrument_id,
      row.instrumentId,
      row.ticker_id,
      row.tickerId,
    )
    legs.forEach((leg, index) => {
      if (!leg || typeof leg !== 'object') return
      optionLegRows.push({
        position_symbol: positionSymbol,
        position_instrument_id: positionInstrumentId,
        leg_index: index + 1,
        ...(leg as Record<string, unknown>),
      })
    })
  }
  return optionLegRows
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
  accountBalanceLegacy,
  accountPositionsLegacy,
  assetsAccount,
  assetsPositions,
  marketQuotes,
  warnings,
  attempts,
  onRefreshOverall,
}: F9WorkspaceBlockProps) {
  const overallValue = extractOverallValueBlock(accountBalanceLegacy ?? assetsAccount)
  const legacyPositionRows = extractPositionRowsBlock(accountPositionsLegacy)
  const legacyPositionMetaFields = extractPositionMetaFieldsBlock(accountPositionsLegacy)
  const legacyPositionColumns = collectTableColumnsBlock(legacyPositionRows)
  const legacyPositionTableColumns = legacyPositionColumns.length > 0 ? legacyPositionColumns : ['payload']
  const assetsPositionRows = extractPositionRowsBlock(assetsPositions)
  const assetsPositionMetaFields = extractPositionMetaFieldsBlock(assetsPositions)
  const assetsPositionColumns = collectTableColumnsBlock(assetsPositionRows)
  const assetsPositionTableColumns = assetsPositionColumns.length > 0 ? assetsPositionColumns : ['payload']
  const legacyOptionLegRows = extractOptionLegRowsBlock(accountPositionsLegacy)
  const legacyOptionLegColumns = collectTableColumnsBlock(legacyOptionLegRows)
  const legacyOptionLegTableColumns = legacyOptionLegColumns.length > 0 ? legacyOptionLegColumns : ['payload']
  const assetsOptionLegRows = extractOptionLegRowsBlock(assetsPositions)
  const assetsOptionLegColumns = collectTableColumnsBlock(assetsOptionLegRows)
  const assetsOptionLegTableColumns = assetsOptionLegColumns.length > 0 ? assetsOptionLegColumns : ['payload']
  const quotes = toQuotesBlock(marketQuotes)

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
              <p><span className="font-medium">Legacy Positions:</span> {legacyPositionRows.length}</p>
              <p><span className="font-medium">OpenAPI Positions:</span> {assetsPositionRows.length}</p>
              <p><span className="font-medium">Quotes:</span> {quotes.length}</p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border bg-background p-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Endpoints</p>
            <p className="text-xs"><span className="font-medium">Account list:</span> {endpoints.accountList ?? 'Not requested'}</p>
            <p className="text-xs"><span className="font-medium">Legacy balance:</span> {endpoints.accountBalanceLegacy ?? 'Not requested'}</p>
            <p className="text-xs"><span className="font-medium">Legacy positions:</span> {endpoints.accountPositionsLegacy ?? 'Not requested'}</p>
            <p className="text-xs"><span className="font-medium">OpenAPI assets account:</span> {endpoints.assetsAccount ?? 'Not requested'}</p>
            <p className="text-xs"><span className="font-medium">OpenAPI assets positions:</span> {endpoints.assetsPositions ?? 'Not requested'}</p>
            <p className="text-xs"><span className="font-medium">Quotes:</span> {endpoints.marketQuotes ?? 'Not requested'}</p>
          </div>

          <div className="rounded-xl border bg-background">
            <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Legacy Positions (/account/positions)
            </div>
            {legacyPositionRows.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No positions returned yet.</p>
            ) : (
              <div className="overflow-auto">
                {legacyPositionMetaFields.length > 0 && (
                  <table className="min-w-full border-b text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                        <th className="px-3 py-2">Payload Field</th>
                        <th className="px-3 py-2">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legacyPositionMetaFields.map((item) => (
                        <tr key={item.key} className="border-b last:border-b-0">
                          <td className="px-3 py-2 font-mono text-xs">{item.key}</td>
                          <td className="px-3 py-2">{item.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {legacyPositionTableColumns.map((column) => (
                        <th key={column} className="px-3 py-2 font-mono text-[11px]">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {legacyPositionRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b last:border-b-0">
                        {legacyPositionTableColumns.map((column) => (
                          <td key={`${rowIndex}-${column}`} className="px-3 py-2 align-top">
                            {column === 'payload' ? toDisplayCellBlock(row) : toDisplayCellBlock(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-background">
            <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Legacy Option Legs (from position payload)
            </div>
            {legacyOptionLegRows.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No option legs returned yet.</p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {legacyOptionLegTableColumns.map((column) => (
                        <th key={column} className="px-3 py-2 font-mono text-[11px]">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {legacyOptionLegRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b last:border-b-0">
                        {legacyOptionLegTableColumns.map((column) => (
                          <td key={`${rowIndex}-${column}`} className="px-3 py-2 align-top">
                            {column === 'payload' ? toDisplayCellBlock(row) : toDisplayCellBlock(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-background">
            <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              OpenAPI Positions (/openapi/assets/positions)
            </div>
            {assetsPositionRows.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No positions returned yet.</p>
            ) : (
              <div className="overflow-auto">
                {assetsPositionMetaFields.length > 0 && (
                  <table className="min-w-full border-b text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                        <th className="px-3 py-2">Payload Field</th>
                        <th className="px-3 py-2">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetsPositionMetaFields.map((item) => (
                        <tr key={item.key} className="border-b last:border-b-0">
                          <td className="px-3 py-2 font-mono text-xs">{item.key}</td>
                          <td className="px-3 py-2">{item.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {assetsPositionTableColumns.map((column) => (
                        <th key={column} className="px-3 py-2 font-mono text-[11px]">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assetsPositionRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b last:border-b-0">
                        {assetsPositionTableColumns.map((column) => (
                          <td key={`${rowIndex}-${column}`} className="px-3 py-2 align-top">
                            {column === 'payload' ? toDisplayCellBlock(row) : toDisplayCellBlock(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-background">
            <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              OpenAPI Option Legs (from position payload)
            </div>
            {assetsOptionLegRows.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No option legs returned yet.</p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {assetsOptionLegTableColumns.map((column) => (
                        <th key={column} className="px-3 py-2 font-mono text-[11px]">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assetsOptionLegRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b last:border-b-0">
                        {assetsOptionLegTableColumns.map((column) => (
                          <td key={`${rowIndex}-${column}`} className="px-3 py-2 align-top">
                            {column === 'payload' ? toDisplayCellBlock(row) : toDisplayCellBlock(row[column])}
                          </td>
                        ))}
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
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Legacy Account Balance</p>
                <pre className="max-h-48 overflow-auto rounded-md border p-2 text-xs leading-5">{toJsonBlock(accountBalanceLegacy)}</pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">Legacy Positions</p>
                <pre className="max-h-48 overflow-auto rounded-md border p-2 text-xs leading-5">{toJsonBlock(accountPositionsLegacy)}</pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">OpenAPI Assets Account</p>
                <pre className="max-h-48 overflow-auto rounded-md border p-2 text-xs leading-5">{toJsonBlock(assetsAccount)}</pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">OpenAPI Assets Positions</p>
                <pre className="max-h-48 overflow-auto rounded-md border p-2 text-xs leading-5">{toJsonBlock(assetsPositions)}</pre>
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
