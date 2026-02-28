import { useCallback, useEffect, useMemo, useState } from 'react'
import BacklogListBlock from '@/components/lego_blocks/integrations/BacklogListBlock'
import type { BacklogRowColumnBlock } from '@/components/lego_blocks/units/BacklogRowColumnsBlock'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import type { F9RuntimeSurfaceOrch, F9SelectedAccountOrch } from '@/personal_extension/services/orchestrators/f9OverallOrch'
import type {
  F9CompanyOverviewBlock,
  F9ExecutionOverviewBlock,
  F9PositionDetailBlock,
  F9PositionSummaryBlock,
} from '@/personal_extension/services/orchestrators/f9ExecutionOrch'

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
  executionRoot: string | null
  executionCompanyCount: number
  executionPositionCount: number
  executionSyncSource: 'assets_positions' | 'legacy_positions' | 'none'
  executionSyncWarnings: string[]
  executionSyncError: string | null
  executionOverview: F9ExecutionOverviewBlock | null
  executionOverviewLoading: boolean
  activeCompanyTicker: string | null
  onSelectCompanyTicker: (companyTicker: string | null) => void
  activePositionFileName: string | null
  onSelectPositionFileName: (fileName: string) => void
  activePositionDetail: F9PositionDetailBlock | null
  positionDetailLoading: boolean
  positionDetailError: string | null
  workspaceBusy: boolean
  workspaceMessage: string | null
  onCreateCompany: (companyTicker: string) => Promise<void>
  onCreateManualPosition: (input: {
    title?: string
    status?: 'taken' | 'planned' | 'watchlist'
    instrumentType?: 'STOCK' | 'OPTION'
    optionType?: 'CALL' | 'PUT' | null
    optionExpireDate?: string | null
    optionExercisePrice?: string | null
    linkedIdeaId?: string | null
    notes?: string
  }) => Promise<void>
  onUpdatePositionOverlay: (input: {
    fileName?: string
    status?: 'taken' | 'planned' | 'watchlist'
    linkedIdeaId?: string | null
  }) => Promise<void>
  onSavePositionBody: (body: string) => Promise<void>
  onRefreshExecutionOverview: () => Promise<F9ExecutionOverviewBlock | null>
  onRefreshOverall: () => void
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
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
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

function formatCurrencyFromUnknownBlock(value: unknown): string {
  return formatCurrencyBlock(firstNumberBlock(value))
}

function formatOverallValueBlock(balanceData: unknown): string {
  if (!balanceData || typeof balanceData !== 'object') return '—'
  const row = balanceData as Record<string, unknown>
  const currencyAssets = Array.isArray(row.account_currency_assets)
    ? row.account_currency_assets.find(item => !!item && typeof item === 'object') as Record<string, unknown> | undefined
    : undefined
  const value = firstNumberBlock(
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
  )
  return formatCurrencyBlock(value)
}

function statusChipClassBlock(status: string): string {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'taken') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  if (normalized === 'planned') return 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
  if (normalized === 'watchlist') return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  return 'border-border bg-muted/40 text-foreground'
}

function normalizeKeyFragmentBlock(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return normalized || 'item'
}

function mapPositionStatusToNodeStatusBlock(status: string | null | undefined): NodeRecord['status'] {
  const normalized = (status ?? '').trim().toLowerCase()
  if (normalized === 'taken') return 'active'
  if (normalized === 'watchlist') return 'paused'
  if (normalized === 'planned') return 'incomplete'
  return 'active'
}

function positionTitleFromSummaryBlock(position: F9PositionSummaryBlock): string {
  const symbol = firstStringBlock(position.symbol) || 'UNKNOWN'
  const optionType = firstStringBlock(position.optionType).toUpperCase()
  const optionExpireDate = firstStringBlock(position.optionExpireDate)
  const optionStrike = firstStringBlock(position.optionExercisePrice)
  if (optionType && optionExpireDate && optionStrike) {
    return `${symbol} ${optionStrike} ${optionExpireDate} ${optionType}`
  }
  return symbol
}

