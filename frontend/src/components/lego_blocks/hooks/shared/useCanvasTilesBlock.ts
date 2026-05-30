import { useCallback, useState } from 'react'
import {
  DEFAULT_POST_IT_COLOR,
  type PostItColor,
} from '@/components/lego_blocks/units/postItPaletteBlock'

export type CanvasTileType = 'post-it' | 'note' | 'web-widget'

export interface CanvasTileBase {
  id: string
  x: number
  y: number
  w: number
  h: number
  locked: boolean
}

export type PostItFontSize = 's' | 'm' | 'l'

export interface CanvasPostItTile extends CanvasTileBase {
  type: 'post-it'
  text: string
  color: PostItColor
  fontSize?: PostItFontSize
  /** Optional text color (any post-it color). Undefined = theme default. */
  textColor?: PostItColor
}

export interface CanvasNoteTile extends CanvasTileBase {
  type: 'note'
  filePath: string
}

/**
 * Clipped live view onto a region of a Web tab site.
 * region.{x,y,w,h} are in page-pixel coords against the rendered webview width.
 */
export interface CanvasWebWidgetTile extends CanvasTileBase {
  type: 'web-widget'
  siteId: string
  region: { x: number; y: number; w: number; h: number }
  /** Rendered page width used during region capture (lets us reproduce layout). */
  pageWidth: number
}

export type CanvasTile = CanvasPostItTile | CanvasNoteTile | CanvasWebWidgetTile

let tileSeq = 0
const nextTileId = () => `tile-${Date.now().toString(36)}-${(tileSeq++).toString(36)}`

const DEFAULT_TILE_W = 280
const DEFAULT_TILE_H = 280
export const MIN_TILE_W = 160
export const MIN_TILE_H = 120
export const MAX_TILE_W = 800
export const MAX_TILE_H = 800

export interface UseCanvasTilesResult {
  tiles: CanvasTile[]
  focusedId: string | null
  setAllTiles: (tiles: CanvasTile[]) => void
  spawnPostIt: (worldX: number, worldY: number) => string
  spawnNote: (filePath: string, worldX: number, worldY: number) => string
  spawnWebWidget: (
    spec: { siteId: string; region: { x: number; y: number; w: number; h: number }; pageWidth: number },
    worldX: number,
    worldY: number,
  ) => string
  updateTileText: (id: string, text: string) => void
  updateTileColor: (id: string, color: PostItColor) => void
  updateTileFontSize: (id: string, fontSize: PostItFontSize) => void
  setTileTextColor: (id: string, textColor: PostItColor | undefined) => void
  moveTile: (id: string, x: number, y: number) => void
  resizeTile: (id: string, w: number, h: number) => void
  toggleTileLock: (id: string) => void
  duplicateTile: (id: string) => void
  focusTile: (id: string | null) => void
  removeTile: (id: string) => void
}

