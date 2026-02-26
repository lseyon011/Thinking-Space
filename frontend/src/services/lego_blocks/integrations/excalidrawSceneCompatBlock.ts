import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import type { ParsedExcalidrawScene } from '@/services/lego_blocks/integrations/excalidrawFileBlock'

type JsonRecord = Record<string, unknown>

const DEFAULT_GRID_COLOR = {
  Bold: 'rgba(217, 217, 217, 0.5)',
  Regular: 'rgba(230, 230, 230, 0.5)',
}

const DEFAULT_FRAME_RENDERING = {
  enabled: true,
  clip: true,
  name: true,
  outline: true,
  markerName: true,
  markerEnabled: true,
}

const DEFAULT_ACTIVE_TOOL = {
  type: 'selection',
  customType: null,
  locked: false,
  fromSelection: false,
  lastActiveTool: null,
}

const DEFAULT_STROKE_OPTIONS = {
  highlighter: false,
  constantPressure: true,
  hasOutline: false,
  outlineWidth: 4,
  options: {
    thinning: 0.6,
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

const DEFAULT_APP_STATE: JsonRecord = {
  theme: 'light',
  viewBackgroundColor: '#ffffff',
  currentItemStrokeColor: '#1f2937',
  currentItemBackgroundColor: 'transparent',
  currentItemFillStyle: 'solid',
  currentItemStrokeWidth: 2,
  currentItemStrokeStyle: 'solid',
  currentItemRoughness: 0,
  currentItemOpacity: 100,
  currentItemFontFamily: 2,
  currentItemFontSize: 20,
  currentItemTextAlign: 'left',
  currentItemStartArrowhead: null,
  currentItemEndArrowhead: 'arrow',
  currentItemArrowType: 'round',
  currentItemFrameRole: null,
  scrollX: 0,
  scrollY: 0,
  zoom: { value: 1 },
  currentItemRoundness: 'round',
  gridSize: 20,
  gridStep: 5,
  gridModeEnabled: false,
  gridColor: DEFAULT_GRID_COLOR,
  currentStrokeOptions: DEFAULT_STROKE_OPTIONS,
  frameRendering: DEFAULT_FRAME_RENDERING,
  objectsSnapModeEnabled: false,
  activeTool: DEFAULT_ACTIVE_TOOL,
  disableContextMenu: false,
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isValidFractionalIndex(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  try {
    // fractional-indexing validates full order-key shape internally.
    // If this throws, the key is not safe to pass through to Excalidraw.
    generateKeyBetween(value, null)
    return true
  } catch {
    return false
  }
}

function hashNumber(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash || 1
}

function normalizeZoom(value: unknown): { value: number } {
  if (isRecord(value)) {
    return { value: asNumber(value.value, 1) }
  }
  return { value: asNumber(value, 1) }
}

export function normalizeExcalidrawAppStateForInteropBlock(
  appState?: Record<string, unknown>,
): Record<string, unknown> {
  const candidate = isRecord(appState) ? appState : {}
  const normalized: Record<string, unknown> = {
    ...DEFAULT_APP_STATE,
    ...candidate,
    zoom: normalizeZoom(candidate.zoom),
    gridColor: isRecord(candidate.gridColor) ? { ...DEFAULT_GRID_COLOR, ...candidate.gridColor } : DEFAULT_GRID_COLOR,
    frameRendering: isRecord(candidate.frameRendering)
      ? { ...DEFAULT_FRAME_RENDERING, ...candidate.frameRendering }
      : DEFAULT_FRAME_RENDERING,
    activeTool: isRecord(candidate.activeTool)
      ? { ...DEFAULT_ACTIVE_TOOL, ...candidate.activeTool }
      : DEFAULT_ACTIVE_TOOL,
    currentStrokeOptions: isRecord(candidate.currentStrokeOptions)
      ? { ...DEFAULT_STROKE_OPTIONS, ...candidate.currentStrokeOptions }
      : DEFAULT_STROKE_OPTIONS,
  }
  return normalized
}

export function normalizeExcalidrawElementForInteropBlock(
  element: unknown,
  position: number,
  validIndex?: string,
): unknown {
  if (!isRecord(element)) return element

  const candidate = element
  const elementType = typeof candidate.type === 'string' ? candidate.type : 'rectangle'
  const id = typeof candidate.id === 'string' ? candidate.id : `element_${position}`
  const width = asNumber(candidate.width, 0)
  const height = asNumber(candidate.height, 0)

  // Use provided validIndex, or keep existing index if it's a valid fractional index.
  // Fall back to generating a fresh index from position.
  const existingIndex = isValidFractionalIndex(candidate.index) ? candidate.index : null
  const index = existingIndex
    ?? validIndex
    ?? generateNKeysBetween(null, null, position + 1)[position]

  const normalized: JsonRecord = {
    ...candidate,
    id,
    type: elementType,
    x: asNumber(candidate.x, 0),
    y: asNumber(candidate.y, 0),
    width,
    height,
    angle: asNumber(candidate.angle, 0),
    strokeColor: typeof candidate.strokeColor === 'string' ? candidate.strokeColor : '#1f2937',
    backgroundColor: typeof candidate.backgroundColor === 'string' ? candidate.backgroundColor : 'transparent',
    fillStyle: typeof candidate.fillStyle === 'string' ? candidate.fillStyle : 'solid',
    strokeWidth: asNumber(candidate.strokeWidth, 1),
    strokeStyle: typeof candidate.strokeStyle === 'string' ? candidate.strokeStyle : 'solid',
    roughness: candidate.roughness ?? 0,
    opacity: asNumber(candidate.opacity, 100),
    groupIds: Array.isArray(candidate.groupIds) ? candidate.groupIds : [],
    frameId: candidate.frameId ?? null,
    index,
    roundness: candidate.roundness ?? null,
    seed: asNumber(candidate.seed, hashNumber(`seed:${id}`)),
    version: asNumber(candidate.version, 1),
    versionNonce: asNumber(candidate.versionNonce, hashNumber(`nonce:${id}`)),
    isDeleted: candidate.isDeleted === true,
    boundElements: candidate.boundElements ?? null,
    updated: asNumber(candidate.updated, 1),
    link: candidate.link ?? null,
    locked: candidate.locked === true,
  }

  if (elementType === 'text') {
    const textValue = typeof candidate.text === 'string' ? candidate.text : ''
    const fontSize = asNumber(candidate.fontSize, 20)

    normalized.text = textValue
    normalized.fontSize = fontSize
    normalized.fontFamily = asNumber(candidate.fontFamily, 2)
    normalized.textAlign = typeof candidate.textAlign === 'string' ? candidate.textAlign : 'left'
    normalized.verticalAlign = typeof candidate.verticalAlign === 'string' ? candidate.verticalAlign : 'middle'
    normalized.lineHeight = asNumber(candidate.lineHeight, 1.25)
    normalized.baseline = asNumber(candidate.baseline, Math.round(fontSize * 0.8))
    normalized.containerId = candidate.containerId ?? null
    normalized.originalText = typeof candidate.originalText === 'string' ? candidate.originalText : textValue
    normalized.autoResize = candidate.autoResize === true
  }

  if (elementType === 'arrow') {
    const points = Array.isArray(candidate.points) ? candidate.points : [[0, 0], [width, height]]
    normalized.points = points
    normalized.startBinding = candidate.startBinding ?? null
    normalized.endBinding = candidate.endBinding ?? null
    normalized.startArrowhead = candidate.startArrowhead ?? null
    normalized.endArrowhead = candidate.endArrowhead ?? 'arrow'
    normalized.elbowed = candidate.elbowed === true
    normalized.lastCommittedPoint = candidate.lastCommittedPoint ?? null
  }

  if (elementType === 'freedraw') {
    normalized.points = Array.isArray(candidate.points) ? candidate.points : []
    normalized.pressures = Array.isArray(candidate.pressures) ? candidate.pressures : []
    normalized.simulatePressure = candidate.simulatePressure !== false
    normalized.lastCommittedPoint = candidate.lastCommittedPoint ?? null
    normalized.customData = isRecord(candidate.customData) ? candidate.customData : {}
  }

  return normalized
}

export function normalizeExcalidrawSceneForInteropBlock(
  scene: ParsedExcalidrawScene,
): ParsedExcalidrawScene {
  const elements = scene.elements ?? []
  // Pre-generate valid fractional indices for all elements.
  // generateNKeysBetween(null, null, n) produces n evenly-spaced keys in valid order.
  const validIndices = elements.length > 0
    ? generateNKeysBetween(null, null, elements.length)
    : []
  return {
    elements: elements.map((element, index) =>
      normalizeExcalidrawElementForInteropBlock(element, index, validIndices[index]),
    ),
    appState: normalizeExcalidrawAppStateForInteropBlock(scene.appState),
    files: scene.files ?? {},
  }
}
