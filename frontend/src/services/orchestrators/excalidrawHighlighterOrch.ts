import {
  EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK,
  buildExcalidrawDisableHighlighterAppStatePatchBlock,
  buildExcalidrawHighlighterAppStatePatchBlock,
  isExcalidrawHighlighterEnabledBlock,
  parseObsidianHighlighterPresetsJsonBlock,
  matchExcalidrawHighlighterPresetBlock,
  type ExcalidrawHighlighterPresetBlock,
} from '../lego_blocks/excalidrawHighlighterBlock'
import { getVaultFS, type VaultFS } from '../lego_blocks/fsBlock'

export type { ExcalidrawHighlighterPresetBlock }

export const EXCALIDRAW_HIGHLIGHTER_PRESETS_ORCH = EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK
export const DEFAULT_OBSIDIAN_EXCALIDRAW_PLUGIN_SETTINGS_PATH_ORCH = '.obsidian/plugins/obsidian-excalidraw-plugin/data.json'

export interface LoadExcalidrawHighlighterPresetsInputOrch {
  fs?: VaultFS
  pluginSettingsPath?: string
}

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

export async function loadExcalidrawHighlighterPresetsOrch(
  input: LoadExcalidrawHighlighterPresetsInputOrch = {},
): Promise<readonly ExcalidrawHighlighterPresetBlock[]> {
  const fs = input.fs ?? getVaultFS()
  const settingsPath = input.pluginSettingsPath ?? DEFAULT_OBSIDIAN_EXCALIDRAW_PLUGIN_SETTINGS_PATH_ORCH
  try {
    const raw = await fs.read(settingsPath)
    const parsed = parseObsidianHighlighterPresetsJsonBlock(raw)
    if (parsed.length > 0) return parsed
  } catch {
    // Fallback to built-in presets when plugin settings file is unavailable.
  }
  return EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK
}
