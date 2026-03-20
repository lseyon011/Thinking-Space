import { useCallback, useEffect, useState } from 'react'
import WebullWorkspaceBlock from '../lego_blocks/integrations/WebullWorkspaceBlock'
import {
  fetchWebullOverallSnapshotOrch,
  getWebullRuntimeSurfaceOrch,
  type WebullRuntimeSurfaceOrch,
  type WebullOverallSnapshotOrch,
} from '../../services/orchestrators/webullOverallOrch'
import {
  createWebullCompanyOrch,
  createWebullManualPositionOrch,
  loadWebullOverallCacheOrch,
  loadWebullExecutionOverviewOrch,
  loadWebullPositionDetailOrch,
  saveWebullPositionBodyOrch,
  syncWebullExecutionFromOverallOrch,
  updateWebullCompanyOverlayOrch,
  updateWebullPositionOverlayOrch,
  type WebullCompanyOverviewBlock,
  type WebullExecutionOverviewBlock,
  type WebullOverallCacheBlock,
  type WebullPositionDetailBlock,
  type SyncWebullExecutionResultBlock,
} from '../../services/orchestrators/webullExecutionOrch'
import { readWebullCredentialStatusBlock } from '../../services/lego_blocks/units/webullConfigBlock'
import { useMarkdownViewer } from '@/components/orchestrators/MarkdownViewerOrch'
import { addGlobalSyncRefreshListenerBlock } from '@/services/lego_blocks/units/globalSyncRefreshBlock'

type WebullSubtabId = 'overall' | 'memory'

const Webull_SUBTABS: Array<{ id: WebullSubtabId; label: string }> = [
  { id: 'overall', label: 'Overall Positions' },
  { id: 'memory', label: 'Pin Board' },
]

