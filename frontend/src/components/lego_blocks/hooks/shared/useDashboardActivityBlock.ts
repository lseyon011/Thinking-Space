import { useEffect, useMemo, useState } from 'react'
import { getVaultFS, getPlatformName } from '@/services/lego_blocks/integrations/fsBlock'
import {
  getDashboardActivity,
  type DashboardSeries,
} from '@/services/lego_blocks/integrations/dashboardActivityBlock'
import {
  loadHomeSnapshot,
  sliceDashboardSnapshotForRange,
} from '@/services/lego_blocks/integrations/homeSnapshotBlock'

export type DashboardRangePreset = '7d' | '30d' | '90d' | '365d'

export const DASHBOARD_RANGE_PRESETS: ReadonlyArray<{
  id: DashboardRangePreset
  label: string
  days: number
}> = [
  { id: '7d', label: '7d', days: 7 },
  { id: '30d', label: '30d', days: 30 },
  { id: '90d', label: '90d', days: 90 },
  { id: '365d', label: '1y', days: 365 },
]

function isoDayLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rangeFromPreset(preset: DashboardRangePreset): { startIso: string; endIso: string } {
  const days = DASHBOARD_RANGE_PRESETS.find((p) => p.id === preset)?.days ?? 30
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))
  return { startIso: isoDayLocal(start), endIso: isoDayLocal(end) }
}

export interface UseDashboardActivityResult {
  series: DashboardSeries | null
  loading: boolean
  error: string | null
  preset: DashboardRangePreset
  setPreset: (preset: DashboardRangePreset) => void
  startIso: string
  endIso: string
  refresh: () => void
}

export function useDashboardActivityBlock(
  initialPreset: DashboardRangePreset = '30d',
): UseDashboardActivityResult {
  const [preset, setPreset] = useState<DashboardRangePreset>(initialPreset)
  const [series, setSeries] = useState<DashboardSeries | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const { startIso, endIso } = useMemo(() => rangeFromPreset(preset), [preset])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const fs = getVaultFS()
    const platform = getPlatformName()
    const preferSnapshot = platform !== 'electron'

    const live = () =>
      getDashboardActivity(fs, startIso, endIso)
        .then((result) => {
          if (cancelled) return
          setSeries(result)
          setLoading(false)
        })
        .catch((err) => {
          if (cancelled) return
          setError(err instanceof Error ? err.message : 'Failed to load dashboard activity.')
          setLoading(false)
        })

    if (preferSnapshot) {
      // iPhone/iPad/web: paint instantly from the desktop-written snapshot
      // and skip the heavy vault walk. Fall back to live compute only when
      // no snapshot has propagated yet.
      loadHomeSnapshot(fs)
        .then((snapshot) => {
          if (cancelled) return
          if (snapshot) {
            setSeries(sliceDashboardSnapshotForRange(snapshot, startIso, endIso))
            setLoading(false)
            return
          }
          void live()
        })
        .catch(() => {
          if (cancelled) return
          void live()
        })
    } else {
      void live()
    }

    return () => {
      cancelled = true
    }
  }, [startIso, endIso, refreshKey])

  return {
    series,
    loading,
    error,
    preset,
    setPreset,
    startIso,
    endIso,
    refresh: () => setRefreshKey((k) => k + 1),
  }
}
