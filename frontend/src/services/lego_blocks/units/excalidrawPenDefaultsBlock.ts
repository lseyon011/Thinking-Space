export interface ExcalidrawPenDefaultsBlock {
  strokeColor: string
  strokeWidth: number
  opacity: number
  pressureSensitive: boolean
}

const STORAGE_KEY = 'ltm.excalidraw.pen.defaults.v1'

const DEFAULT_PEN_DEFAULTS: ExcalidrawPenDefaultsBlock = {
  strokeColor: '#1f2937',
  strokeWidth: 2,
  opacity: 100,
  pressureSensitive: true,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeStrokeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const raw = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const n = raw.toLowerCase()
    return `#${n[1]}${n[1]}${n[2]}${n[2]}${n[3]}${n[3]}`
  }
  return fallback
}

function normalizeStrokeWidth(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.round(value), 1), 24)
}

function normalizeOpacity(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.round(value), 1), 100)
}

function resolveStorage(storage?: Storage | null): Storage | null {
  if (storage !== undefined) return storage
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function getDefaultExcalidrawPenDefaultsBlock(): ExcalidrawPenDefaultsBlock {
  return { ...DEFAULT_PEN_DEFAULTS }
}

export function normalizeExcalidrawPenDefaultsBlock(input: unknown): ExcalidrawPenDefaultsBlock {
  const source = isRecord(input) ? input : {}
  return {
    strokeColor: normalizeStrokeColor(source.strokeColor, DEFAULT_PEN_DEFAULTS.strokeColor),
    strokeWidth: normalizeStrokeWidth(source.strokeWidth, DEFAULT_PEN_DEFAULTS.strokeWidth),
    opacity: normalizeOpacity(source.opacity, DEFAULT_PEN_DEFAULTS.opacity),
    pressureSensitive: typeof source.pressureSensitive === 'boolean'
      ? source.pressureSensitive
      : DEFAULT_PEN_DEFAULTS.pressureSensitive,
  }
}

export function readExcalidrawPenDefaultsBlock(storage?: Storage | null): ExcalidrawPenDefaultsBlock {
  const target = resolveStorage(storage)
  if (!target) return getDefaultExcalidrawPenDefaultsBlock()
  try {
    const raw = target.getItem(STORAGE_KEY)
    if (!raw) return getDefaultExcalidrawPenDefaultsBlock()
    return normalizeExcalidrawPenDefaultsBlock(JSON.parse(raw))
  } catch {
    return getDefaultExcalidrawPenDefaultsBlock()
  }
}

export function writeExcalidrawPenDefaultsBlock(
  defaults: ExcalidrawPenDefaultsBlock,
  storage?: Storage | null,
): void {
  const target = resolveStorage(storage)
  if (!target) return
  try {
    const normalized = normalizeExcalidrawPenDefaultsBlock(defaults)
    target.setItem(STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // Ignore storage failures in restricted runtimes.
  }
}

const ACTIVE_PRESET_STORAGE_KEY = 'ltm.excalidraw.pen.activePreset.v1'

export function readExcalidrawActivePresetIdBlock(storage?: Storage | null): string | null {
  const target = resolveStorage(storage)
  if (!target) return null
  try {
    return target.getItem(ACTIVE_PRESET_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

export function writeExcalidrawActivePresetIdBlock(presetId: string, storage?: Storage | null): void {
  const target = resolveStorage(storage)
  if (!target) return
  try {
    target.setItem(ACTIVE_PRESET_STORAGE_KEY, presetId)
  } catch {
    // Ignore storage failures in restricted runtimes.
  }
}

export function buildExcalidrawPenDefaultsAppStatePatchBlock(
  defaults: ExcalidrawPenDefaultsBlock,
  currentAppState?: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = normalizeExcalidrawPenDefaultsBlock(defaults)
  const currentStrokeOptions = isRecord(currentAppState?.currentStrokeOptions)
    ? currentAppState.currentStrokeOptions
    : {}
  return {
    currentItemStrokeColor: normalized.strokeColor,
    currentItemStrokeWidth: normalized.strokeWidth,
    currentItemOpacity: normalized.opacity,
    currentStrokeOptions: {
      ...currentStrokeOptions,
      constantPressure: !normalized.pressureSensitive,
    },
  }
}
