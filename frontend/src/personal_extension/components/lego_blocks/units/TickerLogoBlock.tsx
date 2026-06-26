import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  loadOrFetchTickerLogoBlock,
  tickerLogoToObjectUrlBlock,
} from '../../../services/lego_blocks/units/tickerLogoBlock'

interface TickerLogoBlockProps {
  ticker: string
  executionRoot: string
  className?: string
}

const FALLBACK_PALETTE_BLOCK = [
  'bg-slate-500',
  'bg-zinc-500',
  'bg-stone-500',
  'bg-emerald-600',
  'bg-sky-600',
  'bg-indigo-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-violet-600',
]

function fallbackColorBlock(ticker: string): string {
  let h = 0
  for (let i = 0; i < ticker.length; i++) {
    h = (h * 31 + ticker.charCodeAt(i)) >>> 0
  }
  return FALLBACK_PALETTE_BLOCK[h % FALLBACK_PALETTE_BLOCK.length]
}

export default function TickerLogoBlock({
  ticker,
  executionRoot,
  className,
}: TickerLogoBlockProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let createdUrl: string | null = null
    setUrl(null)
    setFailed(false)

    if (!executionRoot) {
      setFailed(true)
      return
    }

    void loadOrFetchTickerLogoBlock(executionRoot, ticker).then((result) => {
      if (cancelled) return
      if (!result) {
        setFailed(true)
        return
      }
      createdUrl = tickerLogoToObjectUrlBlock(result)
      setUrl(createdUrl)
    })

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [ticker, executionRoot])

  const sizeClasses = cn('h-5 w-5 shrink-0 overflow-hidden rounded-full', className)

  if (failed) {
    return (
      <span
        className={cn(
          sizeClasses,
          'flex items-center justify-center text-[10px] font-semibold text-white',
          fallbackColorBlock(ticker),
        )}
        aria-hidden="true"
      >
        {ticker.charAt(0).toUpperCase()}
      </span>
    )
  }
  if (!url) {
    return <span className={cn(sizeClasses, 'bg-muted/60')} aria-hidden="true" />
  }
  // Use an explicit wrapper for the circle clip — applying border-radius
  // directly on <img> doesn't always clip the bitmap content reliably.
  return (
    <span className={cn(sizeClasses, 'block bg-white')} style={{ borderRadius: '9999px' }} aria-hidden="true">
      <img
        src={url}
        alt=""
        className="block h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </span>
  )
}
