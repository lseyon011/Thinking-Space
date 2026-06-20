import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'

interface BacklogCanvasMissionBlockProps {
  centerX: number
  topY: number
  width: number
  height: number
  projectName?: string
  missionStatement?: string
}

export default function BacklogCanvasMissionBlock({
  centerX,
  topY,
  width,
  height,
  projectName,
  missionStatement,
}: BacklogCanvasMissionBlockProps) {
  const theme = useCanvasThemeBlock()
  const displayName = projectName?.trim() || 'Thinking Organizer'
  const displayMission = missionStatement?.trim()
    || 'Project mission appears here once set in the Backlog list view.'

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
          height,
          textAlign: 'center',
          userSelect: 'none',
          zIndex: 2,
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: theme.anchorEyebrow,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Thinking Organizer
        </p>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: theme.anchorHeading,
            margin: '8px 0 0',
          }}
        >
          {displayName}
        </h1>
        <p
          style={{
            fontSize: 14,
            color: theme.anchorEyebrow,
            margin: '8px 0 0',
            fontStyle: missionStatement?.trim() ? 'italic' : 'normal',
            lineHeight: 1.5,
          }}
        >
          {displayMission}
        </p>
      </div>
    </div>
  )
}
