import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteCanvasBlock } from '@/components/lego_blocks/hooks/shared/useInfiniteCanvasBlock'
import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'
import {
  useCanvasTilesBlock,
  type CanvasTile,
} from '@/components/lego_blocks/hooks/shared/useCanvasTilesBlock'
import Starfield from '@/components/lego_blocks/units/StarfieldBlock'
import CanvasBloomBlock from '@/components/lego_blocks/units/CanvasBloomBlock'
import CanvasTileBlock from '@/components/lego_blocks/units/CanvasTileBlock'
import CanvasTileToolbarBlock from '@/components/lego_blocks/units/CanvasTileToolbarBlock'
import CanvasSearchBarBlock from '@/components/lego_blocks/units/CanvasSearchBarBlock'
import CanvasContextMenuBlock from '@/components/lego_blocks/units/CanvasContextMenuBlock'
import CanvasWebWidgetPickerBlock from '@/components/lego_blocks/units/CanvasWebWidgetPickerBlock'
import CanvasMinimapBlock from '@/components/lego_blocks/units/CanvasMinimapBlock'
import HomeAnchorTileBlock from '@/components/lego_blocks/integrations/HomeAnchorTileBlock'
import ZoomIndicatorBlock from '@/components/lego_blocks/units/ZoomIndicatorBlock'
import {
  readHomeCanvas,
  writeHomeCanvas,
} from '@/services/lego_blocks/integrations/homeCanvasStorageBlock'

const ANCHOR_CENTER_X = 4500 / 2
const ANCHOR_CENTER_Y = 3000 / 2

const SEED_TILES: CanvasTile[] = [
  {
    id: 'seed-1',
    type: 'post-it',
    x: 480,
    y: 780,
    w: 280,
    h: 280,
    text: 'double-click empty space to make a new one',
    color: 'yellow',
    locked: true,
  },
  {
    id: 'seed-2',
    type: 'post-it',
    x: 2080,
    y: 780,
    w: 280,
    h: 320,
    text: 'right-click and "Add note" to pull a vault note onto the board',
    color: 'pink',
    locked: true,
  },
  {
    id: 'seed-3',
    type: 'post-it',
    x: 200,
    y: 1660,
    w: 280,
    h: 280,
    text: '',
    color: 'blue',
    locked: true,
  },
]

const WRITE_DEBOUNCE_MS = 500

