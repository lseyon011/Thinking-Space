import { useCallback, useMemo, useState } from 'react'
import CanvasSurfaceOrch from '@/components/orchestrators/CanvasSurfaceOrch'
import type { CanvasTile } from '@/components/lego_blocks/hooks/shared/useCanvasTilesBlock'
import { webullF9CanvasStorage } from '@/personal_extension/services/lego_blocks/integrations/webullCanvasStorageBlock'
import WebullStudyAnchorBlock from '@/personal_extension/components/lego_blocks/integrations/WebullStudyAnchorBlock'

// World extents balance "bounded board" feel with some breathing room on the
// edges (~400px sky each side, generous top/bottom) — same vibe as Home canvas
// but tighter overall. `clampMinScaleToFit` keeps the user from zooming out
// past the world bounds; the existing edge-flash handles pan clamping.
const CONTENT_WIDTH = 2200
const SIDE_BREATHING = 400
const WORLD_WIDTH = CONTENT_WIDTH + SIDE_BREATHING * 2
const ANCHOR_CENTER_X = WORLD_WIDTH / 2

const MISSION_HEIGHT = 180
const MISSION_GAP = 32
const ANCHOR_TOP_BREATHING = 240

// Top of the study card stays fixed so the mission text above it doesn't shift
// when rows expand. The card grows downward; world height stretches to fit.
const STUDY_TOP_Y = MISSION_HEIGHT + MISSION_GAP + ANCHOR_TOP_BREATHING

const STUDY_MIN_HEIGHT_FOR_LAYOUT = 600 // first-render fallback before ResizeObserver fires
const STUDY_BOTTOM_BREATHING = 320

// Seed post-it positions are absolute world coords picked from the initial
// layout assumption. They only apply on first run (storage returns null);
// once the canvas is persisted, user-edited positions win.
const POSTIT_LEFT_X = ANCHOR_CENTER_X - 720
const POSTIT_RIGHT_X = ANCHOR_CENTER_X + 460
const POSTIT_TOP_Y = STUDY_TOP_Y + 120
const POSTIT_BOTTOM_Y = STUDY_TOP_Y + STUDY_MIN_HEIGHT_FOR_LAYOUT - 80
const POSTIT_BOTTOM_HEIGHT = 200
const POSTIT_REACH_Y = POSTIT_BOTTOM_Y + POSTIT_BOTTOM_HEIGHT

const SEED_TILES: CanvasTile[] = [
  {
    id: 'f9-seed-rules',
    type: 'post-it',
    x: POSTIT_LEFT_X,
    y: POSTIT_TOP_Y,
    w: 280,
    h: 320,
    text: 'Rules I keep breaking\n\n• ',
    color: 'yellow',
    locked: true,
  },
  {
    id: 'f9-seed-why',
    type: 'post-it',
    x: POSTIT_RIGHT_X,
    y: POSTIT_TOP_Y,
    w: 280,
    h: 320,
    text: 'Why am I holding what I\'m holding?\n\n',
    color: 'pink',
    locked: true,
  },
  {
    id: 'f9-seed-howto',
    type: 'post-it',
    x: POSTIT_LEFT_X,
    y: POSTIT_BOTTOM_Y,
    w: 280,
    h: POSTIT_BOTTOM_HEIGHT,
    text: 'double-click empty space to add a post-it. right-click for notes + widgets.',
    color: 'blue',
    locked: true,
  },
]

export default function WebullF9CanvasOrch() {
  const [studyHeight, setStudyHeight] = useState(STUDY_MIN_HEIGHT_FOR_LAYOUT)

  // Avoid render thrash when the measured height is unchanged (ResizeObserver
  // can fire on subpixel jitter).
  const onStudyHeightChange = useCallback((next: number) => {
    setStudyHeight(prev => (Math.abs(prev - next) < 1 ? prev : next))
  }, [])

  const worldHeight = useMemo(() => {
    const studyBottom = STUDY_TOP_Y + studyHeight + STUDY_BOTTOM_BREATHING
    return Math.max(studyBottom, POSTIT_REACH_Y + STUDY_BOTTOM_BREATHING)
  }, [studyHeight])

  return (
    <CanvasSurfaceOrch
      surfaceId="webull-f9"
      storage={webullF9CanvasStorage}
      seedTiles={SEED_TILES}
      worldWidth={WORLD_WIDTH}
      worldHeight={worldHeight}
      clampMinScaleToFit
      initialFocus={{
        worldX: ANCHOR_CENTER_X,
        worldY: STUDY_TOP_Y + studyHeight / 2,
        contentWidth: 1000,
        contentHeight: studyHeight + MISSION_HEIGHT + MISSION_GAP,
      }}
      worldExtras={
        <WebullStudyAnchorBlock
          centerX={ANCHOR_CENTER_X}
          studyTopY={STUDY_TOP_Y}
          onStudyHeightChange={onStudyHeightChange}
        />
      }
    />
  )
}
