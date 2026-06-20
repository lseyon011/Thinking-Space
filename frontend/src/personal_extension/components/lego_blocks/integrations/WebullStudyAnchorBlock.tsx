import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'
import { useCanvasProjectBindingBlock } from '@/components/lego_blocks/hooks/shared/useCanvasProjectBindingBlock'
import CanvasProjectPickerBlock from '@/components/lego_blocks/integrations/CanvasProjectPickerBlock'
import WebullStudyBlock from './WebullStudyBlock'

interface AnchorProps {
  centerX: number
  centerY: number
}

const STUDY_W = 920
const STUDY_H = 760
const MISSION_W = 720
const MISSION_H = 180
const MISSION_OFFSET_Y = -(STUDY_H / 2) - MISSION_H - 32

export default function WebullStudyAnchorBlock({ centerX, centerY }: AnchorProps) {
  const theme = useCanvasThemeBlock()
  const { project } = useCanvasProjectBindingBlock('webull-f9')
  const projectName = project?.name?.trim() || 'No project bound'
  const projectMission = project?.mission?.trim() || 'Pick a project to show its mission here, or add one in Settings → Projects.'

  const missionX = centerX - MISSION_W / 2
  const missionY = centerY + MISSION_OFFSET_Y
  const studyX = centerX - STUDY_W / 2
  const studyY = centerY - STUDY_H / 2

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
        <p
          style={{
            fontSize: 12,
            color: theme.anchorEyebrow,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          F9
        </p>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: theme.anchorHeading,
            margin: '8px 0 0',
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
          top: studyY,
          width: STUDY_W,
          height: STUDY_H,
          padding: 20,
          borderRadius: 14,
          background: theme.anchorPanelBg,
          border: `1px solid ${theme.anchorPanelBorder}`,
          boxShadow: theme.anchorPanelShadow,
          overflow: 'auto',
          cursor: 'default',
          zIndex: 2,
          color: theme.tileText,
        }}
      >
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
  )
}