function buildFallbackCompaniesFromOverallRowsBlock(rows: Array<Record<string, unknown>>): F9CompanyOverviewBlock[] {
  const grouped = new Map<string, F9PositionSummaryBlock[]>()
  for (const row of rows) {
    const ticker = firstStringBlock(row.symbol, row.ticker, row.position_symbol, row.stock_code).toUpperCase()
    if (!ticker) continue
    const legId = firstStringBlock(row.leg_id, row.id) || `${ticker}-${grouped.get(ticker)?.length ?? 0}`
    const fileName = `${toOverallPositionTitleBlock(row).replace(/\s+/g, '-')}.md`
    const status = (firstStringBlock(row.status, row.position_status) || 'taken').toLowerCase()
    const list = grouped.get(ticker) ?? []
    list.push({
      id: legId,
      fileName,
      symbol: ticker,
      status: status || 'taken',
      source: 'overall_payload',
      instrumentType: firstStringBlock(row.instrument_type, row.type) || null,
      optionType: firstStringBlock(row.option_type) || null,
      optionExpireDate: firstStringBlock(row.option_expire_date) || null,
      optionExercisePrice: firstStringBlock(row.option_exercise_price) || null,
      cost: firstStringBlock(row.cost) || null,
      proportion: firstStringBlock(row.proportion) || null,
      lastPrice: firstStringBlock(row.last_price) || null,
      unrealizedProfitLoss: firstStringBlock(row.unrealized_profit_loss) || null,
      dayProfitLoss: firstStringBlock(row.day_profit_loss) || null,
      linkedIdeaId: null,
    })
    grouped.set(ticker, list)
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ticker, positions]) => ({
      companyTicker: ticker,
      indexFilePath: '',
      indexId: `${ticker}-index`,
      strategyNotes: '',
      relatedIdeaIds: [],
      positions,
    }))
}

function toOverallPositionTitleBlock(row: Record<string, unknown>): string {
  const symbol = firstStringBlock(row.symbol, row.ticker, row.position_symbol, row.stock_code) || 'UNKNOWN'
  const optionType = firstStringBlock(row.option_type).toUpperCase()
  const optionExpireDate = firstStringBlock(row.option_expire_date)
  const optionStrike = firstStringBlock(row.option_exercise_price)
  if (optionType && optionExpireDate && optionStrike) {
    return `${symbol} ${optionStrike} ${optionExpireDate} ${optionType}`
  }
  return symbol
}

function toJsonBlock(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2)
}

