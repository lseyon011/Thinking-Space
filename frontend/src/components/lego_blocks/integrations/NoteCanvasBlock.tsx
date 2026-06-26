import { useMemo, useRef } from 'react'
import CanvasSurfaceOrch from '@/components/orchestrators/CanvasSurfaceOrch'
import { createNoteFenceCanvasStorage } from '@/services/lego_blocks/integrations/noteFenceCanvasStorageBlock'

interface NoteCanvasBlockProps {
  /** Stable surface id — keeps canvas state isolated between notes. */
  surfaceId: string
  /** Current markdown body (may include a thinkspace-canvas fence). */
  value: string
  /** Called with the next markdown body after a canvas edit. Parent decides
   * whether that triggers an in-memory update only or a disk write. */
  onChange: (nextValue: string) => void
}

// Thin wrapper: mounts CanvasSurfaceOrch with an adapter that round-trips
// tiles through the markdown string's thinkspace-canvas fence. All pan/zoom,
// tile, and context-menu behavior comes from CanvasSurfaceOrch.
export default function NoteCanvasBlock({
  surfaceId,
  value,
  onChange,
}: NoteCanvasBlockProps) {
  // Refs let the memoized adapter see the latest value without remounting
  // CanvasSurfaceOrch (which would reset pan/zoom state).
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  valueRef.current = value
  onChangeRef.current = onChange

  const storage = useMemo(
    () =>
      createNoteFenceCanvasStorage({
        getValue: () => valueRef.current,
        onWrite: (next) => onChangeRef.current(next),
      }),
    [],
  )

  return <CanvasSurfaceOrch surfaceId={surfaceId} storage={storage} />
}
