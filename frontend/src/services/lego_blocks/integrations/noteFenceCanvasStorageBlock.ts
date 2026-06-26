// CanvasStorageAdapter that round-trips tiles through a markdown string's
// thinkspace-canvas fence — purely in memory. Parent decides how/when that
// string gets persisted (manual save, conflict-aware write, in-state only).

import type { CanvasTile } from '@/components/lego_blocks/hooks/shared/useCanvasTilesBlock'
import type { CanvasStorageAdapter } from '@/services/lego_blocks/integrations/canvasStorageBlock'
import {
  applyNoteCanvasToContent,
  parseNoteCanvasBlock,
} from '@/services/lego_blocks/units/noteCanvasBlock'

export interface NoteFenceCanvasStorageHandles {
  // Pulled fresh on every read/write so the adapter sees the latest value
  // the parent component is holding.
  getValue: () => string
  onWrite: (nextValue: string) => void
}

export function createNoteFenceCanvasStorage(
  handles: NoteFenceCanvasStorageHandles,
): CanvasStorageAdapter {
  return {
    async read(): Promise<CanvasTile[] | null> {
      const parsed = parseNoteCanvasBlock(handles.getValue())
      // Returning null lets CanvasSurfaceOrch fall back to seedTiles for
      // notes that have never been used as a canvas. Returning [] would
      // suppress seeds.
      if (!parsed.hadFence) return null
      return parsed.tiles
    },
    async write(tiles: CanvasTile[]): Promise<void> {
      const value = handles.getValue()
      const next = applyNoteCanvasToContent(value, tiles)
      if (next === value) return
      handles.onWrite(next)
    },
  }
}
