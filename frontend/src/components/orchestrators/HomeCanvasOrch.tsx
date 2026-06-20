import CanvasSurfaceOrch, {
  type CanvasSurfaceTilesApi,
} from '@/components/orchestrators/CanvasSurfaceOrch'
import type { CanvasTile } from '@/components/lego_blocks/hooks/shared/useCanvasTilesBlock'
import { useAiActivityBlock } from '@/components/lego_blocks/hooks/shared/useAiActivityBlock'
import { useAiActivityPostItBlock } from '@/components/lego_blocks/hooks/shared/useAiActivityPostItBlock'
import HomeAnchorTileBlock from '@/components/lego_blocks/integrations/HomeAnchorTileBlock'
import MoonSceneBlock from '@/components/lego_blocks/units/MoonSceneBlock'
import { homeCanvasStorage } from '@/services/lego_blocks/integrations/homeCanvasStorageBlock'

const ANCHOR_CENTER_X = 4500 / 2
// +200 vs the original 3000/2 center: extra sky above the moon scene.
const ANCHOR_CENTER_Y = 3000 / 2 + 200

const SEED_TILES: CanvasTile[] = [
  {
    id: 'seed-1',
    type: 'post-it',
    x: 480,
    y: 780,
    w: 280,
    h: 280,
    text: 'double-click empty space to make a new one',
    color: 'yellow',
    locked: true,
  },
  {
    id: 'seed-2',
    type: 'post-it',
    x: 2080,
    y: 780,
    w: 280,
    h: 320,
    text: 'right-click and "Add note" to pull a vault note onto the board',
    color: 'pink',
    locked: true,
  },
  {
    id: 'seed-3',
    type: 'post-it',
    x: 200,
    y: 1660,
    w: 280,
    h: 280,
    text: '',
    color: 'blue',
    locked: true,
  },
]

// Drives the auto "what I did today" post-it. Reads AI session activity
// (Claude + Codex, from vault and native stores) and appends new chains into
// the daily post-it on the canvas. Shares the cache with AiActivityPanelBlock
// inside the anchor, so a single load feeds both surfaces.
function HomeTilesEffect({ tiles, setAllTiles, loaded }: CanvasSurfaceTilesApi) {
  const aiActivity = useAiActivityBlock('90d')
  useAiActivityPostItBlock({
    tiles,
    todayChains: aiActivity.todayChains,
    ready: !aiActivity.loading && !aiActivity.error,
    canvasLoaded: loaded,
    setAllTiles,
  })
  return null
}

export default function HomeCanvasOrch() {
  return (
    <CanvasSurfaceOrch
      surfaceId="home"
      storage={homeCanvasStorage}
      seedTiles={SEED_TILES}
      worldHeight={3800}
      initialFocus={{
        worldX: ANCHOR_CENTER_X,
        worldY: ANCHOR_CENTER_Y - 280,
        contentWidth: 920,
        contentHeight: 1100,
      }}
      worldExtras={
        <>
          <MoonSceneBlock x={ANCHOR_CENTER_X - 260} y={ANCHOR_CENTER_Y - 810} />
          <HomeAnchorTileBlock centerX={ANCHOR_CENTER_X} centerY={ANCHOR_CENTER_Y} />
        </>
      }
      tilesEffect={HomeTilesEffect}
    />
  )
}
