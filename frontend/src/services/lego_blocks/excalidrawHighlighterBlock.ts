interface ExcalidrawPenStrokeOptionsBlock {
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
  penType: string
  freedrawOnly: boolean
  strokeColor: string
  backgroundColor: string
  fillStyle: 'hachure' | 'solid' | 'cross-hatch' | 'zigzag' | 'dashed' | 'dots'
  strokeWidth: number
  roughness: number
  opacity: number
  strokeOptions: ExcalidrawPenStrokeOptionsBlock
}

interface ObsidianCustomPenSeed {
  penType: string
  freedrawOnly: boolean
  strokeColor: string
  backgroundColor: string
  fillStyle: ExcalidrawHighlighterPresetBlock['fillStyle']
  strokeWidth: number
  roughness: number
  opacity: number
  strokeOptions: ExcalidrawPenStrokeOptionsBlock
}

function makeStrokeOptions(input: {
  highlighter: boolean
  constantPressure: boolean
  hasOutline: boolean
  outlineWidth: number
  thinning: number
  smoothing: number
  streamline: number
  easing: string
  startTaper: number | boolean
  startCap: boolean
  startEasing: string
  endTaper: number | boolean
  endCap: boolean
  endEasing: string
}): ExcalidrawPenStrokeOptionsBlock {
  return {
    highlighter: input.highlighter,
    constantPressure: input.constantPressure,
    hasOutline: input.hasOutline,
    outlineWidth: input.outlineWidth,
    options: {
      thinning: input.thinning,
      smoothing: input.smoothing,
      streamline: input.streamline,
      easing: input.easing,
      start: {
        taper: input.startTaper,
        cap: input.startCap,
        easing: input.startEasing,
      },
      end: {
        taper: input.endTaper,
        cap: input.endCap,
        easing: input.endEasing,
      },
    },
  }
}

