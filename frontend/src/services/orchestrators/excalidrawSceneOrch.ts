import {
  parseExcalidrawScene,
  serializeExcalidrawScene,
  type ParsedExcalidrawScene,
} from '../lego_blocks/excalidrawFileBlock'

export type { ParsedExcalidrawScene }

export function parseExcalidrawSceneOrch(content: string): ParsedExcalidrawScene | null {
  return parseExcalidrawScene(content)
}

export function serializeExcalidrawSceneOrch(
  originalContent: string,
  scene: ParsedExcalidrawScene,
): string {
  return serializeExcalidrawScene(originalContent, scene)
}
