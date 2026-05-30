import { useEffect, useState } from 'react'

export type CanvasTimePhase = 'day' | 'golden' | 'night'

function computePhase(now: Date = new Date()): CanvasTimePhase {
  const h = now.getHours()
  if (h >= 5 && h < 17) return 'day'
  if (h >= 17 && h < 20) return 'golden'
  return 'night'
}

const RECHECK_INTERVAL_MS = 60_000

export function useTimeOfDayBlock(): CanvasTimePhase {
  const [phase, setPhase] = useState<CanvasTimePhase>(() => computePhase())

  useEffect(() => {
    const id = setInterval(() => {
      const next = computePhase()
      setPhase(prev => (prev === next ? prev : next))
    }, RECHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return phase
}