export default function HomeCanvasOrch() {
  const navigate = useNavigate()
  const theme = useCanvasThemeBlock()
  const {
    transform,
    containerRef,
    resetZoom,
    centerOnWorld,
    worldWidth,
    worldHeight,
    viewportWidth,
    viewportHeight,
  } = useInfiniteCanvasBlock()
  const {
    tiles,
    focusedId,
    setAllTiles,
    spawnPostIt,
    spawnNote,
    spawnWebWidget,
    updateTileText,
    updateTileFontSize,
    setTileTextColor,
    setWidgetRefreshSec,
    updateTileColor,
    moveTile,
    resizeTile,
    duplicateTile,
    focusTile,
    removeTile,
  } = useCanvasTilesBlock(SEED_TILES)

  const handleOpenInPage = useCallback(
    (filePath: string) => {
      navigate(`/thinking-space?file=${encodeURIComponent(filePath)}`)
    },
    [navigate],
  )

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  type CanvasPopover =
    | { kind: 'menu'; screenX: number; screenY: number; worldX: number; worldY: number }
    | { kind: 'search'; screenX: number; screenY: number; worldX: number; worldY: number }
    | { kind: 'widget-picker'; worldX: number; worldY: number }
    | null
  const [popover, setPopover] = useState<CanvasPopover>(null)
  const [widgetReloadKeys, setWidgetReloadKeys] = useState<Record<string, number>>({})

  const refreshWidget = useCallback((id: string) => {
    setWidgetReloadKeys(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }, [])

  const transformRef = useRef(transform)
  transformRef.current = transform

  // Load persisted tiles on mount
  useEffect(() => {
    let cancelled = false
    void readHomeCanvas().then(file => {
      if (cancelled) return
      if (file && file.tiles.length > 0) {
        setAllTiles(file.tiles)
      }
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [setAllTiles])

  // Debounced persist on tile changes
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!loaded) return
    if (writeTimerRef.current != null) clearTimeout(writeTimerRef.current)
    writeTimerRef.current = setTimeout(() => {
      void writeHomeCanvas(tiles).catch(() => {
        // Storage errors are silent for now; future toolbar can surface them.
      })
    }, WRITE_DEBOUNCE_MS)
    return () => {
      if (writeTimerRef.current != null) clearTimeout(writeTimerRef.current)
    }
  }, [tiles, loaded])

  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      const t = transformRef.current
      return {
        x: (clientX - rect.left - t.x) / t.scale,
        y: (clientY - rect.top - t.y) / t.scale,
      }
    },
    [containerRef],
  )

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (
      e.target !== e.currentTarget &&
      !(e.target as HTMLElement).dataset.canvasBackdrop
    )
      return
    const { x, y } = screenToWorld(e.clientX, e.clientY)
    spawnPostIt(x, y)
  }

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBackdrop) {
      if (focusedId !== null) focusTile(null)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusedId) {
        const tile = tiles.find(t => t.id === focusedId)
        if (tile && tile.type === 'post-it' && tile.text.trim() === '') {
          removeTile(focusedId)
        } else {
          focusTile(null)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusedId, tiles, focusTile, removeTile])

  // Auto-cleanup empty post-its when focus moves away from them.
  // Catches every blur path (click backdrop, click another tile, Esc, etc.)
  // so we never accumulate stranded blanks.
  const prevFocusedRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevFocusedRef.current
    if (prev && prev !== focusedId) {
      const stale = tiles.find(t => t.id === prev)
      if (stale && stale.type === 'post-it' && stale.text.trim() === '') {
        removeTile(prev)
      }
    }
    prevFocusedRef.current = focusedId
  }, [focusedId, tiles, removeTile])

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target !== e.currentTarget && !target.dataset.canvasBackdrop) return
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top
    const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY)
    setPopover({ kind: 'menu', screenX, screenY, worldX, worldY })
  }

  const handlePickNote = (filePath: string) => {
    if (popover?.kind !== 'search') return
    spawnNote(filePath, popover.worldX, popover.worldY)
    setPopover(null)
  }

  const handlePickWidget = (spec: {
    siteId: string
    region: { x: number; y: number; w: number; h: number }
    pageWidth: number
  }) => {
    if (popover?.kind !== 'widget-picker') return
    spawnWebWidget(spec, popover.worldX, popover.worldY)
    setPopover(null)
  }

  const focusedTile = focusedId ? tiles.find(t => t.id === focusedId) ?? null : null

  // Pause widgets that are entirely outside the visible viewport (in world coords).
  // We compute the viewport rect from the current transform; pad by ~200px so
  // widgets just outside the edge stay warm and don't flash on re-entry.
  const viewportPad = 200
  const viewW = viewportWidth || window.innerWidth
  const viewH = viewportHeight || window.innerHeight
  const viewportRect = {
    x: -transform.x / transform.scale - viewportPad,
    y: -transform.y / transform.scale - viewportPad,
    w: viewW / transform.scale + viewportPad * 2,
    h: viewH / transform.scale + viewportPad * 2,
  }
  const isTileOffscreen = (tile: CanvasTile): boolean => {
    return (
      tile.x + tile.w < viewportRect.x ||
      tile.x > viewportRect.x + viewportRect.w ||
      tile.y + tile.h < viewportRect.y ||
      tile.y > viewportRect.y + viewportRect.h
    )
  }

  // Toolbar position: above the focused tile, in screen space
  const toolbarPos = (() => {
    if (!focusedTile) return null
    const screenX = focusedTile.x * transform.scale + transform.x + (focusedTile.w * transform.scale) / 2
    const screenY = focusedTile.y * transform.scale + transform.y - 48
    return { x: screenX, y: Math.max(8, screenY) }
  })()
  const hudEdgeInset = 24
  const minimapWidth = 150
  const minimapHeight = Math.round((minimapWidth * worldHeight) / worldWidth)

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        background: theme.outerBg,
      }}
    >
      <style>{`
        [data-canvas-tile], [data-canvas-tile] *, [data-canvas-anchor-element], [data-canvas-anchor-element] * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        [data-canvas-tile]::-webkit-scrollbar, [data-canvas-tile] *::-webkit-scrollbar,
        [data-canvas-anchor-element]::-webkit-scrollbar, [data-canvas-anchor-element] *::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        /* Markdown content inside note tiles uses a smaller font than the
           default prose styles (which are sized for full-page docs).
           Headings + code scale proportionally to the body size. */
        [data-canvas-tile] .prose {
          font-size: var(--canvas-md-font-size, 12px);
          line-height: 1.5;
        }
        [data-canvas-tile] .prose h1 { font-size: 1.5em; margin: 0.6em 0 0.3em; }
        [data-canvas-tile] .prose h2 { font-size: 1.3em; margin: 0.6em 0 0.3em; }
        [data-canvas-tile] .prose h3 { font-size: 1.15em; margin: 0.5em 0 0.25em; }
        [data-canvas-tile] .prose h4,
        [data-canvas-tile] .prose h5,
        [data-canvas-tile] .prose h6 { font-size: 1em; margin: 0.5em 0 0.2em; }
        [data-canvas-tile] .prose p,
        [data-canvas-tile] .prose li { margin: 0.4em 0; }
        [data-canvas-tile] .prose pre,
        [data-canvas-tile] .prose code { font-size: 0.9em; }
        [data-canvas-tile] .prose ul,
        [data-canvas-tile] .prose ol { padding-left: 1.2em; margin: 0.4em 0; }
      `}</style>
      <div style={{ position: 'absolute', inset: 0 }} aria-hidden>
        {theme.showNebula && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: theme.nebulaGradient,
            }}
          />
        )}
        {theme.showStars && <Starfield starColor={theme.starColor} />}
        {theme.vignetteGradient && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: theme.vignetteGradient,
            }}
          />
        )}
      </div>

      <CanvasBloomBlock
        intensified={hoveredId !== null}
        dotColor={theme.bloomDot}
        rect={{
          left: transform.x,
          top: transform.y,
          width: worldWidth * transform.scale,
          height: worldHeight * transform.scale,
        }}
      />

      <div
        data-canvas-backdrop="true"
        onDoubleClick={handleCanvasDoubleClick}
        onContextMenu={handleContextMenu}
        onMouseDown={handleBackdropMouseDown}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: worldWidth,
          height: worldHeight,
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          transformOrigin: '0 0',
          willChange: 'transform',
          borderRadius: 16,
          border: `1px solid ${theme.boardBorder}`,
          boxShadow: theme.boardGlow,
        }}
      >
        <HomeAnchorTileBlock centerX={ANCHOR_CENTER_X} centerY={ANCHOR_CENTER_Y} />
        {tiles.map(tile => (
          <CanvasTileBlock
            key={tile.id}
            tile={tile}
            focused={focusedId === tile.id}
            scale={transform.scale}
            offscreen={isTileOffscreen(tile)}
            reloadKey={widgetReloadKeys[tile.id] ?? 0}
            onFocus={focusTile}
            onBlur={() => focusTile(null)}
            onHoverChange={setHoveredId}
            onChange={updateTileText}
            onResize={resizeTile}
            onRemove={removeTile}
          />
        ))}
      </div>

      {focusedTile && toolbarPos && (
        <CanvasTileToolbarBlock
          tile={focusedTile}
          screenX={toolbarPos.x}
          screenY={toolbarPos.y}
          scale={transform.scale}
          onMove={moveTile}
          onSetColor={updateTileColor}
          onSetFontSize={updateTileFontSize}
          onSetTextColor={setTileTextColor}
          onDuplicate={duplicateTile}
          onRemove={removeTile}
          onOpenInPage={handleOpenInPage}
          onRefreshWidget={refreshWidget}
          onSetWidgetRefreshSec={setWidgetRefreshSec}
        />
      )}

      {popover?.kind === 'menu' && (
        <CanvasContextMenuBlock
          screenX={popover.screenX}
          screenY={popover.screenY}
          onAddNote={() =>
            setPopover({
              kind: 'search',
              screenX: popover.screenX,
              screenY: popover.screenY,
              worldX: popover.worldX,
              worldY: popover.worldY,
            })
          }
          onAddWidget={() =>
            setPopover({
              kind: 'widget-picker',
              worldX: popover.worldX,
              worldY: popover.worldY,
            })
          }
          onClose={() => setPopover(null)}
        />
      )}
      {popover?.kind === 'search' && (
        <CanvasSearchBarBlock
          screenX={popover.screenX}
          screenY={popover.screenY}
          onClose={() => setPopover(null)}
          onPick={handlePickNote}
        />
      )}
      {popover?.kind === 'widget-picker' && (
        <CanvasWebWidgetPickerBlock
          onPick={handlePickWidget}
          onClose={() => setPopover(null)}
        />
      )}

      <CanvasMinimapBlock
        tiles={tiles}
        worldWidth={worldWidth}
        worldHeight={worldHeight}
        transformX={transform.x}
        transformY={transform.y}
        scale={transform.scale}
        viewport={{ width: viewW, height: viewH }}
        onJump={centerOnWorld}
        width={minimapWidth}
        edgeInset={hudEdgeInset}
      />

      <ZoomIndicatorBlock
        scale={transform.scale}
        onReset={resetZoom}
        edgeInset={hudEdgeInset}
        minimapHeight={minimapHeight}
      />
    </div>
  )
}