function toSnapshotFromCacheBlock(
  cache: WebullOverallCacheBlock,
  runtime: WebullRuntimeSurfaceOrch,
): WebullOverallSnapshotOrch {
  const refreshRuntime = cache.runtime === 'electron' || cache.runtime === 'capacitor' || cache.runtime === 'web'
    ? cache.runtime
    : null
  const runtimeHint = refreshRuntime ?? 'unknown runtime'
  const warning = runtime === 'electron'
    ? `Loaded saved Webull data from ${cache.overallPath}.`
    : `Showing saved Webull data from ${cache.overallPath}. Refresh from Electron app (last refresh runtime: ${runtimeHint}).`
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

export default function WebullOrch() {
  const { openFile } = useMarkdownViewer()
  const [activeSubtabId, setActiveSubtabId] = useState<WebullSubtabId>('overall')
  const [snapshot, setSnapshot] = useState<WebullOverallSnapshotOrch | null>(null)
  const [executionOverview, setExecutionOverview] = useState<WebullExecutionOverviewBlock | null>(null)
  const [executionSync, setExecutionSync] = useState<SyncWebullExecutionResultBlock | null>(null)
  const [, setExecutionOverviewLoading] = useState(false)
  const [activeCompanyTicker, setActiveCompanyTicker] = useState<string | null>(null)
  const [activePositionFileName, setActivePositionFileName] = useState<string | null>(null)
  const [activePositionDetail, setActivePositionDetail] = useState<WebullPositionDetailBlock | null>(null)
  const [positionDetailLoading, setPositionDetailLoading] = useState(false)
  const [positionDetailError, setPositionDetailError] = useState<string | null>(null)
  const [workspaceBusy, setWorkspaceBusy] = useState(false)
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null)
  const [executionSyncError, setExecutionSyncError] = useState<string | null>(null)
  const [runtime] = useState<WebullRuntimeSurfaceOrch>(getWebullRuntimeSurfaceOrch())
  const [hasConfig, setHasConfig] = useState(false)
  const [, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const executionRoot = executionOverview?.executionRoot?.trim()
    ? executionOverview.executionRoot
    : (executionSync?.executionRoot?.trim() ? executionSync.executionRoot : null)

  const activeCompany: WebullCompanyOverviewBlock | null = executionOverview?.companies.find(
    (company) => company.companyTicker === activeCompanyTicker,
  ) ?? null

  const loadExecutionOverview = useCallback(async (): Promise<WebullExecutionOverviewBlock | null> => {
    setExecutionOverviewLoading(true)
    try {
      const overview = await loadWebullExecutionOverviewOrch()
      setExecutionOverview(overview)
      return overview
    } catch (overviewErr) {
      setExecutionSyncError(
        overviewErr instanceof Error
          ? overviewErr.message
          : 'Failed to read Webull execution company index files.',
      )
      return null
    } finally {
      setExecutionOverviewLoading(false)
    }
  }, [])

  const loadSavedOverallSnapshot = useCallback(async (): Promise<WebullOverallSnapshotOrch | null> => {
    try {
      const cached = await loadWebullOverallCacheOrch()
      if (!cached) return null
      const cachedSnapshot = toSnapshotFromCacheBlock(cached, runtime)
      setSnapshot(cachedSnapshot)
      return cachedSnapshot
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read saved Webull overall.json cache.')
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
          setWorkspaceMessage(null)
        } else {
          setError('No saved Webull data found. Refresh once from the Electron app to generate overall.json.')
        }
        return
      }

      const next = await fetchWebullOverallSnapshotOrch()
      setSnapshot(next)
      let syncErrorMessage: string | null = null
      try {
        const syncResult = await syncWebullExecutionFromOverallOrch(next)
        setExecutionSync(syncResult)
      } catch (syncErr) {
        syncErrorMessage = syncErr instanceof Error ? syncErr.message : 'Failed to sync Webull execution files.'
        setExecutionSyncError(syncErrorMessage)
      }
      try {
        const overview = await loadWebullExecutionOverviewOrch()
        setExecutionOverview(overview)
      } catch (overviewErr) {
        if (!syncErrorMessage) {
          setExecutionSyncError(
            overviewErr instanceof Error
              ? overviewErr.message
              : 'Failed to read Webull execution company index files.',
          )
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Webull Overall data.')
    } finally {
      setLoading(false)
    }
  }, [loadExecutionOverview, loadSavedOverallSnapshot, runtime])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      loadWebullExecutionOverviewOrch(),
      loadWebullOverallCacheOrch(),
      readWebullCredentialStatusBlock(),
    ])
      .then(([overview, cached, credentialStatus]) => {
        if (cancelled) return
        setExecutionOverview(overview)
        setHasConfig(credentialStatus.configured)
        if (cached) {
          setSnapshot(toSnapshotFromCacheBlock(cached, runtime))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasConfig(false)
          // Ignore initial load failures; refresh flow surfaces actionable errors.
        }
      })
    return () => {
      cancelled = true
    }
  }, [runtime])

  useEffect(() => {
    if (activeSubtabId !== 'overall') return
    let cancelled = false
    void readWebullCredentialStatusBlock()
      .then((status) => {
        if (!cancelled) {
          setHasConfig(status.configured)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasConfig(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeSubtabId])

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
    return addGlobalSyncRefreshListenerBlock(() => {
      void refreshOverall()
    })
  }, [refreshOverall])

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
    void loadWebullPositionDetailOrch(activeCompanyTicker, activePositionFileName)
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
      const company = await createWebullCompanyOrch(companyTicker)
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
      const created = await createWebullManualPositionOrch({
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
    relatedNodes?: string[]
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
      const detail = await updateWebullPositionOverlayOrch({
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

  const onUpdateCompanyOverlay = useCallback(async (input: {
    companyTicker?: string | null
    strategyNotes?: string | null
    relatedIdeaIds?: string[]
    programGroupId?: string | null
    valuationNotePath?: string | null
    companyPdfReportPath?: string | null
  }) => {
    const targetCompanyTicker = (input.companyTicker ?? activeCompanyTicker)?.trim() ?? ''
    if (!targetCompanyTicker) return
    setWorkspaceBusy(true)
    setWorkspaceMessage(null)
    setExecutionSyncError(null)
    try {
      const company = await updateWebullCompanyOverlayOrch({
        ...input,
        companyTicker: targetCompanyTicker,
      })
      if (!input.companyTicker || input.companyTicker === activeCompanyTicker) {
        setActiveCompanyTicker(company.companyTicker)
      }
      await loadExecutionOverview()
      setWorkspaceMessage('Company metadata updated.')
    } catch (err) {
      setExecutionSyncError(err instanceof Error ? err.message : 'Failed to update company metadata.')
    } finally {
      setWorkspaceBusy(false)
    }
  }, [activeCompanyTicker, loadExecutionOverview])

  const onSavePositionBody = useCallback(async (body: string) => {
    if (!activeCompanyTicker || !activePositionFileName) return
    setWorkspaceBusy(true)
    setWorkspaceMessage(null)
    setExecutionSyncError(null)
    try {
      const detail = await saveWebullPositionBodyOrch({
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
    <WebullWorkspaceBlock
      subtabs={Webull_SUBTABS}
      activeSubtabId={activeSubtabId}
      onSelectSubtab={setActiveSubtabId}
      hasConfig={hasConfig}
      liveRefreshAvailable={runtime === 'electron'}
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
      executionRoot={executionRoot}
      executionCompanyCount={executionOverview?.companyCount ?? executionSync?.companyCount ?? 0}
      executionPositionCount={executionOverview?.positionCount ?? executionSync?.positionCount ?? 0}
      executionSyncSource={executionSync?.source ?? 'none'}
      executionSyncWarnings={executionSync?.warnings ?? []}
      executionSyncError={executionSyncError}
      executionOverview={executionOverview}
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
      onUpdateCompanyOverlay={onUpdateCompanyOverlay}
      onSavePositionBody={onSavePositionBody}
      onOpenNodeFile={(filePath) => openFile(filePath, { mode: 'edit' })}
    />
  )
}
