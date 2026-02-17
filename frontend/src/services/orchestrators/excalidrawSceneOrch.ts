import { parseExcalidrawScene, type ParsedExcalidrawScene } from '../lego_blocks/excalidrawFileBlock'

export type { ParsedExcalidrawScene }

export function parseExcalidrawSceneOrch(content: string): ParsedExcalidrawScene | null {
  return parseExcalidrawScene(content)
}
