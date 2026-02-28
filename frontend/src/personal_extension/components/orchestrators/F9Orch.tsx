import { useCallback, useEffect, useState } from 'react'
import F9WorkspaceBlock from '../lego_blocks/integrations/F9WorkspaceBlock'
import {
  fetchF9OverallSnapshotOrch,
  getF9RuntimeSurfaceOrch,
  type F9RuntimeSurfaceOrch,
  type F9OverallSnapshotOrch,
} from '../../services/orchestrators/f9OverallOrch'
import {
  loadF9ExecutionOverviewOrch,
  syncF9ExecutionFromOverallOrch,
  type F9ExecutionOverviewBlock,
  type SyncF9ExecutionResultBlock,
} from '../../services/orchestrators/f9ExecutionOrch'
import { hasF9WebullConfigBlock } from '../../services/lego_blocks/units/f9WebullConfigBlock'

type F9SubtabId = 'overall'

const F9_SUBTABS: Array<{ id: F9SubtabId; label: string }> = [
  { id: 'overall', label: 'Overall' },
]

export default function F9Orch() {
  const [activeSubtabId, setActiveSubtabId] = useState<F9SubtabId>('overall')
  const [snapshot, setSnapshot] = useState<F9OverallSnapshotOrch | null>(null)
  const [executionOverview, setExecutionOverview] = useState<F9ExecutionOverviewBlock | null>(null)
  const [executionSync, setExecutionSync] = useState<SyncF9ExecutionResultBlock | null>(null)
  const [executionSyncError, setExecutionSyncError] = useState<string | null>(null)
  const [runtime] = useState<F9RuntimeSurfaceOrch>(getF9RuntimeSurfaceOrch())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasConfig = hasF9WebullConfigBlock()

  const refreshOverall = useCallback(async () => {
    setLoading(true)
    setError(null)
    setExecutionSyncError(null)
    try {
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
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadF9ExecutionOverviewOrch()
      .then((overview) => {
        if (cancelled) return
        setExecutionOverview(overview)
      })
      .catch(() => {
        if (!cancelled) {
          // Ignore initial load failures; refresh flow surfaces actionable errors.
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activeSubtabId !== 'overall') return
    if (!hasConfig) return
    void refreshOverall()
  }, [activeSubtabId, hasConfig, refreshOverall])

  return (
    <F9WorkspaceBlock
      subtabs={F9_SUBTABS}
      activeSubtabId={activeSubtabId}
      onSelectSubtab={setActiveSubtabId}
      hasConfig={hasConfig}
      loading={loading}
      error={error}
      runtime={snapshot?.runtime ?? runtime}
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
      onRefreshOverall={refreshOverall}
    />
  )
}
