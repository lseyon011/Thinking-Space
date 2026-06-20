import CanvasSurfaceOrch from '@/components/orchestrators/CanvasSurfaceOrch'
import type { CanvasTile } from '@/components/lego_blocks/hooks/shared/useCanvasTilesBlock'
import { thinkingOrgCanvasStorage } from '@/services/lego_blocks/integrations/thinkingOrgCanvasStorageBlock'
import ThinkingOrgCanvasAnchorBlock from '@/components/lego_blocks/integrations/ThinkingOrgCanvasAnchorBlock'

const ANCHOR_CENTER_X = 4500 / 2
const ANCHOR_CENTER_Y = 3000 / 2

const SEED_TILES: CanvasTile[] = [
  {
    id: 'org-board-seed-avoiding',
    type: 'post-it',
    x: ANCHOR_CENTER_X - 1100,
    y: ANCHOR_CENTER_Y - 200,
    w: 280,
    h: 280,
    text: 'What am I avoiding?\n\n',
    color: 'yellow',
    locked: true,
  },
  {
    id: 'org-board-seed-questions',
    type: 'post-it',
    x: ANCHOR_CENTER_X + 600,
    y: ANCHOR_CENTER_Y - 200,
    w: 280,
    h: 280,
    text: 'Open questions\n\n• ',
    color: 'pink',
    locked: true,
  },
  {
    id: 'org-board-seed-next-step',
    type: 'post-it',
    x: ANCHOR_CENTER_X - 1100,
    y: ANCHOR_CENTER_Y + 280,
    w: 280,
    h: 220,
    text: 'Next concrete step\n\n→ ',
    color: 'blue',
    locked: true,
  },
  {
    id: 'org-board-seed-howto',
    type: 'post-it',
    x: ANCHOR_CENTER_X + 600,
    y: ANCHOR_CENTER_Y + 280,
    w: 280,
    h: 220,
    text: 'double-click empty space to add a post-it. right-click for notes + widgets.',
    color: 'green',
    locked: true,
  },
]

export default function ThinkingOrgCanvasOrch() {
  return (
    <CanvasSurfaceOrch
      surfaceId="thinking-org-board"
      storage={thinkingOrgCanvasStorage}
      seedTiles={SEED_TILES}
      initialFocus={{
        worldX: ANCHOR_CENTER_X,
        worldY: ANCHOR_CENTER_Y,
        contentWidth: 1000,
        contentHeight: 900,
      }}
      worldExtras={
        <ThinkingOrgCanvasAnchorBlock centerX={ANCHOR_CENTER_X} centerY={ANCHOR_CENTER_Y} />
      }
    />
  )
}
