import { useEffect, useRef } from 'react'
import { FilePlus2, AppWindow } from 'lucide-react'
import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'

interface Props {
  screenX: number
  screenY: number
  onAddNote: () => void
  onAddWidget: () => void
  onClose: () => void
}

export default function CanvasContextMenuBlock({
  screenX,
  screenY,
  onAddNote,
  onAddWidget,
  onClose,
}: Props) {
  const theme = useCanvasThemeBlock()
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY,
        minWidth: 160,
        padding: 4,
        background: theme.popoverBg,
        border: `1px solid ${theme.popoverBorder}`,
        borderRadius: 8,
        boxShadow: theme.isDark ? '0 12px 32px rgba(0,0,0,0.5)' : '0 12px 32px rgba(20,20,24,0.18)',
        zIndex: 150,
        backdropFilter: 'blur(10px)',
      }}
    >
      <button
        onClick={onAddNote}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 10px',
          border: 'none',
          background: 'transparent',
          color: theme.popoverText,
          fontSize: 13,
          cursor: 'pointer',
          borderRadius: 4,
          textAlign: 'left',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = theme.popoverHighlight)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <FilePlus2 size={14} style={{ opacity: 0.7 }} />
        <span>Add from Thinking Space</span>
      </button>
      <button
        onClick={onAddWidget}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 10px',
          border: 'none',
          background: 'transparent',
          color: theme.popoverText,
          fontSize: 13,
          cursor: 'pointer',
          borderRadius: 4,
          textAlign: 'left',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = theme.popoverHighlight)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <AppWindow size={14} style={{ opacity: 0.7 }} />
        <span>Add web widget</span>
      </button>
    </div>
  )
}
