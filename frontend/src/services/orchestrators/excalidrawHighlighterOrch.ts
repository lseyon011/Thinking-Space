import {
  EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK,
  buildExcalidrawDisableHighlighterAppStatePatchBlock,
  buildExcalidrawHighlighterAppStatePatchBlock,
  isExcalidrawHighlighterEnabledBlock,
  matchExcalidrawHighlighterPresetBlock,
  type ExcalidrawHighlighterPresetBlock,
} from '../lego_blocks/excalidrawHighlighterBlock'

export type { ExcalidrawHighlighterPresetBlock }

export const EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH = EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK

export function isExcalidrawHighlighterEnabledOrch(appState: Record<string, unknown> | null | undefined): boolean {
  return isExcalidrawHighlighterEnabledBlock(appState)
}

export function matchExcalidrawHighlighterPresetOrch(
  appState: Record<string, unknown> | null | undefined,
  presets: readonly ExcalidrawHighlighterPresetBlock[] = EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK,
): string | null {
  return matchExcalidrawHighlighterPresetBlock(appState, presets)
}

export function buildExcalidrawHighlighterAppStatePatchOrch(
  preset: ExcalidrawHighlighterPresetBlock,
  currentAppState?: Record<string, unknown>,
): Record<string, unknown> {
  return buildExcalidrawHighlighterAppStatePatchBlock(preset, currentAppState)
}

export function buildExcalidrawDisableHighlighterAppStatePatchOrch(
  currentAppState?: Record<string, unknown>,
): Record<string, unknown> {
  return buildExcalidrawDisableHighlighterAppStatePatchBlock(currentAppState)
}
