import { useCallback, useEffect, useState } from 'react'
import F9WorkspaceBlock from '../lego_blocks/integrations/F9WorkspaceBlock'
import {
  fetchF9OverallSnapshotOrch,
  getF9RuntimeSurfaceOrch,
  type F9RuntimeSurfaceOrch,
  type F9OverallSnapshotOrch,
} from '../../services/orchestrators/f9OverallOrch'
import {
  createF9CompanyOrch,
  createF9ManualPositionOrch,
  loadF9OverallCacheOrch,
  loadF9ExecutionOverviewOrch,
  loadF9PositionDetailOrch,
  saveF9PositionBodyOrch,
  syncF9ExecutionFromOverallOrch,
  updateF9PositionOverlayOrch,
  type F9CompanyOverviewBlock,
  type F9ExecutionOverviewBlock,
  type F9OverallCacheBlock,
  type F9PositionDetailBlock,
  type SyncF9ExecutionResultBlock,
} from '../../services/orchestrators/f9ExecutionOrch'
import { hasF9WebullConfigBlock } from '../../services/lego_blocks/units/f9WebullConfigBlock'
import { useMarkdownViewer } from '@/components/orchestrators/MarkdownViewerOrch'

type F9SubtabId = 'overall'

const F9_SUBTABS: Array<{ id: F9SubtabId; label: string }> = [
  { id: 'overall', label: 'Overall' },
]

function toSnapshotFromCacheBlock(
  cache: F9OverallCacheBlock,
  runtime: F9RuntimeSurfaceOrch,
): F9OverallSnapshotOrch {
  const refreshRuntime = cache.runtime === 'electron' || cache.runtime === 'capacitor' || cache.runtime === 'web'
    ? cache.runtime
    : null
  const runtimeHint = refreshRuntime ?? 'unknown runtime'
  const warning = runtime === 'electron'
    ? `Loaded saved F9 data from ${cache.overallPath}.`
    : `Showing saved F9 data from ${cache.overallPath}. Refresh from Electron app (last refresh runtime: ${runtimeHint}).`
  const selectedAccountRecord = (cache.selectedAccount && typeof cache.selectedAccount === 'object')
    ? cache.selectedAccount as Record<string, unknown>
    : null
  const selectedAccountId = selectedAccountRecord
    ? String(selectedAccountRecord.accountId ?? selectedAccountRecord.account_id ?? '')
    : ''
  return {
    runtime: refreshRuntime ?? runtime,
    fetchedAt: cache.fetchedAt || 'Unknown',
    endpoints: {
      accountList: null,
      accountBalanceLegacy: null,
      accountPositionsLegacy: null,
      assetsAccount: null,
      assetsPositions: null,
      marketQuotes: null,
    },
    selectedAccount: selectedAccountId
      ? {
        accountId: selectedAccountId,
        accountNumber: String(selectedAccountRecord?.accountNumber ?? selectedAccountRecord?.account_number ?? '') || null,
        subscriptionId: String(selectedAccountRecord?.subscriptionId ?? selectedAccountRecord?.subscription_id ?? '') || null,
      }
      : null,
    accountList: cache.accountList,
    accountBalanceLegacy: cache.accountBalanceLegacy,
    accountPositionsLegacy: cache.accountPositionsLegacy,
    assetsAccount: null,
    assetsPositions: cache.assetsPositions,
    marketQuotes: null,
    attempts: [
      `Loaded cache file: ${cache.overallPath}`,
      `Cache source: ${cache.source}`,
      `Cache fetched_at: ${cache.fetchedAt || 'unknown'}`,
      `Cache runtime: ${cache.runtime || 'unknown'}`,
    ],
    warnings: [warning],
  }
}

