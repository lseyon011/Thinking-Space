import type { MiniMapBounds } from '@/services/lego_blocks/integrations/excalidrawSceneAnalysisBlock'
import type { ExcalidrawCanvasApiBlock } from '@/services/lego_blocks/integrations/excalidrawIntegrationBlock'
import { resolveViewportWorldSize } from '@/services/lego_blocks/integrations/excalidrawViewportBlock'

interface MiniMapRect {
  x: number
  y: number
  width: number
  height: number
  key: string
}

interface ExcalidrawMiniMapBlockProps {
  bounds: MiniMapBounds
  rects: MiniMapRect[]
  scrollState: { scrollX: number; scrollY: number; zoom: number }
  excalidrawApi: ExcalidrawCanvasApiBlock | null
  containerSize: { width: number; height: number }
  isIosSurface: boolean
}

export type { MiniMapRect }

export default function ExcalidrawMiniMapBlock({
  bounds,
  rects,
  scrollState,
  excalidrawApi,
  containerSize,
  isIosSurface,
}: ExcalidrawMiniMapBlockProps) {
  const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    event.stopPropagation()
    if (!excalidrawApi) return
    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect()
    const px = (event.clientX - rect.left) / Math.max(rect.width, 1)
    const py = (event.clientY - rect.top) / Math.max(rect.height, 1)

    const worldX = bounds.minX + px * bounds.width
    const worldY = bounds.minY + py * bounds.height

    const zoom = Math.max(excalidrawApi.getViewportStateBlock().zoom, 0.01)
    const { viewportWorldW, viewportWorldH } = resolveViewportWorldSize({
      excalidrawApi,
      zoom,
      fallbackWidth: containerSize.width,
      fallbackHeight: containerSize.height,
    })
    excalidrawApi.updateViewportBlock({
      scrollX: -worldX + viewportWorldW / 2,
      scrollY: -worldY + viewportWorldH / 2,
    })
  }

  const viewportZoom = Math.max(scrollState.zoom, 0.01)
  const leftWorld = -scrollState.scrollX
  const topWorld = -scrollState.scrollY
  const { viewportWorldW, viewportWorldH } = resolveViewportWorldSize({
    excalidrawApi,
    zoom: viewportZoom,
    fallbackWidth: containerSize.width,
    fallbackHeight: containerSize.height,
  })
  const vx = ((leftWorld - bounds.minX) / bounds.width) * 100
  const vy = ((topWorld - bounds.minY) / bounds.height) * 72
  const vw = (viewportWorldW / bounds.width) * 100
  const vh = (viewportWorldH / bounds.height) * 72

  return (
    <button
      type="button"
      className="absolute right-3 z-30 rounded-lg border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur"
      style={{ bottom: isIosSurface ? 'calc(var(--ltm-safe-bottom, 0px) + 0.5rem)' : '0.75rem' }}
      title="Mini map"
    >
      <svg data-navmap-track viewBox="0 0 100 72" className="h-16 w-24" onClick={handleClick}>
        <rect x="0" y="0" width="100" height="72" rx="4" fill="hsl(var(--muted) / 0.45)" />
        {rects.map((r) => (
          <rect key={r.key} x={r.x} y={r.y} width={r.width} height={r.height} fill="hsl(var(--foreground) / 0.2)" />
        ))}
        <rect x={vx} y={vy} width={vw} height={vh} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" />
      </svg>
    </button>
  )
}
