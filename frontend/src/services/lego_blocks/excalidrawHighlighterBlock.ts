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
      taper: number | boolean
      cap: boolean
      easing: string
    }
    end: {
      taper: number | boolean
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

const BASE_COMPAT_VISIBLE_HIGHLIGHTER_STROKES = new Set(['#fff', '#ffffff', 'white'])

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

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback
}

function asTaper(value: unknown, fallback: number | boolean): number | boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return fallback
}

function makePresetId(rawLabel: string, index: number, seen: Map<string, number>): string {
  const slug = rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const base = slug || `highlighter-${index + 1}`
  const count = seen.get(base) ?? 0
  seen.set(base, count + 1)
  return count === 0 ? base : `${base}-${count + 1}`
}

function toDisplayLabel(rawType: unknown, index: number): string {
  if (typeof rawType !== 'string' || rawType.trim() === '') return `Highlighter ${index + 1}`
  const normalized = rawType.replace(/[-_]+/g, ' ').trim().toLowerCase()
  return normalized.replace(/\b\w/g, c => c.toUpperCase())
}

function adaptStrokeColorForInterop(strokeColor: string, backgroundColor: string): string {
  const normalized = strokeColor.trim().toLowerCase()
  if (BASE_COMPAT_VISIBLE_HIGHLIGHTER_STROKES.has(normalized) && backgroundColor.trim() !== '') {
    return backgroundColor
  }
  return strokeColor
}

function resolveStrokeOptionsFromObsidianPen(
  penOptions: Record<string, unknown>,
): ExcalidrawHighlighterStrokeOptionsBlock {
  const options = isRecord(penOptions.options) ? penOptions.options : {}
  const start = isRecord(options.start) ? options.start : {}
  const end = isRecord(options.end) ? options.end : {}
  return {
    highlighter: true,
    constantPressure: asBoolean(penOptions.constantPressure, true),
    hasOutline: asBoolean(penOptions.hasOutline, true),
    outlineWidth: asNumber(penOptions.outlineWidth, 4),
    options: {
      thinning: asNumber(options.thinning, 1),
      smoothing: asNumber(options.smoothing, 0.5),
      streamline: asNumber(options.streamline, 0.5),
      easing: asString(options.easing, 'linear'),
      start: {
        taper: asTaper(start.taper, 0),
        cap: asBoolean(start.cap, true),
        easing: asString(start.easing, 'linear'),
      },
      end: {
        taper: asTaper(end.taper, 0),
        cap: asBoolean(end.cap, true),
        easing: asString(end.easing, 'linear'),
      },
    },
  }
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

export function extractObsidianHighlighterPresetsFromPluginDataBlock(
  pluginData: unknown,
): ExcalidrawHighlighterPresetBlock[] {
  if (!isRecord(pluginData) || !Array.isArray(pluginData.customPens)) return []

  const seenIds = new Map<string, number>()
  const presets: ExcalidrawHighlighterPresetBlock[] = []
  for (let index = 0; index < pluginData.customPens.length; index += 1) {
    const item = pluginData.customPens[index]
    if (!isRecord(item)) continue

    const penOptions = isRecord(item.penOptions) ? item.penOptions : {}
    const isHighlighter = penOptions.highlighter === true || item.type === 'highlighter'
    if (!isHighlighter) continue

    const backgroundColor = asString(item.backgroundColor, '#fff9db')
    const rawStrokeColor = asString(item.strokeColor, backgroundColor)
    const strokeColor = adaptStrokeColorForInterop(rawStrokeColor, backgroundColor)
    const label = toDisplayLabel(item.type, index)
    const id = makePresetId(label, index, seenIds)

    presets.push({
      id,
      label,
      strokeColor,
      backgroundColor,
      strokeWidth: Math.max(asNumber(item.strokeWidth, 2.6), 0.5),
      opacity: Math.min(Math.max(Math.round(asNumber(item.opacity, 100)), 1), 100),
      strokeOptions: resolveStrokeOptionsFromObsidianPen(penOptions),
    })
  }

  return presets
}

export function parseObsidianHighlighterPresetsJsonBlock(jsonText: string): ExcalidrawHighlighterPresetBlock[] {
  if (typeof jsonText !== 'string' || jsonText.trim() === '') return []
  try {
    const parsed = JSON.parse(jsonText)
    return extractObsidianHighlighterPresetsFromPluginDataBlock(parsed)
  } catch {
    return []
  }
}
