import { useEffect, useState } from 'react'

function readWindowActivityStateBlock(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return true
  const isVisible = typeof document.visibilityState !== 'string' || document.visibilityState === 'visible'
  const hasFocus = typeof document.hasFocus !== 'function' || document.hasFocus()
  return isVisible && hasFocus
}

export function useWindowActivityBlock(): boolean {
  const [active, setActive] = useState<boolean>(() => readWindowActivityStateBlock())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const sync = () => {
      setActive(readWindowActivityStateBlock())
    }

    sync()
    window.addEventListener('focus', sync)
    window.addEventListener('blur', sync)
    document.addEventListener('visibilitychange', sync)

    return () => {
      window.removeEventListener('focus', sync)
      window.removeEventListener('blur', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  return active
}
