import { useCallback, useEffect, useState } from 'react'
import {
  PROJECTS_CHANGE_EVENT_BLOCK,
  readProjectsBlock,
} from '@/services/lego_blocks/integrations/projectsStorageBlock'
import type { ProjectBlock } from '@/services/lego_blocks/units/projectBlock'

/**
 * useProjectsBlock — subscribe to the user-defined Projects list (settings
 * concept stored at `.thinking-space/projects.json`).
 *
 * Refreshes on the `PROJECTS_CHANGE_EVENT_BLOCK` window event that
 * projectsStorageBlock dispatches on every write, so anchors and pickers stay
 * in sync with the Settings page without a full reload.
 */
export interface UseProjectsBlockResult {
  projects: ProjectBlock[]
  loading: boolean
  refresh: () => Promise<void>
}

export function useProjectsBlock(): UseProjectsBlockResult {
  const [projects, setProjects] = useState<ProjectBlock[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const next = await readProjectsBlock()
    setProjects(next)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    void readProjectsBlock().then(next => {
      if (cancelled) return
      setProjects(next)
      setLoading(false)
    })
    const handler = () => {
      void readProjectsBlock().then(next => {
        if (cancelled) return
        setProjects(next)
      })
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(PROJECTS_CHANGE_EVENT_BLOCK, handler)
    }
    return () => {
      cancelled = true
      if (typeof window !== 'undefined') {
        window.removeEventListener(PROJECTS_CHANGE_EVENT_BLOCK, handler)
      }
    }
  }, [])

  return { projects, loading, refresh }
}