export function useCanvasTilesBlock(initial: CanvasTile[] = []): UseCanvasTilesResult {
  const [tiles, setTiles] = useState<CanvasTile[]>(initial)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const setAllTiles = useCallback((next: CanvasTile[]) => {
    setTiles(next)
  }, [])

  const spawnPostIt = useCallback((worldX: number, worldY: number) => {
    const id = nextTileId()
    const tile: CanvasPostItTile = {
      id,
      type: 'post-it',
      x: Math.round(worldX - DEFAULT_TILE_W / 2),
      y: Math.round(worldY - DEFAULT_TILE_H / 2),
      w: DEFAULT_TILE_W,
      h: DEFAULT_TILE_H,
      text: '',
      color: DEFAULT_POST_IT_COLOR,
      locked: false, // newly spawned tiles are unlocked so you can place them; auto-lock on blur in orch
    }
    setTiles(prev => [...prev, tile])
    setFocusedId(id)
    return id
  }, [])

  const spawnNote = useCallback((filePath: string, worldX: number, worldY: number) => {
    const id = nextTileId()
    const tile: CanvasNoteTile = {
      id,
      type: 'note',
      x: Math.round(worldX - DEFAULT_TILE_W / 2),
      y: Math.round(worldY - DEFAULT_TILE_H / 2),
      w: DEFAULT_TILE_W,
      h: DEFAULT_TILE_H,
      filePath,
      locked: true,
    }
    setTiles(prev => [...prev, tile])
    setFocusedId(id)
    return id
  }, [])

  const spawnWebWidget = useCallback(
    (
      spec: { siteId: string; region: { x: number; y: number; w: number; h: number }; pageWidth: number },
      worldX: number,
      worldY: number,
    ) => {
      const id = nextTileId()
      // tile defaults to the size of the captured region (clamped to sane bounds)
      const w = Math.min(MAX_TILE_W, Math.max(MIN_TILE_W, spec.region.w))
      const h = Math.min(MAX_TILE_H, Math.max(MIN_TILE_H, spec.region.h))
      const tile: CanvasWebWidgetTile = {
        id,
        type: 'web-widget',
        x: Math.round(worldX - w / 2),
        y: Math.round(worldY - h / 2),
        w,
        h,
        locked: true,
        siteId: spec.siteId,
        region: spec.region,
        pageWidth: spec.pageWidth,
      }
      setTiles(prev => [...prev, tile])
      setFocusedId(id)
      return id
    },
    [],
  )

  const updateTileText = useCallback((id: string, text: string) => {
    setTiles(prev =>
      prev.map(t => (t.id === id && t.type === 'post-it' ? { ...t, text } : t)),
    )
  }, [])

  const updateTileColor = useCallback((id: string, color: PostItColor) => {
    setTiles(prev =>
      prev.map(t => (t.id === id && t.type === 'post-it' ? { ...t, color } : t)),
    )
  }, [])

  const updateTileFontSize = useCallback((id: string, fontSize: PostItFontSize) => {
    setTiles(prev =>
      prev.map(t => (t.id === id && t.type === 'post-it' ? { ...t, fontSize } : t)),
    )
  }, [])

  const setTileTextColor = useCallback(
    (id: string, textColor: PostItColor | undefined) => {
      setTiles(prev =>
        prev.map(t =>
          t.id === id && t.type === 'post-it' ? { ...t, textColor } : t,
        ),
      )
    },
    [],
  )

  const moveTile = useCallback((id: string, x: number, y: number) => {
    setTiles(prev =>
      prev.map(t => (t.id === id ? { ...t, x: Math.round(x), y: Math.round(y) } : t)),
    )
  }, [])

  const resizeTile = useCallback((id: string, w: number, h: number) => {
    const cw = Math.min(MAX_TILE_W, Math.max(MIN_TILE_W, Math.round(w)))
    const ch = Math.min(MAX_TILE_H, Math.max(MIN_TILE_H, Math.round(h)))
    setTiles(prev => prev.map(t => (t.id === id ? { ...t, w: cw, h: ch } : t)))
  }, [])

  const toggleTileLock = useCallback((id: string) => {
    setTiles(prev => prev.map(t => (t.id === id ? { ...t, locked: !t.locked } : t)))
  }, [])

  const duplicateTile = useCallback((id: string) => {
    setTiles(prev => {
      const src = prev.find(t => t.id === id)
      if (!src) return prev
      const newId = nextTileId()
      const dup: CanvasTile = { ...src, id: newId, x: src.x + 24, y: src.y + 24, locked: false }
      return [...prev, dup]
    })
  }, [])

  const focusTile = useCallback((id: string | null) => {
    setFocusedId(id)
  }, [])

  const removeTile = useCallback((id: string) => {
    setTiles(prev => prev.filter(t => t.id !== id))
    setFocusedId(prev => (prev === id ? null : prev))
  }, [])

  return {
    tiles,
    focusedId,
    setAllTiles,
    spawnPostIt,
    spawnNote,
    spawnWebWidget,
    updateTileText,
    updateTileColor,
    updateTileFontSize,
    setTileTextColor,
    moveTile,
    resizeTile,
    toggleTileLock,
    duplicateTile,
    focusTile,
    removeTile,
  }
}
