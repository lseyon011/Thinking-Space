import { createCanvasStorageAdapter } from '@/services/lego_blocks/integrations/canvasStorageBlock'

export const WEBULL_F9_CANVAS_PATH = '.thinking-space/webull-f9-canvas.json'
export const WEBULL_F9_CANVAS_DIR = '.thinking-space'
export const WEBULL_F9_CANVAS_VERSION = 1

export const webullF9CanvasStorage = createCanvasStorageAdapter({
  path: WEBULL_F9_CANVAS_PATH,
  dir: WEBULL_F9_CANVAS_DIR,
  version: WEBULL_F9_CANVAS_VERSION,
})
