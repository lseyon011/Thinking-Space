export const PENCIL_METRICS_EVENT_BLOCK = 'pencilMetrics'
export const PENCIL_DOUBLE_TAP_EVENT_BLOCK = 'pencilDoubleTap'

export type NativePencilPhaseBlock = 'began' | 'moved' | 'ended' | 'cancelled'
export type PencilPreferredActionBlock = 'switchPrevious' | 'switchEraser' | 'showColorPalette' | 'ignore' | 'unknown'

export interface NativePencilMetricsEventBlock {
  phase: NativePencilPhaseBlock
  timestamp: number
  force: number | null
  maxForce: number | null
  normalizedPressure: number | null
  altitudeAngle: number | null
  azimuthAngle: number | null
  locationX: number | null
  locationY: number | null
}

export interface NativePencilDoubleTapEventBlock {
  timestamp: number
  preferredAction: PencilPreferredActionBlock
}

export interface PencilPressureStateBlock {
  smoothedPressure: number
}

export interface PencilStrokeStyleBlock {
  currentItemStrokeWidth: number
  currentItemOpacity: number
}

export interface PencilPressureMappingConfigBlock {
  minStrokeWidth: number
  maxStrokeWidth: number
  minOpacity: number
  maxOpacity: number
  smoothingFactor: number
}

export interface PencilPressureMappingResultBlock {
  state: PencilPressureStateBlock | null
  style: PencilStrokeStyleBlock | null
}

const DEFAULT_PRESSURE_CONFIG: PencilPressureMappingConfigBlock = {
  minStrokeWidth: 1,
  maxStrokeWidth: 6,
  minOpacity: 35,
  maxOpacity: 100,
  smoothingFactor: 0.24,
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function resolvePhase(value: unknown): NativePencilPhaseBlock | null {
  if (value === 'began' || value === 'moved' || value === 'ended' || value === 'cancelled') {
    return value
  }
  return null
}

function resolvePreferredAction(value: unknown): PencilPreferredActionBlock {
  if (value === 'switchPrevious') return 'switchPrevious'
  if (value === 'switchEraser') return 'switchEraser'
  if (value === 'showColorPalette') return 'showColorPalette'
  if (value === 'ignore') return 'ignore'
  return 'unknown'
}

export function normalizeNativePencilMetricsEventBlock(raw: unknown): NativePencilMetricsEventBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Record<string, unknown>
  const phase = resolvePhase(candidate.phase)
  if (!phase) return null

  const force = numberOrNull(candidate.force)
  const maxForce = numberOrNull(candidate.maxForce)
  const normalizedPressureRaw = numberOrNull(candidate.normalizedPressure)
  const normalizedPressure = normalizedPressureRaw === null ? null : clamp(normalizedPressureRaw, 0, 1)

  return {
    phase,
    timestamp: numberOrNull(candidate.timestamp) ?? Date.now(),
    force,
    maxForce,
    normalizedPressure,
    altitudeAngle: numberOrNull(candidate.altitudeAngle),
    azimuthAngle: numberOrNull(candidate.azimuthAngle),
    locationX: numberOrNull(candidate.locationX),
    locationY: numberOrNull(candidate.locationY),
  }
}

export function normalizeNativePencilDoubleTapEventBlock(raw: unknown): NativePencilDoubleTapEventBlock {
  if (!raw || typeof raw !== 'object') {
    return {
      timestamp: Date.now(),
      preferredAction: 'unknown',
    }
  }
  const candidate = raw as Record<string, unknown>
  return {
    timestamp: numberOrNull(candidate.timestamp) ?? Date.now(),
    preferredAction: resolvePreferredAction(candidate.preferredAction),
  }
}

export function nextPencilToolTypeBlock(currentToolType: string | null | undefined): 'freedraw' | 'eraser' {
  return currentToolType === 'eraser' ? 'freedraw' : 'eraser'
}

function resolvePressure(event: NativePencilMetricsEventBlock): number | null {
  if (typeof event.normalizedPressure === 'number') {
    return clamp(event.normalizedPressure, 0, 1)
  }

  if (
    typeof event.force === 'number'
    && typeof event.maxForce === 'number'
    && event.maxForce > 0
  ) {
    return clamp(event.force / event.maxForce, 0, 1)
  }

  return null
}

export function mapPencilPressureToStrokeStyleBlock(
  event: NativePencilMetricsEventBlock,
  previousState: PencilPressureStateBlock | null,
  config: Partial<PencilPressureMappingConfigBlock> = {},
): PencilPressureMappingResultBlock {
  const effective: PencilPressureMappingConfigBlock = {
    ...DEFAULT_PRESSURE_CONFIG,
    ...config,
  }

  if (event.phase === 'ended' || event.phase === 'cancelled') {
    return {
      state: null,
      style: null,
    }
  }

  const pressure = resolvePressure(event)
  if (pressure === null) {
    return {
      state: previousState,
      style: null,
    }
  }

  const base = previousState?.smoothedPressure ?? pressure
  const smoothing = clamp(effective.smoothingFactor, 0, 1)
  const smoothed = clamp(base + (pressure - base) * smoothing, 0, 1)

  const width = round(
    effective.minStrokeWidth + (effective.maxStrokeWidth - effective.minStrokeWidth) * smoothed,
    2,
  )
  const opacity = Math.round(
    effective.minOpacity + (effective.maxOpacity - effective.minOpacity) * smoothed,
  )

  return {
    state: { smoothedPressure: smoothed },
    style: {
      currentItemStrokeWidth: width,
      currentItemOpacity: clamp(opacity, 0, 100),
    },
  }
}

export function shouldEnableNativePencilBridgeBlock(runtime: {
  isCapacitorNative: boolean
  platform: string
}): boolean {
  return runtime.isCapacitorNative && runtime.platform === 'ios'
}
