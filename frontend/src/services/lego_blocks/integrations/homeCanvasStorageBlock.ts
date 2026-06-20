import { createCanvasStorageAdapter } from '@/services/lego_blocks/integrations/canvasStorageBlock'

export const HOME_CANVAS_PATH = '.thinking-space/home-canvas.json'
export const HOME_CANVAS_DIR = '.thinking-space'
export const HOME_CANVAS_VERSION = 1

export const homeCanvasStorage = createCanvasStorageAdapter({
  path: HOME_CANVAS_PATH,
  dir: HOME_CANVAS_DIR,
  version: HOME_CANVAS_VERSION,
})
