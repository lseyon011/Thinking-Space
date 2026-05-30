import { getVaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import type { CanvasTile } from '@/components/lego_blocks/hooks/shared/useCanvasTilesBlock'

export const HOME_CANVAS_PATH = '.thinking-space/home-canvas.json'
export const HOME_CANVAS_DIR = '.thinking-space'
export const HOME_CANVAS_VERSION = 1

export interface HomeCanvasFile {
  version: number
  tiles: CanvasTile[]
}

export async function readHomeCanvas(): Promise<HomeCanvasFile | null> {
  try {
    const fs = getVaultFS()
    if (!(await fs.exists(HOME_CANVAS_PATH))) return null
    const raw = await fs.read(HOME_CANVAS_PATH)
    const parsed = JSON.parse(raw) as HomeCanvasFile
    if (!parsed || parsed.version !== HOME_CANVAS_VERSION) return null
    if (!Array.isArray(parsed.tiles)) return null
    return parsed
  } catch {
    return null
  }
}

export async function writeHomeCanvas(tiles: CanvasTile[]): Promise<void> {
  const fs = getVaultFS()
  await fs.mkdir(HOME_CANVAS_DIR)
  const payload: HomeCanvasFile = { version: HOME_CANVAS_VERSION, tiles }
  await fs.write(HOME_CANVAS_PATH, JSON.stringify(payload, null, 2))
}
