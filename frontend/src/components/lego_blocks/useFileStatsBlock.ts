import { useEffect, useState } from 'react'
import { getFileStats } from '@/services/orchestrators/fileSystemOrch'
import type { FileStat } from '@/services/lego_blocks/typesBlock'

export type { FileStat }

/**
 * Fetch lightweight stats for a list of file paths.
 * Returns a map from path → stats. Re-fetches when paths change.
 */
export function useFileStats(paths: string[]): Record<string, FileStat> {
  const [stats, setStats] = useState<Record<string, FileStat>>({})

  // Stable key for the paths array
  const key = paths.slice().sort().join('\n')

  useEffect(() => {
    if (paths.length === 0) {
      setStats({})
      return
    }
    getFileStats(paths)
      .then(statsArr => {
        const map: Record<string, FileStat> = {}
        for (const s of statsArr) map[s.path] = s
        setStats(map)
      })
      .catch(() => {})
  }, [key])

  return stats
}
