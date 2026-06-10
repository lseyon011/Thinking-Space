import { useEffect, useRef } from 'react'

/**
 * Subscribes to a sidebar-chrome block's window CustomEvent and forwards the
 * non-null detail to `onState`. The latest callback is kept in a ref so the
 * window listener is attached once per event name.
 */
export function useChromeStateEventBlock<TDetail>(
  eventName: string,
  onState: (detail: TDetail) => void,
): void {
  const onStateRef = useRef(onState)
  onStateRef.current = onState

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<TDetail>).detail
      if (!detail) return
      onStateRef.current(detail)
    }
    window.addEventListener(eventName, listener)
    return () => {
      window.removeEventListener(eventName, listener)
    }
  }, [eventName])
}
