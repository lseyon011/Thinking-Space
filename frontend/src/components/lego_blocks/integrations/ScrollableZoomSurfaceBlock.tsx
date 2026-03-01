import { useState, type ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { cn } from '@/lib/utils'

interface ScrollableZoomSurfaceBlockProps {
  children: ReactNode
  className?: string
  viewportClassName?: string
  contentClassName?: string
  minWidthClassName?: string
  controlsLabel?: string
  defaultZoom?: number
  minZoom?: number
  maxZoom?: number
  zoomStep?: number
}

function clampZoomBlock(value: number, min: number, max?: number): number {
  const boundedMin = Math.max(value, min)
  if (typeof max === 'number' && Number.isFinite(max)) {
    return Math.min(boundedMin, max)
  }
  return boundedMin
}

export default function ScrollableZoomSurfaceBlock({
  children,
  className,
  viewportClassName,
  contentClassName,
  minWidthClassName,
  controlsLabel = 'Table zoom',
  defaultZoom = 1,
  minZoom = 0.7,
  maxZoom,
  zoomStep = 0.1,
}: ScrollableZoomSurfaceBlockProps) {
  const [zoom, setZoom] = useState<number>(() => clampZoomBlock(defaultZoom, minZoom, maxZoom))
  const zoomPercent = `${Math.round(zoom * 100)}%`
  const hasMaxZoom = typeof maxZoom === 'number' && Number.isFinite(maxZoom)
  const canZoomOut = zoom > minZoom
  const canZoomIn = !hasMaxZoom || zoom < maxZoom

  return (
    <div className={cn('space-y-2', className)}>
      <div className={cn('overflow-x-auto', viewportClassName)}>
        <div className={cn(minWidthClassName, contentClassName)} style={{ zoom }}>
          {children}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 text-xs">
        <span className="text-muted-foreground">{controlsLabel}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={!canZoomOut}
          onClick={() => setZoom((current) => clampZoomBlock(Number((current - zoomStep).toFixed(2)), minZoom, maxZoom))}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="min-w-[3rem] text-center font-medium tabular-nums text-muted-foreground">
          {zoomPercent}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={!canZoomIn}
          onClick={() => setZoom((current) => clampZoomBlock(Number((current + zoomStep).toFixed(2)), minZoom, maxZoom))}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