const OBSIDIAN_DEFAULT_CUSTOM_PENS_SEED: readonly ObsidianCustomPenSeed[] = [
  {
    penType: 'default',
    freedrawOnly: false,
    strokeColor: '#000000',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 0,
    roughness: 0,
    opacity: 100,
    strokeOptions: makeStrokeOptions({
      highlighter: false,
      constantPressure: false,
      hasOutline: false,
      outlineWidth: 1,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      easing: 'easeOutSine',
      startTaper: 0,
      startCap: true,
      startEasing: 'linear',
      endTaper: 0,
      endCap: true,
      endEasing: 'linear',
    }),
  },
  {
    penType: 'default',
    freedrawOnly: true,
    strokeColor: '#ffffff',
    backgroundColor: '#fff9db',
    fillStyle: 'solid',
    strokeWidth: 2.6,
    roughness: 0,
    opacity: 100,
    strokeOptions: makeStrokeOptions({
      highlighter: true,
      constantPressure: true,
      hasOutline: true,
      outlineWidth: 4,
      thinning: 1,
      smoothing: 0.5,
      streamline: 0.5,
      easing: 'linear',
      startTaper: 0,
      startCap: true,
      startEasing: 'linear',
      endTaper: 0,
      endCap: true,
      endEasing: 'linear',
    }),
  },
  {
    penType: 'finetip',
    freedrawOnly: false,
    strokeColor: '#000000',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 0.5,
    roughness: 0,
    opacity: 100,
    strokeOptions: makeStrokeOptions({
      highlighter: false,
      constantPressure: false,
      hasOutline: false,
      outlineWidth: 0,
      thinning: -0.5,
      smoothing: 0.4,
      streamline: 0.4,
      easing: 'linear',
      startTaper: 5,
      startCap: false,
      startEasing: 'linear',
      endTaper: 5,
      endCap: false,
      endEasing: 'linear',
    }),
  },
  {
    penType: 'fountain',
    freedrawOnly: false,
    strokeColor: '#000000',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 2,
    roughness: 0,
    opacity: 100,
    strokeOptions: makeStrokeOptions({
      highlighter: false,
      constantPressure: false,
      hasOutline: false,
      outlineWidth: 1,
      thinning: 0.6,
      smoothing: 0.2,
      streamline: 0.2,
      easing: 'easeInOutSine',
      startTaper: 150,
      startCap: true,
      startEasing: 'linear',
      endTaper: 1,
      endCap: true,
      endEasing: 'linear',
    }),
  },
  {
    penType: 'marker',
    freedrawOnly: true,
    strokeColor: '#B83E3E',
    backgroundColor: '#FF7C7C',
    fillStyle: 'dashed',
    strokeWidth: 2,
    roughness: 3,
    opacity: 100,
    strokeOptions: makeStrokeOptions({
      highlighter: false,
      constantPressure: true,
      hasOutline: true,
      outlineWidth: 4,
      thinning: 1,
      smoothing: 0.5,
      streamline: 0.5,
      easing: 'linear',
      startTaper: 0,
      startCap: true,
      startEasing: 'linear',
      endTaper: 0,
      endCap: true,
      endEasing: 'linear',
    }),
  },
  {
    penType: 'thick-thin',
    freedrawOnly: true,
    strokeColor: '#CECDCC',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 0,
    roughness: 0,
    opacity: 100,
    strokeOptions: makeStrokeOptions({
      highlighter: true,
      constantPressure: true,
      hasOutline: false,
      outlineWidth: 1,
      thinning: 1,
      smoothing: 0.5,
      streamline: 0.5,
      easing: 'linear',
      startTaper: 0,
      startCap: true,
      startEasing: 'linear',
      endTaper: true,
      endCap: true,
      endEasing: 'linear',
    }),
  },
  {
    penType: 'thin-thick-thin',
    freedrawOnly: true,
    strokeColor: '#CECDCC',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 0,
    roughness: 0,
    opacity: 100,
    strokeOptions: makeStrokeOptions({
      highlighter: true,
      constantPressure: true,
      hasOutline: false,
      outlineWidth: 1,
      thinning: 1,
      smoothing: 0.5,
      streamline: 0.5,
      easing: 'linear',
      startTaper: true,
      startCap: true,
      startEasing: 'linear',
      endTaper: true,
      endCap: true,
      endEasing: 'linear',
    }),
  },
  {
    penType: 'highlighter',
    freedrawOnly: false,
    strokeColor: '#fff0f6',
    backgroundColor: '#fff0f6',
    fillStyle: 'solid',
    strokeWidth: 2,
    roughness: 0,
    opacity: 100,
    strokeOptions: makeStrokeOptions({
      highlighter: true,
      constantPressure: true,
      hasOutline: true,
      outlineWidth: 4,
      thinning: 1,
      smoothing: 0.5,
      streamline: 0.5,
      easing: 'linear',
      startTaper: 0,
      startCap: true,
      startEasing: 'linear',
      endTaper: 0,
      endCap: true,
      endEasing: 'linear',
    }),
  },
  // Slots 9-10: extra "default" pen slots matching Obsidian's 10-pen layout
  {
    penType: 'default',
    freedrawOnly: false,
    strokeColor: '#000000',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 0,
    roughness: 0,
    opacity: 100,
    strokeOptions: makeStrokeOptions({
      highlighter: false,
      constantPressure: false,
      hasOutline: false,
      outlineWidth: 1,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      easing: 'easeOutSine',
      startTaper: 0,
      startCap: true,
      startEasing: 'linear',
      endTaper: 0,
      endCap: true,
      endEasing: 'linear',
    }),
  },
  {
    penType: 'default',
    freedrawOnly: false,
    strokeColor: '#000000',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 0,
    roughness: 0,
    opacity: 100,
    strokeOptions: makeStrokeOptions({
      highlighter: false,
      constantPressure: false,
      hasOutline: false,
      outlineWidth: 1,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      easing: 'easeOutSine',
      startTaper: 0,
      startCap: true,
      startEasing: 'linear',
      endTaper: 0,
      endCap: true,
      endEasing: 'linear',
    }),
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

function asFillStyle(
  value: unknown,
  fallback: ExcalidrawHighlighterPresetBlock['fillStyle'],
): ExcalidrawHighlighterPresetBlock['fillStyle'] {
  if (value === 'hachure' || value === 'solid' || value === 'cross-hatch' || value === 'zigzag' || value === 'dashed' || value === 'dots') {
    return value
  }
  return fallback
}

function makePresetId(rawLabel: string, index: number, seen: Map<string, number>): string {
  const slug = rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const base = slug || `custom-pen-${index + 1}`
  const count = seen.get(base) ?? 0
  seen.set(base, count + 1)
  return count === 0 ? base : `${base}-${count + 1}`
}

function toDisplayLabel(rawType: unknown, index: number): string {
  if (typeof rawType !== 'string' || rawType.trim() === '') return `Pen ${index + 1}`
  const normalized = rawType.replace(/[-_]+/g, ' ').trim().toLowerCase()
  return normalized.replace(/\b\w/g, c => c.toUpperCase())
}

function resolveStrokeOptionsFromObsidianPen(
  penOptions: Record<string, unknown>,
): ExcalidrawPenStrokeOptionsBlock {
  const options = isRecord(penOptions.options) ? penOptions.options : {}
  const start = isRecord(options.start) ? options.start : {}
  const end = isRecord(options.end) ? options.end : {}
  const highlighter = asBoolean(penOptions.highlighter, false)
  return {
    highlighter,
    constantPressure: asBoolean(penOptions.constantPressure, highlighter),
    hasOutline: asBoolean(penOptions.hasOutline, highlighter),
    outlineWidth: asNumber(penOptions.outlineWidth, highlighter ? 4 : 1),
    options: {
      thinning: asNumber(options.thinning, highlighter ? 1 : 0.6),
      smoothing: asNumber(options.smoothing, 0.5),
      streamline: asNumber(options.streamline, 0.5),
      easing: asString(options.easing, highlighter ? 'linear' : 'easeOutSine'),
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

function buildPresetFromSeed(seed: ObsidianCustomPenSeed, index: number, seen: Map<string, number>): ExcalidrawHighlighterPresetBlock {
  const label = toDisplayLabel(seed.penType, index)
  return {
    id: makePresetId(seed.penType, index, seen),
    label,
    penType: seed.penType,
    freedrawOnly: seed.freedrawOnly,
    strokeColor: seed.strokeColor,
    backgroundColor: seed.backgroundColor,
    fillStyle: seed.fillStyle,
    strokeWidth: seed.strokeWidth,
    roughness: seed.roughness,
    opacity: seed.opacity,
    strokeOptions: seed.strokeOptions,
  }
}

function buildDefaultPresetSet(): readonly ExcalidrawHighlighterPresetBlock[] {
  const seen = new Map<string, number>()
  return OBSIDIAN_DEFAULT_CUSTOM_PENS_SEED.map((seed, index) => buildPresetFromSeed(seed, index, seen))
}

export const EXCALIDRAW_HIGHLIGHTER_PRESETS_BLOCK: readonly ExcalidrawHighlighterPresetBlock[] = buildDefaultPresetSet()

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
  if (!appState) return null

  const strokeColor = normalizeColor(appState.currentItemStrokeColor)
  const backgroundColor = normalizeColor(appState.currentItemBackgroundColor)
  const fillStyle = typeof appState.currentItemFillStyle === 'string' ? appState.currentItemFillStyle : 'solid'
  const strokeWidth = asNumber(appState.currentItemStrokeWidth, Number.NaN)
  const roughness = asNumber(appState.currentItemRoughness, 0)
  const currentOptions = readCurrentStrokeOptions(appState)
  const currentHighlighter = currentOptions.highlighter === true

  for (const preset of presets) {
    const presetStroke = normalizeColor(preset.strokeColor)
    const presetBackground = normalizeColor(preset.backgroundColor)
    if (strokeColor !== presetStroke) continue
    if (backgroundColor !== presetBackground) continue
    if (fillStyle !== preset.fillStyle) continue
    // strokeWidth 0 means "keep current" — skip width check for those presets
    if (preset.strokeWidth > 0 && Number.isFinite(strokeWidth) && Math.abs(strokeWidth - preset.strokeWidth) > 0.22) continue
    if (Math.abs(roughness - preset.roughness) > 0.4) continue
    if (currentHighlighter !== preset.strokeOptions.highlighter) continue
    // Note: opacity is intentionally NOT compared — Obsidian pens don't control opacity
    return preset.id
  }

  return 'custom'
}

export function buildExcalidrawHighlighterAppStatePatchBlock(
  preset: ExcalidrawHighlighterPresetBlock,
  currentAppState?: Record<string, unknown>,
): Record<string, unknown> {
  const activeToolBase = getActiveToolBase(currentAppState)

  // Match Obsidian's setPen() behavior exactly:
  // - currentStrokeOptions: always set
  // - strokeWidth: only override when > 0 (0 means "keep current")
  // - backgroundColor: only override when truthy (not empty/transparent)
  // - strokeColor: only override when truthy
  // - fillStyle: only override when not empty
  // - roughness: only override when falsy (0 or null → set to 0; truthy → keep current)
  // - opacity: NEVER changed by pen switching (left as-is)
  const patch: Record<string, unknown> = {
    activeTool: {
      ...activeToolBase,
      type: 'freedraw',
      customType: null,
      locked: false,
      fromSelection: false,
    },
    currentStrokeOptions: {
      ...preset.strokeOptions,
      options: {
        ...preset.strokeOptions.options,
        start: { ...preset.strokeOptions.options.start },
        end: { ...preset.strokeOptions.options.end },
      },
    },
  }

  // strokeWidth: only set when non-zero
  if (preset.strokeWidth && preset.strokeWidth !== 0) {
    patch.currentItemStrokeWidth = preset.strokeWidth
  }

  // backgroundColor: only set when truthy (not empty/transparent)
  if (preset.backgroundColor && preset.backgroundColor !== 'transparent') {
    patch.currentItemBackgroundColor = preset.backgroundColor
  }

  // strokeColor: only set when truthy
  if (preset.strokeColor) {
    patch.currentItemStrokeColor = preset.strokeColor
  }

  // fillStyle: only set when truthy
  if (preset.fillStyle) {
    patch.currentItemFillStyle = preset.fillStyle
  }

  // roughness: only set when falsy (0 or null means set to 0; truthy values like 3 are kept as-is)
  if (!preset.roughness) {
    patch.currentItemRoughness = 0
  }

  // Save current state for freedrawOnly pens so it can be restored when switching away
  if (preset.freedrawOnly && currentAppState && !currentAppState.resetCustomPen) {
    patch.resetCustomPen = {
      currentItemStrokeWidth: currentAppState.currentItemStrokeWidth,
      currentItemBackgroundColor: currentAppState.currentItemBackgroundColor,
      currentItemStrokeColor: currentAppState.currentItemStrokeColor,
      currentItemFillStyle: currentAppState.currentItemFillStyle,
      currentItemRoughness: currentAppState.currentItemRoughness,
    }
  }

  return patch
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

    const penType = asString(item.type, `pen-${index + 1}`)
    const penOptions = isRecord(item.penOptions) ? item.penOptions : {}
    const parsedOptions = resolveStrokeOptionsFromObsidianPen(penOptions)
    const isHighlighter = parsedOptions.highlighter

    const label = toDisplayLabel(item.type, index)
    const id = makePresetId(penType, index, seenIds)

    presets.push({
      id,
      label,
      penType,
      freedrawOnly: asBoolean(item.freedrawOnly, false),
      strokeColor: asString(item.strokeColor, isHighlighter ? '#ffffff' : '#000000'),
      backgroundColor: asString(item.backgroundColor, isHighlighter ? '#fff9db' : 'transparent'),
      fillStyle: asFillStyle(item.fillStyle, isHighlighter ? 'solid' : 'hachure'),
      strokeWidth: Math.max(asNumber(item.strokeWidth, isHighlighter ? 2.6 : 0), 0),
      roughness: Math.max(asNumber(item.roughness, 0), 0),
      opacity: Math.min(Math.max(Math.round(asNumber(item.opacity, 100)), 1), 100),
      strokeOptions: parsedOptions,
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
