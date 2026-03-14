import { useCallback, useEffect, useState } from 'react'

/**
 * localStorage-backed Set<string> for tracking expanded IDs in sidebar panels.
 * Collapsed by default unless `defaultIds` is provided.
 */
export function useExpandedSetBlock(
  storageKey: string,
  defaultIds?: Iterable<string>,
): {
  expanded: Set<string>
  isExpanded: (id: string) => boolean
  toggle: (id: string) => void
} {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return new Set(JSON.parse(saved) as string[])
    } catch { /* ignore */ }
    return defaultIds ? new Set(defaultIds) : new Set()
  })

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify([...expanded]))
  }, [storageKey, expanded])

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const isExpanded = useCallback((id: string) => expanded.has(id), [expanded])

  return { expanded, isExpanded, toggle }
}
