import CanvasSurfaceOrch from '@/components/orchestrators/CanvasSurfaceOrch'
import type { CanvasTile } from '@/components/lego_blocks/hooks/shared/useCanvasTilesBlock'
import { webullF9CanvasStorage } from '@/personal_extension/services/lego_blocks/integrations/webullCanvasStorageBlock'
import WebullStudyAnchorBlock from '@/personal_extension/components/lego_blocks/integrations/WebullStudyAnchorBlock'

const ANCHOR_CENTER_X = 4500 / 2
const ANCHOR_CENTER_Y = 3000 / 2

const SEED_TILES: CanvasTile[] = [
  {
    id: 'f9-seed-rules',
    type: 'post-it',
    x: ANCHOR_CENTER_X - 1100,
    y: ANCHOR_CENTER_Y - 200,
    w: 280,
    h: 320,
    text: 'Rules I keep breaking\n\n• ',
    color: 'yellow',
    locked: true,
  },
  {
    id: 'f9-seed-why',
    type: 'post-it',
    x: ANCHOR_CENTER_X + 600,
    y: ANCHOR_CENTER_Y - 200,
    w: 280,
    h: 320,
    text: 'Why am I holding what I\'m holding?\n\n',
    color: 'pink',
    locked: true,
  },
  {
    id: 'f9-seed-howto',
    type: 'post-it',
    x: ANCHOR_CENTER_X - 1100,
    y: ANCHOR_CENTER_Y + 280,
    w: 280,
    h: 200,
    text: 'double-click empty space to add a post-it. right-click for notes + widgets.',
    color: 'blue',
    locked: true,
  },
]

export default function WebullF9CanvasOrch() {
  return (
    <CanvasSurfaceOrch
      surfaceId="webull-f9"
      storage={webullF9CanvasStorage}
      seedTiles={SEED_TILES}
      initialFocus={{
        worldX: ANCHOR_CENTER_X,
        worldY: ANCHOR_CENTER_Y,
        contentWidth: 1000,
        contentHeight: 900,
      }}
      worldExtras={
        <WebullStudyAnchorBlock centerX={ANCHOR_CENTER_X} centerY={ANCHOR_CENTER_Y} />
      }
    />
  )
}