export default function F9Orch() {
  const { openFile } = useMarkdownViewer()
  const [activeSubtabId, setActiveSubtabId] = useState<F9SubtabId>('overall')
  const [snapshot, setSnapshot] = useState<F9OverallSnapshotOrch | null>(null)
  const [executionOverview, setExecutionOverview] = useState<F9ExecutionOverviewBlock | null>(null)
  const [executionSync, setExecutionSync] = useState<SyncF9ExecutionResultBlock | null>(null)
  const [executionOverviewLoading, setExecutionOverviewLoading] = useState(false)
  const [activeCompanyTicker, setActiveCompanyTicker] = useState<string | null>(null)
  const [activePositionFileName, setActivePositionFileName] = useState<string | null>(null)
  const [activePositionDetail, setActivePositionDetail] = useState<F9PositionDetailBlock | null>(null)
  const [positionDetailLoading, setPositionDetailLoading] = useState(false)
  const [positionDetailError, setPositionDetailError] = useState<string | null>(null)
  const [workspaceBusy, setWorkspaceBusy] = useState(false)
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null)
  const [executionSyncError, setExecutionSyncError] = useState<string | null>(null)
  const [runtime] = useState<F9RuntimeSurfaceOrch>(getF9RuntimeSurfaceOrch())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasConfig = hasF9WebullConfigBlock()

  const activeCompany: F9CompanyOverviewBlock | null = executionOverview?.companies.find(
    (company) => company.companyTicker === activeCompanyTicker,
  ) ?? null

  const loadExecutionOverview = useCallback(async (): Promise<F9ExecutionOverviewBlock | null> => {
    setExecutionOverviewLoading(true)
    try {
      const overview = await loadF9ExecutionOverviewOrch()
      setExecutionOverview(overview)
      return overview
    } catch (overviewErr) {
      setExecutionSyncError(
        overviewErr instanceof Error
          ? overviewErr.message
          : 'Failed to read F9 execution company index files.',
      )
      return null
    } finally {
      setExecutionOverviewLoading(false)
    }
  }, [])

  const loadSavedOverallSnapshot = useCallback(async (): Promise<F9OverallSnapshotOrch | null> => {
    try {
      const cached = await loadF9OverallCacheOrch()
      if (!cached) return null
      const cachedSnapshot = toSnapshotFromCacheBlock(cached, runtime)
      setSnapshot(cachedSnapshot)
      return cachedSnapshot
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read saved F9 overall.json cache.')
      return null
    }
  }, [runtime])

  const refreshOverall = useCallback(async () => {
    setLoading(true)
    setError(null)
    setExecutionSyncError(null)
    setWorkspaceMessage(null)
    try {
      if (runtime !== 'electron') {
        const cachedSnapshot = await loadSavedOverallSnapshot()
        await loadExecutionOverview()
        if (cachedSnapshot) {
          setWorkspaceMessage('Loaded saved F9 data. Use the Electron app to refresh live Webull data.')
        } else {
          setError('No saved F9 data found. Refresh once from the Electron app to generate overall.json.')
        }
        return
      }

      const next = await fetchF9OverallSnapshotOrch()
      setSnapshot(next)
      let syncErrorMessage: string | null = null
      try {
        const syncResult = await syncF9ExecutionFromOverallOrch(next)
        setExecutionSync(syncResult)
      } catch (syncErr) {
        syncErrorMessage = syncErr instanceof Error ? syncErr.message : 'Failed to sync F9 execution files.'
        setExecutionSyncError(syncErrorMessage)
      }
      try {
        const overview = await loadF9ExecutionOverviewOrch()
        setExecutionOverview(overview)
      } catch (overviewErr) {
        if (!syncErrorMessage) {
          setExecutionSyncError(
            overviewErr instanceof Error
              ? overviewErr.message
              : 'Failed to read F9 execution company index files.',
          )
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load F9 Overall data.')
    } finally {
      setLoading(false)
    }
  }, [loadExecutionOverview, loadSavedOverallSnapshot, runtime])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      loadF9ExecutionOverviewOrch(),
      loadF9OverallCacheOrch(),
    ])
      .then(([overview, cached]) => {
        if (cancelled) return
        setExecutionOverview(overview)
        if (cached) {
          setSnapshot(toSnapshotFromCacheBlock(cached, runtime))
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Ignore initial load failures; refresh flow surfaces actionable errors.
        }
      })
    return () => {
      cancelled = true
    }
  }, [runtime])

  useEffect(() => {
    if (!executionOverview || executionOverview.companies.length === 0) {
      setActiveCompanyTicker(null)
      return
    }
    if (!activeCompanyTicker) return
    const exists = executionOverview.companies.some((company) => company.companyTicker === activeCompanyTicker)
    if (!exists) {
      setActiveCompanyTicker(null)
    }
  }, [activeCompanyTicker, executionOverview])

  useEffect(() => {
    if (!activeCompany) {
      setActivePositionFileName(null)
      setActivePositionDetail(null)
      setPositionDetailError(null)
      return
    }
    if (activeCompany.positions.length === 0) {
      setActivePositionFileName(null)
      setActivePositionDetail(null)
      setPositionDetailError(null)
      return
    }
    if (!activePositionFileName) {
      setActivePositionFileName(activeCompany.positions[0].fileName)
      return
    }
    const exists = activeCompany.positions.some((position) => position.fileName === activePositionFileName)
    if (!exists) {
      setActivePositionFileName(activeCompany.positions[0].fileName)
    }
  }, [activeCompany, activePositionFileName])

  useEffect(() => {
    if (!activeCompanyTicker || !activePositionFileName) {
      setActivePositionDetail(null)
      setPositionDetailError(null)
      return
    }
    let cancelled = false
    setPositionDetailLoading(true)
    setPositionDetailError(null)
    void loadF9PositionDetailOrch(activeCompanyTicker, activePositionFileName)
      .then((detail) => {
        if (cancelled) return
        setActivePositionDetail(detail)
      })
      .catch((detailErr) => {
        if (cancelled) return
        setActivePositionDetail(null)
        setPositionDetailError(detailErr instanceof Error ? detailErr.message : 'Failed to load position detail.')
      })
      .finally(() => {
        if (!cancelled) setPositionDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeCompanyTicker, activePositionFileName])

  const onCreateCompany = useCallback(async (companyTicker: string) => {
    setWorkspaceBusy(true)
    setWorkspaceMessage(null)
    setExecutionSyncError(null)
    try {
      const company = await createF9CompanyOrch(companyTicker)
      await loadExecutionOverview()
      setActiveCompanyTicker(company.companyTicker)
      setWorkspaceMessage(`Added company ${company.companyTicker}.`)
    } catch (err) {
      setExecutionSyncError(err instanceof Error ? err.message : 'Failed to create company.')
    } finally {
      setWorkspaceBusy(false)
    }
  }, [loadExecutionOverview])

  const onCreateManualPosition = useCallback(async (input: {
    title?: string
    status?: 'taken' | 'planned' | 'watchlist'
    instrumentType?: 'STOCK' | 'OPTION'
    optionType?: 'CALL' | 'PUT' | null
    optionExpireDate?: string | null
    optionExercisePrice?: string | null
    linkedIdeaId?: string | null
    notes?: string
  }) => {
    if (!activeCompanyTicker) return
    setWorkspaceBusy(true)
    setWorkspaceMessage(null)
    setExecutionSyncError(null)
    try {
      const created = await createF9ManualPositionOrch({
        companyTicker: activeCompanyTicker,
        ...input,
      })
      await loadExecutionOverview()
      setActivePositionFileName(created.fileName)
      setWorkspaceMessage(`Added position ${created.fileName}.`)
    } catch (err) {
      setExecutionSyncError(err instanceof Error ? err.message : 'Failed to create position.')
    } finally {
      setWorkspaceBusy(false)
    }
  }, [activeCompanyTicker, loadExecutionOverview])

  const onUpdatePositionOverlay = useCallback(async (input: {
    fileName?: string
    status?: 'taken' | 'planned' | 'watchlist'
    linkedIdeaId?: string | null
    title?: string | null
    priority?: 'low' | 'medium' | 'high' | 'critical' | null
    description?: string | null
    comments?: Array<{
      text: string
      added_at?: string
      added_by?: string
    }>
    tags?: string[]
    projectPresetTags?: string[]
  }) => {
    if (!activeCompanyTicker) return
    const fileName = input.fileName ?? activePositionFileName
    if (!fileName) return
    setWorkspaceBusy(true)
    setWorkspaceMessage(null)
    setExecutionSyncError(null)
    try {
      const detail = await updateF9PositionOverlayOrch({
        companyTicker: activeCompanyTicker,
        fileName,
        ...input,
      })
      setActivePositionFileName(fileName)
      setActivePositionDetail(detail)
      await loadExecutionOverview()
      setWorkspaceMessage('Position metadata updated.')
    } catch (err) {
      setExecutionSyncError(err instanceof Error ? err.message : 'Failed to update position fields.')
    } finally {
      setWorkspaceBusy(false)
    }
  }, [activeCompanyTicker, activePositionFileName, loadExecutionOverview])

  const onSavePositionBody = useCallback(async (body: string) => {
    if (!activeCompanyTicker || !activePositionFileName) return
    setWorkspaceBusy(true)
    setWorkspaceMessage(null)
    setExecutionSyncError(null)
    try {
      const detail = await saveF9PositionBodyOrch({
        companyTicker: activeCompanyTicker,
        fileName: activePositionFileName,
        body,
      })
      setActivePositionDetail(detail)
      setWorkspaceMessage('Position notes saved.')
    } catch (err) {
      setExecutionSyncError(err instanceof Error ? err.message : 'Failed to save position notes.')
    } finally {
      setWorkspaceBusy(false)
    }
  }, [activeCompanyTicker, activePositionFileName])

  useEffect(() => {
    if (activeSubtabId !== 'overall') return
    if (runtime !== 'electron') {
      void refreshOverall()
      return
    }
    if (!hasConfig) {
      void loadSavedOverallSnapshot()
      return
    }
    void refreshOverall()
  }, [activeSubtabId, hasConfig, loadSavedOverallSnapshot, refreshOverall, runtime])

  return (
    <F9WorkspaceBlock
      subtabs={F9_SUBTABS}
      activeSubtabId={activeSubtabId}
      onSelectSubtab={setActiveSubtabId}
      hasConfig={hasConfig}
      liveRefreshAvailable={runtime === 'electron'}
      loading={loading}
      error={error}
      runtime={runtime}
      lastRefreshRuntime={snapshot?.runtime ?? null}
      fetchedAt={snapshot?.fetchedAt ?? null}
      endpoints={snapshot?.endpoints ?? {
        accountList: null,
        accountBalanceLegacy: null,
        accountPositionsLegacy: null,
        assetsAccount: null,
        assetsPositions: null,
        marketQuotes: null,
      }}
      selectedAccount={snapshot?.selectedAccount ?? null}
      accountList={snapshot?.accountList ?? null}
      accountBalanceLegacy={snapshot?.accountBalanceLegacy ?? null}
      accountPositionsLegacy={snapshot?.accountPositionsLegacy ?? null}
      assetsAccount={snapshot?.assetsAccount ?? null}
      assetsPositions={snapshot?.assetsPositions ?? null}
      marketQuotes={snapshot?.marketQuotes ?? null}
      warnings={snapshot?.warnings ?? []}
      attempts={snapshot?.attempts ?? []}
      executionRoot={executionOverview?.executionRoot ?? executionSync?.executionRoot ?? null}
      executionCompanyCount={executionOverview?.companyCount ?? executionSync?.companyCount ?? 0}
      executionPositionCount={executionOverview?.positionCount ?? executionSync?.positionCount ?? 0}
      executionSyncSource={executionSync?.source ?? 'none'}
      executionSyncWarnings={executionSync?.warnings ?? []}
      executionSyncError={executionSyncError}
      executionOverview={executionOverview}
      executionOverviewLoading={executionOverviewLoading}
      activeCompanyTicker={activeCompanyTicker}
      onSelectCompanyTicker={setActiveCompanyTicker}
      activePositionFileName={activePositionFileName}
      onSelectPositionFileName={setActivePositionFileName}
      activePositionDetail={activePositionDetail}
      positionDetailLoading={positionDetailLoading}
      positionDetailError={positionDetailError}
      workspaceBusy={workspaceBusy}
      workspaceMessage={workspaceMessage}
      onCreateCompany={onCreateCompany}
      onCreateManualPosition={onCreateManualPosition}
      onUpdatePositionOverlay={onUpdatePositionOverlay}
      onSavePositionBody={onSavePositionBody}
      onOpenNodeFile={(filePath) => openFile(filePath, { mode: 'edit' })}
      onRefreshExecutionOverview={loadExecutionOverview}
      onRefreshOverall={refreshOverall}
    />
  )
}