function asMetadataRecordBlock(node: NodeRecord): Record<string, unknown> {
  const metadata = node.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
  return metadata as Record<string, unknown>
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
  accountBalanceLegacy,
  accountPositionsLegacy,
  assetsAccount,
  assetsPositions,
  warnings,
  attempts,
  executionRoot,
  executionCompanyCount,
  executionPositionCount,
  executionSyncSource,
  executionSyncWarnings,
  executionSyncError,
  executionOverview,
  executionOverviewLoading,
  activeCompanyTicker,
  onSelectCompanyTicker,
  activePositionFileName,
  onSelectPositionFileName,
  activePositionDetail,
  positionDetailLoading,
  positionDetailError,
  workspaceBusy,
  workspaceMessage,
  onCreateCompany,
  onCreateManualPosition,
  onUpdatePositionOverlay,
  onSavePositionBody,
  onRefreshExecutionOverview,
  onRefreshOverall,
}: F9WorkspaceBlockProps) {
  const allWarnings = [...warnings, ...executionSyncWarnings]
  const overallRows = asRecordArrayBlock(assetsPositions).length > 0
    ? asRecordArrayBlock(assetsPositions)
    : asRecordArrayBlock(accountPositionsLegacy)

  const selectedCompany = useMemo(
    () => executionOverview?.companies.find((company) => company.companyTicker === activeCompanyTicker) ?? null,
    [activeCompanyTicker, executionOverview],
  )

  const selectedPositionSummary = useMemo(
    () => selectedCompany?.positions.find((position) => position.fileName === activePositionFileName) ?? null,
    [activePositionFileName, selectedCompany],
  )

  const companiesForTable = useMemo<F9CompanyOverviewBlock[]>(() => {
    if (selectedCompany) return [selectedCompany]
    if ((executionOverview?.companies.length ?? 0) > 0) return executionOverview?.companies ?? []
    return buildFallbackCompaniesFromOverallRowsBlock(overallRows)
  }, [executionOverview?.companies, overallRows, selectedCompany])

  const backlogTableModel = useMemo(() => {
    const now = new Date().toISOString()
    const programs: NodeRecord[] = []
    const positionNodesByProgramUuid = new Map<string, NodeRecord[]>()
    const companyTickerByProgramUuid = new Map<string, string>()
    const positionRefByNodeUuid = new Map<string, { companyTicker: string; fileName: string }>()
    const nodeUuidByCompanyAndFile = new Map<string, string>()

    for (const company of companiesForTable) {
      const companyTicker = company.companyTicker.toUpperCase()
      const programUuid = `f9-company-${normalizeKeyFragmentBlock(companyTicker)}`
      companyTickerByProgramUuid.set(programUuid, companyTicker)
      programs.push({
        uuid: programUuid,
        key: programUuid,
        title: `${companyTicker} Positions`,
        type: 'program',
        level: 0,
        ticket: `${companyTicker}-POS`,
        filePath: company.indexFilePath || `f9/${companyTicker}/${companyTicker}-index.md`,
        projectRoot: executionRoot ?? 'f9-execution',
        tags: ['f9', 'execution', companyTicker.toLowerCase()],
        status: 'active',
        createdAt: now,
        updatedAt: now,
        metadata: {
          f9_company_ticker: companyTicker,
          f9_position_count: company.positions.length,
        },
      })

      const nodes = company.positions.map((position, index) => {
        const fileName = position.fileName
        const nodeUuid = `f9-pos-${normalizeKeyFragmentBlock(companyTicker)}-${normalizeKeyFragmentBlock(fileName)}`
        positionRefByNodeUuid.set(nodeUuid, { companyTicker, fileName })
        nodeUuidByCompanyAndFile.set(`${companyTicker}::${fileName}`, nodeUuid)
        const ticketCandidate = firstStringBlock(position.id).slice(0, 18)
        return {
          uuid: nodeUuid,
          key: nodeUuid,
          title: positionTitleFromSummaryBlock(position),
          type: 'epic',
          level: 1,
          parent: programUuid,
          parentUuid: programUuid,
          parentType: 'program',
          ticket: ticketCandidate || undefined,
          filePath: `f9/${companyTicker}/positions/${fileName}`,
          projectRoot: executionRoot ?? 'f9-execution',
          description: [
            `status: ${position.status || 'taken'}`,
            `type: ${position.instrumentType || '—'}`,
            `last: ${formatCurrencyFromUnknownBlock(position.lastPrice)}`,
            `cost: ${formatCurrencyFromUnknownBlock(position.cost)}`,
            `p/l: ${formatCurrencyFromUnknownBlock(position.unrealizedProfitLoss)}`,
          ].join(' | '),
          tags: [
            'f9',
            'execution',
            companyTicker.toLowerCase(),
            firstStringBlock(position.instrumentType).toLowerCase() || 'position',
          ],
          status: mapPositionStatusToNodeStatusBlock(position.status),
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
          metadata: {
            f9_company_ticker: companyTicker,
            f9_position_file_name: fileName,
            f9_position_status: position.status || 'taken',
            f9_linked_idea_id: position.linkedIdeaId ?? '',
            f9_position_payload: {
              id: position.id,
              file_name: position.fileName,
              symbol: position.symbol,
              status: position.status,
              source: position.source,
              instrument_type: position.instrumentType,
              option_type: position.optionType,
              option_expire_date: position.optionExpireDate,
              option_exercise_price: position.optionExercisePrice,
              cost: position.cost,
              proportion: position.proportion,
              last_price: position.lastPrice,
              unrealized_profit_loss: position.unrealizedProfitLoss,
              day_profit_loss: position.dayProfitLoss,
              linked_idea_id: position.linkedIdeaId,
            },
          },
        } satisfies NodeRecord
      })

      positionNodesByProgramUuid.set(programUuid, nodes)
    }

    return {
      programs,
      positionNodesByProgramUuid,
      companyTickerByProgramUuid,
      positionRefByNodeUuid,
      nodeUuidByCompanyAndFile,
    }
  }, [companiesForTable, executionRoot])

  const selectedBacklogNodeId = useMemo(() => {
    if (!activeCompanyTicker || !activePositionFileName) return null
    return backlogTableModel.nodeUuidByCompanyAndFile.get(`${activeCompanyTicker.toUpperCase()}::${activePositionFileName}`) ?? null
  }, [activeCompanyTicker, activePositionFileName, backlogTableModel.nodeUuidByCompanyAndFile])

  const loadBacklogEpics = useCallback(async (program: NodeRecord): Promise<NodeRecord[]> => {
    return backlogTableModel.positionNodesByProgramUuid.get(program.uuid) ?? []
  }, [backlogTableModel.positionNodesByProgramUuid])

  const loadBacklogChildren = useCallback(async (): Promise<NodeRecord[]> => [], [])

  const onSelectBacklogNode = useCallback((node: NodeRecord) => {
    if (node.type === 'program') {
      const companyTicker = backlogTableModel.companyTickerByProgramUuid.get(node.uuid)
      if (companyTicker) onSelectCompanyTicker(companyTicker)
      return
    }
    const positionRef = backlogTableModel.positionRefByNodeUuid.get(node.uuid)
    if (!positionRef) return
    onSelectCompanyTicker(positionRef.companyTicker)
    onSelectPositionFileName(positionRef.fileName)
  }, [
    backlogTableModel.companyTickerByProgramUuid,
    backlogTableModel.positionRefByNodeUuid,
    onSelectCompanyTicker,
    onSelectPositionFileName,
  ])

  const f9RowColumns = useMemo<BacklogRowColumnBlock[]>(() => {
    const getMetaValue = (node: NodeRecord, key: string): string => {
      const metadata = asMetadataRecordBlock(node)
      return firstStringBlock(metadata[key])
    }
    const epicOnly: NodeRecord['type'][] = ['epic']
    return [
      {
        id: 'status',
        label: 'Status',
        widthClassName: 'w-24',
        showForTypes: epicOnly,
        render: (node) => {
          const status = getMetaValue(node, 'f9_position_status') || '—'
          return (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusChipClassBlock(status)}`}>
              {status}
            </span>
          )
        },
      },
      {
        id: 'type',
        label: 'Type',
        widthClassName: 'w-16',
        showForTypes: epicOnly,
        render: (node) => {
          const payload = asMetadataRecordBlock(node).f9_position_payload as Record<string, unknown> | undefined
          return firstStringBlock(payload?.instrument_type) || '—'
        },
      },
      {
        id: 'last',
        label: 'Last',
        widthClassName: 'w-20',
        align: 'right',
        showForTypes: epicOnly,
        render: (node) => {
          const payload = asMetadataRecordBlock(node).f9_position_payload as Record<string, unknown> | undefined
          return formatCurrencyFromUnknownBlock(payload?.last_price)
        },
      },
      {
        id: 'cost',
        label: 'Cost',
        widthClassName: 'w-20',
        align: 'right',
        showForTypes: epicOnly,
        render: (node) => {
          const payload = asMetadataRecordBlock(node).f9_position_payload as Record<string, unknown> | undefined
          return formatCurrencyFromUnknownBlock(payload?.cost)
        },
      },
      {
        id: 'upl',
        label: 'U P/L',
        widthClassName: 'w-24',
        align: 'right',
        showForTypes: epicOnly,
        render: (node) => {
          const payload = asMetadataRecordBlock(node).f9_position_payload as Record<string, unknown> | undefined
          return formatCurrencyFromUnknownBlock(payload?.unrealized_profit_loss)
        },
      },
      {
        id: 'idea',
        label: 'Linked Idea',
        widthClassName: 'w-28',
        showForTypes: epicOnly,
        render: (node) => getMetaValue(node, 'f9_linked_idea_id') || '—',
      },
    ]
  }, [])

  const renderF9RowDetails = useCallback((node: NodeRecord) => {
    const metadata = asMetadataRecordBlock(node)
    if (node.type === 'program') {
      return (
        <div className="grid gap-1 text-xs">
          <p><span className="font-medium text-foreground">Company:</span> {firstStringBlock(metadata.f9_company_ticker) || node.title}</p>
          <p><span className="font-medium text-foreground">Positions:</span> {firstStringBlock(metadata.f9_position_count) || '0'}</p>
          <p><span className="font-medium text-foreground">Source:</span> Company index + position files</p>
        </div>
      )
    }

    const payload = metadata.f9_position_payload
    const payloadEntries = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? Object.entries(payload as Record<string, unknown>)
      : []

    if (payloadEntries.length === 0) {
      return <p className="text-xs text-muted-foreground">No position payload details.</p>
    }

    return (
      <div className="grid gap-1 text-xs md:grid-cols-2">
        {payloadEntries.map(([key, value]) => (
          <p key={`${node.uuid}-detail-${key}`}>
            <span className="font-medium text-foreground">{key}:</span>{' '}
            <span className="text-muted-foreground">{firstStringBlock(value) || '—'}</span>
          </p>
        ))}
      </div>
    )
  }, [])

  const [newCompanyTicker, setNewCompanyTicker] = useState('')
  const [newPositionTitle, setNewPositionTitle] = useState('')
  const [newPositionStatus, setNewPositionStatus] = useState<'taken' | 'planned' | 'watchlist'>('planned')
  const [newInstrumentType, setNewInstrumentType] = useState<'STOCK' | 'OPTION'>('STOCK')
  const [newOptionType, setNewOptionType] = useState<'CALL' | 'PUT'>('CALL')
  const [newOptionExpiry, setNewOptionExpiry] = useState('')
  const [newOptionStrike, setNewOptionStrike] = useState('')
  const [newLinkedIdeaId, setNewLinkedIdeaId] = useState('')
  const [newPositionNotes, setNewPositionNotes] = useState('')
  const [detailBodyDraft, setDetailBodyDraft] = useState('')
  const [detailStatusDraft, setDetailStatusDraft] = useState<'taken' | 'planned' | 'watchlist'>('planned')
  const [detailLinkedIdeaDraft, setDetailLinkedIdeaDraft] = useState('')

  useEffect(() => {
    setDetailBodyDraft(activePositionDetail?.body ?? '')
  }, [activePositionDetail?.body])

  useEffect(() => {
    setDetailStatusDraft(
      (activePositionDetail?.summary.status as 'taken' | 'planned' | 'watchlist' | undefined) ?? 'planned',
    )
    setDetailLinkedIdeaDraft(activePositionDetail?.summary.linkedIdeaId ?? '')
  }, [activePositionDetail?.summary.status, activePositionDetail?.summary.linkedIdeaId])

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="space-y-2 rounded-xl border bg-background p-3">
          {subtabs.map((subtab) => {
            const active = activeSubtabId === subtab.id && !activeCompanyTicker
            return (
              <button
                key={subtab.id}
                type="button"
                onClick={() => {
                  onSelectSubtab(subtab.id)
                  onSelectCompanyTicker(null)
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  active
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                Overall Positions
              </button>
            )
          })}

          <div className="pt-2">
            <p className="px-1 pb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Companies</p>
            <div className="space-y-1">
              {(executionOverview?.companies ?? []).map((company) => {
                const active = activeCompanyTicker === company.companyTicker
                return (
                  <button
                    key={company.companyTicker}
                    type="button"
                    onClick={() => onSelectCompanyTicker(company.companyTicker)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {company.companyTicker}
                    <span className="ml-1.5 text-xs opacity-80">({company.positions.length})</span>
                  </button>
                )
              })}
              {(executionOverview?.companies.length ?? 0) === 0 && (
                <p className="px-2 py-1 text-xs text-muted-foreground">No companies yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-background p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Add Company</p>
          <div className="space-y-2">
            <input
              type="text"
              value={newCompanyTicker}
              onChange={(event) => setNewCompanyTicker(event.target.value.toUpperCase())}
              placeholder="Ticker (e.g. TSLA)"
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
            />
            <Button
              type="button"
              className="w-full"
              size="sm"
              disabled={workspaceBusy || !newCompanyTicker.trim()}
              onClick={() => {
                const ticker = newCompanyTicker.trim()
                if (!ticker) return
                void onCreateCompany(ticker).then(() => setNewCompanyTicker(''))
              }}
            >
              Add Company
            </Button>
          </div>
        </div>
      </aside>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>{selectedCompany ? `${selectedCompany.companyTicker} Positions` : 'Overall Positions'}</CardTitle>
            <CardDescription>
              {selectedCompany
                ? 'Company-specific position rows and overlay edits.'
                : 'Canonical overall positions from Webull sync.'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => { void onRefreshExecutionOverview() }} disabled={workspaceBusy || executionOverviewLoading}>
              {executionOverviewLoading ? 'Refreshing companies...' : 'Refresh Companies'}
            </Button>
            <Button type="button" onClick={onRefreshOverall} disabled={!hasConfig || loading}>
              {loading ? 'Refreshing overall...' : 'Refresh Overall'}
            </Button>
          </div>
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

          {executionSyncError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {executionSyncError}
            </div>
          )}

          {allWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              {allWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}

          {workspaceMessage && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              {workspaceMessage}
            </div>
          )}

          {!selectedCompany && (
            <div className="grid gap-3 text-sm sm:grid-cols-4">
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
                <p className="mt-1 font-medium">{formatOverallValueBlock(accountBalanceLegacy ?? assetsAccount)}</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Indexed Companies</p>
                <p className="mt-1 font-medium">{executionCompanyCount}</p>
              </div>
            </div>
          )}

          {!selectedCompany ? (
            <div className="rounded-xl border bg-background p-3">
              <BacklogListBlock
                programs={backlogTableModel.programs}
                loadEpics={loadBacklogEpics}
                loadChildren={loadBacklogChildren}
                selectedNodeId={selectedBacklogNodeId}
                readOnly
                onSelectNode={onSelectBacklogNode}
                rowColumns={f9RowColumns}
                rowDetailsRenderer={renderF9RowDetails}
              />
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-background p-3">
                <BacklogListBlock
                  programs={backlogTableModel.programs}
                  loadEpics={loadBacklogEpics}
                  loadChildren={loadBacklogChildren}
                  selectedNodeId={selectedBacklogNodeId}
                  readOnly
                  onSelectNode={onSelectBacklogNode}
                  rowColumns={f9RowColumns}
                  rowDetailsRenderer={renderF9RowDetails}
                />
              </div>

              <div className="rounded-xl border bg-background p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Create Position</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    type="text"
                    value={newPositionTitle}
                    onChange={(event) => setNewPositionTitle(event.target.value)}
                    placeholder="Position title"
                    className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
                  />
                  <select
                    value={newPositionStatus}
                    onChange={(event) => setNewPositionStatus(event.target.value as 'taken' | 'planned' | 'watchlist')}
                    className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
                  >
                    <option value="planned">planned</option>
                    <option value="watchlist">watchlist</option>
                    <option value="taken">taken</option>
                  </select>
                  <select
                    value={newInstrumentType}
                    onChange={(event) => setNewInstrumentType(event.target.value as 'STOCK' | 'OPTION')}
                    className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
                  >
                    <option value="STOCK">STOCK</option>
                    <option value="OPTION">OPTION</option>
                  </select>
                  <input
                    type="text"
                    value={newLinkedIdeaId}
                    onChange={(event) => setNewLinkedIdeaId(event.target.value)}
                    placeholder="Linked idea UUID (optional)"
                    className="h-9 rounded-md border border-input bg-background px-2.5 font-mono text-xs outline-none focus:border-ring"
                  />
                  {newInstrumentType === 'OPTION' && (
                    <>
                      <select
                        value={newOptionType}
                        onChange={(event) => setNewOptionType(event.target.value as 'CALL' | 'PUT')}
                        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
                      >
                        <option value="CALL">CALL</option>
                        <option value="PUT">PUT</option>
                      </select>
                      <input
                        type="date"
                        value={newOptionExpiry}
                        onChange={(event) => setNewOptionExpiry(event.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
                      />
                      <input
                        type="text"
                        value={newOptionStrike}
                        onChange={(event) => setNewOptionStrike(event.target.value)}
                        placeholder="Strike price"
                        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-ring md:col-span-2"
                      />
                    </>
                  )}
                  <textarea
                    value={newPositionNotes}
                    onChange={(event) => setNewPositionNotes(event.target.value)}
                    placeholder="Initial notes (optional)"
                    className="min-h-[90px] rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-ring md:col-span-2"
                  />
                </div>
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    disabled={workspaceBusy}
                    onClick={() => {
                      void onCreateManualPosition({
                        title: newPositionTitle,
                        status: newPositionStatus,
                        instrumentType: newInstrumentType,
                        optionType: newInstrumentType === 'OPTION' ? newOptionType : null,
                        optionExpireDate: newInstrumentType === 'OPTION' ? newOptionExpiry : null,
                        optionExercisePrice: newInstrumentType === 'OPTION' ? newOptionStrike : null,
                        linkedIdeaId: newLinkedIdeaId || null,
                        notes: newPositionNotes || '',
                      }).then(() => {
                        setNewPositionTitle('')
                        setNewPositionStatus('planned')
                        setNewInstrumentType('STOCK')
                        setNewOptionType('CALL')
                        setNewOptionExpiry('')
                        setNewOptionStrike('')
                        setNewLinkedIdeaId('')
                        setNewPositionNotes('')
                      })
                    }}
                  >
                    Add Position
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border bg-background p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Position Details</p>
                {!selectedPositionSummary ? (
                  <p className="text-sm text-muted-foreground">Select a position row to edit fields and notes.</p>
                ) : positionDetailLoading ? (
                  <p className="text-sm text-muted-foreground">Loading position details...</p>
                ) : positionDetailError ? (
                  <p className="text-sm text-destructive">{positionDetailError}</p>
                ) : !activePositionDetail ? (
                  <p className="text-sm text-muted-foreground">No position details loaded.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs text-muted-foreground">Status</span>
                        <select
                          value={detailStatusDraft}
                          onChange={(event) => setDetailStatusDraft(event.target.value as 'taken' | 'planned' | 'watchlist')}
                          className={`h-9 w-full rounded-md border px-2.5 text-sm ${statusChipClassBlock(detailStatusDraft)}`}
                        >
                          <option value="taken">taken</option>
                          <option value="planned">planned</option>
                          <option value="watchlist">watchlist</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs text-muted-foreground">Linked Idea UUID</span>
                        <input
                          type="text"
                          value={detailLinkedIdeaDraft}
                          onChange={(event) => setDetailLinkedIdeaDraft(event.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background px-2.5 font-mono text-xs outline-none focus:border-ring"
                        />
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={workspaceBusy}
                        onClick={() => {
                          void onUpdatePositionOverlay({
                            status: detailStatusDraft,
                            linkedIdeaId: detailLinkedIdeaDraft || null,
                          })
                        }}
                      >
                        Save Fields
                      </Button>
                    </div>

                    <textarea
                      value={detailBodyDraft}
                      onChange={(event) => setDetailBodyDraft(event.target.value)}
                      className="min-h-[180px] w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-ring"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={workspaceBusy}
                        onClick={() => setDetailBodyDraft(activePositionDetail.body)}
                      >
                        Reset
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={workspaceBusy}
                        onClick={() => { void onSavePositionBody(detailBodyDraft) }}
                      >
                        Save Notes
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <details className="rounded-xl border bg-background">
            <summary className="cursor-pointer border-b px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Diagnostics
            </summary>
            <div className="space-y-2 p-3 text-xs text-muted-foreground">
              <p><span className="font-medium text-foreground">Execution Root:</span> {executionRoot ?? 'Not configured'}</p>
              <p><span className="font-medium text-foreground">Execution Companies:</span> {executionCompanyCount}</p>
              <p><span className="font-medium text-foreground">Execution Positions:</span> {executionPositionCount}</p>
              <p><span className="font-medium text-foreground">Execution Source:</span> {executionSyncSource}</p>
              <p><span className="font-medium text-foreground">Account Id:</span> {selectedAccount?.accountId ?? 'Not available'}</p>
              <p><span className="font-medium text-foreground">Account Number:</span> {selectedAccount?.accountNumber ?? 'Not available'}</p>
              <p><span className="font-medium text-foreground">Endpoint Account list:</span> {endpoints.accountList ?? 'Not requested'}</p>
              <p><span className="font-medium text-foreground">Endpoint Legacy balance:</span> {endpoints.accountBalanceLegacy ?? 'Not requested'}</p>
              <p><span className="font-medium text-foreground">Endpoint Legacy positions:</span> {endpoints.accountPositionsLegacy ?? 'Not requested'}</p>
              <p><span className="font-medium text-foreground">Endpoint OpenAPI positions:</span> {endpoints.assetsPositions ?? 'Not requested'}</p>
              {attempts.length > 0 && (
                <pre className="max-h-48 overflow-auto rounded border p-2 text-xs leading-5">{attempts.join('\n')}</pre>
              )}
              <details>
                <summary className="cursor-pointer">Raw account positions payloads</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded border p-2 text-xs leading-5">{toJsonBlock({
                  accountPositionsLegacy,
                  assetsPositions,
                })}</pre>
              </details>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}
