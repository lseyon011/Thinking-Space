import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  bytesToPngObjectUrlBlock,
  loadTickerChartBlock,
} from '../../../services/lego_blocks/units/tickerChartBlock'

interface TickerChartBlockProps {
  ticker: string
  executionRoot: string
  className?: string
}

export default function TickerChartBlock({
  ticker,
  executionRoot,
  className,
}: TickerChartBlockProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    let createdUrl: string | null = null
    setUrl(null)
    setMissing(false)

    if (!executionRoot) {
      setMissing(true)
      return
    }

    void loadTickerChartBlock(executionRoot, ticker).then((bytes) => {
      if (cancelled) return
      if (!bytes) {
        setMissing(true)
        return
      }
      createdUrl = bytesToPngObjectUrlBlock(bytes)
      setUrl(createdUrl)
    })

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [ticker, executionRoot])

  if (missing) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground',
          className,
        )}
      >
        No <code>bands.png</code> chart for {ticker} yet.
      </div>
    )
  }

  if (!url) {
    return (
      <div
        className={cn(
          'h-40 w-full animate-pulse rounded-md bg-muted/40',
          className,
        )}
        aria-hidden="true"
      />
    )
  }

  return (
    <img
      src={url}
      alt={`${ticker} bands chart`}
      className={cn('w-full rounded-md border bg-white object-contain', className)}
      onError={() => setMissing(true)}
    />
  )
}
