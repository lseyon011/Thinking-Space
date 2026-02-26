import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { isCapacitorNative } from '@/services/lego_blocks/integrations/fsBlock'
import {
  PENCIL_DOUBLE_TAP_EVENT_BLOCK,
  PENCIL_METRICS_EVENT_BLOCK,
  mapPencilPressureToStrokeStyleBlock,
  nextPencilToolTypeBlock,
  normalizeNativePencilDoubleTapEventBlock,
  normalizeNativePencilMetricsEventBlock,
  shouldEnableNativePencilBridgeBlock,
  type NativePencilDoubleTapEventBlock,
  type NativePencilMetricsEventBlock,
  type PencilPressureMappingConfigBlock,
  type PencilPressureMappingResultBlock,
  type PencilPressureStateBlock,
} from '@/services/lego_blocks/units/pencilBridgeBlock'

interface PencilEventsPluginDef {
  start(): Promise<{ monitoring: boolean }>
  stop(): Promise<{ monitoring: boolean }>
  addListener(
    eventName: typeof PENCIL_METRICS_EVENT_BLOCK,
    listenerFunc: (event: unknown) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    eventName: typeof PENCIL_DOUBLE_TAP_EVENT_BLOCK,
    listenerFunc: (event: unknown) => void,
  ): Promise<PluginListenerHandle>
  removeAllListeners(): Promise<void>
}

const PencilEvents = registerPlugin<PencilEventsPluginDef>('PencilEvents')

export type NativePencilMetricsEventOrch = NativePencilMetricsEventBlock
export type NativePencilDoubleTapEventOrch = NativePencilDoubleTapEventBlock
export type PencilPressureStateOrch = PencilPressureStateBlock

export interface NativePencilBridgeSubscriptionOrch {
  stop(): Promise<void>
}

export interface NativePencilBridgeHandlersOrch {
  onMetrics?: (event: NativePencilMetricsEventOrch) => void
  onDoubleTap?: (event: NativePencilDoubleTapEventOrch) => void
}

function getPencilRuntimeState() {
  const native = isCapacitorNative()
  if (!native) {
    return {
      isCapacitorNative: false,
      platform: 'web',
    }
  }
  try {
    return {
      isCapacitorNative: true,
      platform: Capacitor.getPlatform(),
    }
  } catch {
    return {
      isCapacitorNative: true,
      platform: 'unknown',
    }
  }
}

export function isNativePencilBridgeSupportedOrch(): boolean {
  return shouldEnableNativePencilBridgeBlock(getPencilRuntimeState())
}

export function mapPencilPressureToStrokeStyleOrch(
  event: NativePencilMetricsEventOrch,
  previousState: PencilPressureStateOrch | null,
  config?: Partial<PencilPressureMappingConfigBlock>,
): PencilPressureMappingResultBlock {
  return mapPencilPressureToStrokeStyleBlock(event, previousState, config)
}

export function nextPencilToolTypeOrch(currentToolType: string | null | undefined): 'freedraw' | 'eraser' {
  return nextPencilToolTypeBlock(currentToolType)
}

export async function subscribeNativePencilBridgeOrch(
  handlers: NativePencilBridgeHandlersOrch,
): Promise<NativePencilBridgeSubscriptionOrch | null> {
  if (!isNativePencilBridgeSupportedOrch()) {
    return null
  }

  const listenerHandles: PluginListenerHandle[] = []
  const metricsListener = await PencilEvents.addListener(PENCIL_METRICS_EVENT_BLOCK, (event) => {
    const normalized = normalizeNativePencilMetricsEventBlock(event)
    if (!normalized) return
    handlers.onMetrics?.(normalized)
  })
  listenerHandles.push(metricsListener)

  const doubleTapListener = await PencilEvents.addListener(PENCIL_DOUBLE_TAP_EVENT_BLOCK, (event) => {
    handlers.onDoubleTap?.(normalizeNativePencilDoubleTapEventBlock(event))
  })
  listenerHandles.push(doubleTapListener)

  try {
    await PencilEvents.start()
  } catch (error) {
    await Promise.all(listenerHandles.map(async (handle) => {
      await handle.remove().catch(() => {})
    }))
    throw error
  }

  let stopped = false
  return {
    stop: async () => {
      if (stopped) return
      stopped = true
      await Promise.all(listenerHandles.map(async (handle) => {
        await handle.remove().catch(() => {})
      }))
      await PencilEvents.stop().catch(() => {})
      await PencilEvents.removeAllListeners().catch(() => {})
    },
  }
}
