import {
  buildExcalidrawInitialDataBlock,
  cloneExcalidrawSceneChangeBlock,
  createExcalidrawCanvasApiBlock,
  type ExcalidrawCanvasApiBlock,
  type ExcalidrawViewportStateBlock,
} from '@/services/lego_blocks/integrations/excalidrawIntegrationBlock'
import type { ParsedExcalidrawScene } from '@/services/lego_blocks/integrations/excalidrawFileBlock'

export type ExcalidrawCanvasApiOrch = ExcalidrawCanvasApiBlock
export type ExcalidrawViewportStateOrch = ExcalidrawViewportStateBlock

export function createExcalidrawCanvasApiOrch(rawApi: unknown): ExcalidrawCanvasApiOrch | null {
  return createExcalidrawCanvasApiBlock(rawApi)
}

export function buildExcalidrawInitialDataOrch(
  scene: ParsedExcalidrawScene,
  editable: boolean,
): ParsedExcalidrawScene {
  return buildExcalidrawInitialDataBlock(scene, editable)
}

export function cloneExcalidrawSceneChangeOrch(
  elements: readonly unknown[],
  appState: Record<string, unknown>,
  files: Record<string, unknown>,
): ParsedExcalidrawScene {
  return cloneExcalidrawSceneChangeBlock(elements, appState, files)
}
