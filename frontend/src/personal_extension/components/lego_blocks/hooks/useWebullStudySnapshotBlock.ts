import { useCallback, useEffect, useState } from 'react'
import { addGlobalSyncRefreshListenerBlock } from '@/services/lego_blocks/units/globalSyncRefreshBlock'
import {
  loadWebullStudySnapshotOrch,
  type WebullStudySnapshotOrch,
} from '@/personal_extension/services/orchestrators/webullStudyOrch'

export interface UseWebullStudySnapshotBlockResult {
  snapshot: WebullStudySnapshotOrch | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Shared hook for the Webull study snapshot — both the table block and the F9
 * canvas orch read from the same source so the canvas can size its world to
 * fit the current row count without duplicate fetches.
 */
export function useWebullStudySnapshotBlock(): UseWebullStudySnapshotBlockResult {
  const [snapshot, setSnapshot] = useState<WebullStudySnapshotOrch | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await loadWebullStudySnapshotOrch()
      setSnapshot(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    return addGlobalSyncRefreshListenerBlock(() => {
      void refresh()
    })
  }, [refresh])

  return { snapshot, loading, error, refresh }
}
