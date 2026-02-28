import { useCallback, useEffect, useState } from 'react'
import F9WorkspaceBlock from '../lego_blocks/integrations/F9WorkspaceBlock'
import {
  fetchF9OverallSnapshotOrch,
  getF9RuntimeSurfaceOrch,
  type F9RuntimeSurfaceOrch,
  type F9OverallSnapshotOrch,
} from '../../services/orchestrators/f9OverallOrch'
import { hasF9WebullConfigBlock } from '../../services/lego_blocks/units/f9WebullConfigBlock'

type F9SubtabId = 'overall'

const F9_SUBTABS: Array<{ id: F9SubtabId; label: string }> = [
  { id: 'overall', label: 'Overall' },
]

export default function F9Orch() {
  const [activeSubtabId, setActiveSubtabId] = useState<F9SubtabId>('overall')
  const [snapshot, setSnapshot] = useState<F9OverallSnapshotOrch | null>(null)
  const [runtime] = useState<F9RuntimeSurfaceOrch>(getF9RuntimeSurfaceOrch())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasConfig = hasF9WebullConfigBlock()

  const refreshOverall = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchF9OverallSnapshotOrch()
      setSnapshot(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load F9 Overall data.')
    } finally {
      setLoading(false)
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
      onRefreshOverall={refreshOverall}
    />
  )
}
