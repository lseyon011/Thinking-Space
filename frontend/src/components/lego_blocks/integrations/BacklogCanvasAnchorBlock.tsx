import { useEffect, useRef, type ReactNode } from 'react'
import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'

interface BacklogCanvasAnchorBlockProps {
  /** Horizontal center of the anchor card in world coords. */
  centerX: number
  /** Top edge of the anchor card in world coords. */
  topY: number
  /** Fixed width of the anchor card. */
  width: number
  /** Notified whenever the card's intrinsic content height changes. */
  onHeightChange: (height: number) => void
  children: ReactNode
}

const VERTICAL_PADDING = 40 // matches padding: 20 top + bottom

export default function BacklogCanvasAnchorBlock({
  centerX,
  topY,
  width,
  onHeightChange,
  children,
}: BacklogCanvasAnchorBlockProps) {
  const theme = useCanvasThemeBlock()
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = contentRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        onHeightChange(entry.contentRect.height + VERTICAL_PADDING)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [onHeightChange])

  return (
    <div className={theme.isDark ? 'dark' : ''}>
      <div
        data-canvas-anchor-element="true"
        onMouseDown={e => e.stopPropagation()}
        onDoubleClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: centerX - width / 2,
          top: topY,
          width,
          padding: 20,
          borderRadius: 14,
          background: theme.anchorPanelBg,
          border: `1px solid ${theme.anchorPanelBorder}`,
          boxShadow: theme.anchorPanelShadow,
          overflow: 'visible',
          cursor: 'default',
          zIndex: 2,
          color: theme.tileText,
        }}
      >
        <div ref={contentRef}>{children}</div>
      </div>
    </div>
  )
}
