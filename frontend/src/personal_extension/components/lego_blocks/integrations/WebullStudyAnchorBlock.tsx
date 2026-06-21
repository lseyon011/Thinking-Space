import { useEffect, useRef } from 'react'
import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'
import { useCanvasProjectBindingBlock } from '@/components/lego_blocks/hooks/shared/useCanvasProjectBindingBlock'
import CanvasProjectPickerBlock from '@/components/lego_blocks/integrations/CanvasProjectPickerBlock'
import WebullStudyBlock from './WebullStudyBlock'

interface AnchorProps {
  /** Horizontal center of the anchor in world coords. */
  centerX: number
  /** Top edge of the study card in world coords (fixed; lets the card grow downward without shifting mission text). */
  studyTopY: number
  /** Notified whenever the study card's intrinsic content height changes (row expand/collapse, row count change). */
  onStudyHeightChange: (height: number) => void
}

const STUDY_W = 920
const MISSION_W = 720
const MISSION_H = 180
const MISSION_GAP = 32
const STUDY_VERTICAL_PADDING = 40 // matches `padding: 20` (top + bottom)

export default function WebullStudyAnchorBlock({ centerX, studyTopY, onStudyHeightChange }: AnchorProps) {
  const theme = useCanvasThemeBlock()
  const { project } = useCanvasProjectBindingBlock('webull-f9')
  const projectName = project?.name?.trim() || 'No project bound'
  const projectMission = project?.mission?.trim() || 'Pick a project to show its mission here, or add one in Settings → Projects.'
  const contentRef = useRef<HTMLDivElement | null>(null)

  // Measure the study card's intrinsic content height with ResizeObserver so the
  // canvas world grows when rows expand or the company list changes. Reports up
  // via callback so the parent orch can size + clamp the world accordingly.
  useEffect(() => {
    const el = contentRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const inner = entry.contentRect.height
        onStudyHeightChange(inner + STUDY_VERTICAL_PADDING)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [onStudyHeightChange])

  const missionX = centerX - MISSION_W / 2
  const missionY = studyTopY - MISSION_H - MISSION_GAP
  const studyX = centerX - STUDY_W / 2

  return (
    <div className={theme.isDark ? 'dark' : ''}>
      <div
        data-canvas-anchor-element="true"
        onMouseDown={e => e.stopPropagation()}
        onDoubleClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: missionX,
          top: missionY,
          width: MISSION_W,
          height: MISSION_H,
          textAlign: 'center',
          userSelect: 'none',
          zIndex: 2,
        }}
      >
        <h1
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: theme.anchorHeading,
            margin: 0,
          }}
        >
          {projectName}
        </h1>
        <p
          style={{
            fontSize: 14,
            color: theme.anchorEyebrow,
            margin: '8px 0 0',
            fontStyle: project?.mission?.trim() ? 'italic' : 'normal',
            lineHeight: 1.5,
          }}
        >
          {projectMission}
        </p>
        <div style={{ marginTop: 12 }}>
          <CanvasProjectPickerBlock surfaceId="webull-f9" />
        </div>
      </div>

      <div
        data-canvas-anchor-element="true"
        onMouseDown={e => e.stopPropagation()}
        onDoubleClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: studyX,
          top: studyTopY,
          width: STUDY_W,
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
        <div ref={contentRef}>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: theme.anchorHeading, margin: 0 }}>
              Study
            </h2>
            <p style={{ fontSize: 13, color: theme.tileTextMuted, margin: '4px 0 0' }}>
              Company study records (watchlist + held) with live prices.
            </p>
          </div>
          <WebullStudyBlock />
        </div>
      </div>
    </div>
  )
}
