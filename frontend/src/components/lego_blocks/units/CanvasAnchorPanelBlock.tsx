import type { ReactNode } from 'react'
import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'

interface CanvasAnchorPanelBlockProps {
  children: ReactNode
  className?: string
}

// Shared anchor-panel chrome — the translucent rounded card used for anchor
// content. Stays visually consistent whether rendered inline (doc mode pages)
// or wrapped by a positioned anchor (canvas mode via BacklogCanvasAnchorBlock).
export default function CanvasAnchorPanelBlock({ children, className }: CanvasAnchorPanelBlockProps) {
  const theme = useCanvasThemeBlock()
  return (
    <div className={theme.isDark ? `dark ${className ?? ''}` : (className ?? '')}>
      <div
        style={{
          padding: 20,
          borderRadius: 14,
          background: theme.anchorPanelBg,
          border: `1px solid ${theme.anchorPanelBorder}`,
          boxShadow: theme.anchorPanelShadow,
          color: theme.tileText,
        }}
      >
        {children}
      </div>
    </div>
  )
}
