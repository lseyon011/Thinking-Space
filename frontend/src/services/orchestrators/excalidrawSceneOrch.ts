import {
  parseExcalidrawScene,
  parseExcalidrawSceneRaw,
  serializeExcalidrawScene,
  type ParsedExcalidrawScene,
} from '@/services/lego_blocks/integrations/excalidrawFileBlock'

export type { ParsedExcalidrawScene }

export function parseExcalidrawSceneOrch(content: string): ParsedExcalidrawScene | null {
  return parseExcalidrawScene(content)
}

export function parseExcalidrawSceneRawOrch(content: string): ParsedExcalidrawScene | null {
  return parseExcalidrawSceneRaw(content)
}

export function serializeExcalidrawSceneOrch(
  originalContent: string,
  scene: ParsedExcalidrawScene,
): string {
  return serializeExcalidrawScene(originalContent, scene)
}
