interface ExcalidrawHighlighterStrokeOptionsBlock {
  highlighter: boolean
  constantPressure: boolean
  hasOutline: boolean
  outlineWidth: number
  options: {
    thinning: number
    smoothing: number
    streamline: number
    easing: string
    start: {
      taper: number
      cap: boolean
      easing: string
    }
    end: {
      taper: number
      cap: boolean
      easing: string
    }
  }
}

export interface ExcalidrawHighlighterPresetBlock {
  id: string
  label: string
  strokeColor: string
  backgroundColor: string
  strokeWidth: number
  opacity: number
  strokeOptions: ExcalidrawHighlighterStrokeOptionsBlock
}

const BASE_HIGHLIGHTER_OPTIONS: ExcalidrawHighlighterStrokeOptionsBlock = {
  highlighter: true,
  constantPressure: true,
  hasOutline: true,
  outlineWidth: 4,
  options: {
    thinning: 1,
    smoothing: 0.5,
    streamline: 0.5,
    easing: 'linear',
    start: {
      taper: 0,
      cap: true,
      easing: 'linear',
    },
    end: {
      taper: 0,
      cap: true,
      easing: 'linear',
    },
  },
}

export const EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK: readonly ExcalidrawHighlighterPresetBlock[] = [
  {
    id: 'yellow',
    label: 'Yellow',
    strokeColor: '#fff9db',
    backgroundColor: '#fff9db',
    strokeWidth: 2.6,
    opacity: 100,
    strokeOptions: BASE_HIGHLIGHTER_OPTIONS,
  },
  {
    id: 'green',
    label: 'Green',
    strokeColor: '#d3f9d8',
    backgroundColor: '#d3f9d8',
    strokeWidth: 2.6,
    opacity: 100,
    strokeOptions: BASE_HIGHLIGHTER_OPTIONS,
  },
  {
    id: 'blue',
    label: 'Blue',
    strokeColor: '#d0ebff',
    backgroundColor: '#d0ebff',
    strokeWidth: 2.6,
    opacity: 100,
    strokeOptions: BASE_HIGHLIGHTER_OPTIONS,
  },
  {
    id: 'orange',
    label: 'Orange',
    strokeColor: '#ffe8cc',
    backgroundColor: '#ffe8cc',
    strokeWidth: 2.6,
    opacity: 100,
    strokeOptions: BASE_HIGHLIGHTER_OPTIONS,
  },
  {
    id: 'pink',
    label: 'Pink',
    strokeColor: '#fff0f6',
    backgroundColor: '#fff0f6',
    strokeWidth: 2.6,
    opacity: 100,
    strokeOptions: BASE_HIGHLIGHTER_OPTIONS,
  },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeColor(value: unknown): string | null {
  return typeof value === 'string' ? value.trim().toLowerCase() : null
}

function getActiveToolBase(appState?: Record<string, unknown>): Record<string, unknown> {
  if (!appState || !isRecord(appState.activeTool)) return {}
  return appState.activeTool
}

function readCurrentStrokeOptions(appState?: Record<string, unknown>): Record<string, unknown> {
  if (!appState || !isRecord(appState.currentStrokeOptions)) return {}
  return appState.currentStrokeOptions
}

export function isExcalidrawHighlighterEnabledBlock(appState: Record<string, unknown> | null | undefined): boolean {
  if (!appState) return false
  const options = readCurrentStrokeOptions(appState)
  return options.highlighter === true
}

export function matchExcalidrawHighlighterPresetBlock(
  appState: Record<string, unknown> | null | undefined,
  presets: readonly ExcalidrawHighlighterPresetBlock[] = EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK,
): string | null {
  if (!appState || !isExcalidrawHighlighterEnabledBlock(appState)) return null

  const strokeColor = normalizeColor(appState.currentItemStrokeColor)
  const backgroundColor = normalizeColor(appState.currentItemBackgroundColor)

  for (const preset of presets) {
    const presetStroke = normalizeColor(preset.strokeColor)
    const presetBackground = normalizeColor(preset.backgroundColor)
    if (strokeColor === presetStroke || backgroundColor === presetBackground) {
      return preset.id
    }
  }

  return 'custom'
}

export function buildExcalidrawHighlighterAppStatePatchBlock(
  preset: ExcalidrawHighlighterPresetBlock,
  currentAppState?: Record<string, unknown>,
): Record<string, unknown> {
  const activeToolBase = getActiveToolBase(currentAppState)

  return {
    activeTool: {
      ...activeToolBase,
      type: 'freedraw',
      customType: null,
      locked: false,
      fromSelection: false,
    },
    currentItemStrokeColor: preset.strokeColor,
    currentItemBackgroundColor: preset.backgroundColor,
    currentItemFillStyle: 'solid',
    currentItemStrokeWidth: preset.strokeWidth,
    currentItemOpacity: preset.opacity,
    currentItemStrokeStyle: 'solid',
    currentItemRoughness: 0,
    currentStrokeOptions: {
      ...preset.strokeOptions,
      options: {
        ...preset.strokeOptions.options,
        start: { ...preset.strokeOptions.options.start },
        end: { ...preset.strokeOptions.options.end },
      },
    },
  }
}

export function buildExcalidrawDisableHighlighterAppStatePatchBlock(
  currentAppState?: Record<string, unknown>,
): Record<string, unknown> {
  const activeToolBase = getActiveToolBase(currentAppState)
  const currentStrokeOptions = readCurrentStrokeOptions(currentAppState)

  return {
    activeTool: {
      ...activeToolBase,
      type: 'freedraw',
      customType: null,
      locked: false,
      fromSelection: false,
    },
    currentItemBackgroundColor: 'transparent',
    currentItemFillStyle: 'solid',
    currentStrokeOptions: {
      ...currentStrokeOptions,
      highlighter: false,
      hasOutline: false,
      outlineWidth: 1,
    },
  }
}
