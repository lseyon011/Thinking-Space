import { createCanvasStorageAdapter } from '@/services/lego_blocks/integrations/canvasStorageBlock'

export const THINKING_ORG_CANVAS_PATH = '.thinking-space/thinking-org-canvas.json'
export const THINKING_ORG_CANVAS_DIR = '.thinking-space'
export const THINKING_ORG_CANVAS_VERSION = 1

export const thinkingOrgCanvasStorage = createCanvasStorageAdapter({
  path: THINKING_ORG_CANVAS_PATH,
  dir: THINKING_ORG_CANVAS_DIR,
  version: THINKING_ORG_CANVAS_VERSION,
})
