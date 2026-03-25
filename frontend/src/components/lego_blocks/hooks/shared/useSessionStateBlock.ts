import { useState, useCallback, useRef } from 'react'

/**
 * useState wrapper backed by sessionStorage.
 * State persists across in-app navigations but clears on app quit (Cmd+Q).
 * Useful for persistent-mounted components that must survive route changes.
 */
export function useSessionStateBlock<T>(
  key: string,
  initialValue: T | (() => T),
): [T, (value: T | ((prev: T) => T)) => void] {
  const keyRef = useRef(key)
  keyRef.current = key

  const [state, setState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key)
      if (stored !== null) return JSON.parse(stored) as T
    } catch { /* ignore parse errors */ }
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue
  })

  const setAndPersist = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
      try { sessionStorage.setItem(keyRef.current, JSON.stringify(next)) } catch { /* quota */ }
      return next
    })
  }, [])

  return [state, setAndPersist]
}
