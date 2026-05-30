import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'

interface Props {
  scale: number
  onReset: () => void
}

export default function ZoomIndicatorBlock({ scale, onReset }: Props) {
  const theme = useCanvasThemeBlock()
  return (
    <button
      onClick={onReset}
      aria-label="Reset zoom"
      style={{
        position: 'absolute',
        // Sits directly above the minimap. Minimap is 150×100 anchored at
        // bottom:16 right:16, so this clears it by 8px.
        bottom: 16 + 100 + 8,
        right: 16,
        padding: '6px 10px',
        background: theme.toolbarBg,
        border: `1px solid ${theme.toolbarBorder}`,
        borderRadius: 8,
        color: theme.toolbarTextMuted,
        fontSize: 11,
        lineHeight: 1.3,
        textAlign: 'left',
        cursor: 'pointer',
        userSelect: 'none',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ fontSize: 12, color: theme.toolbarText }}>
        {Math.round(scale * 100)}%
      </div>
      <div style={{ opacity: 0.55, fontSize: 10 }}>reset</div>
    </button>
  )
}
