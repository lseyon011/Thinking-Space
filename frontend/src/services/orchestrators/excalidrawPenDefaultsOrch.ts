import {
  buildExcalidrawPenDefaultsAppStatePatchBlock,
  getDefaultExcalidrawPenDefaultsBlock,
  normalizeExcalidrawPenDefaultsBlock,
  readExcalidrawPenDefaultsBlock,
  writeExcalidrawPenDefaultsBlock,
  readExcalidrawActivePresetIdBlock,
  writeExcalidrawActivePresetIdBlock,
  type ExcalidrawPenDefaultsBlock,
} from '@/services/lego_blocks/units/excalidrawPenDefaultsBlock'

export type ExcalidrawPenDefaultsOrch = ExcalidrawPenDefaultsBlock

export function getDefaultExcalidrawPenDefaultsOrch(): ExcalidrawPenDefaultsOrch {
  return getDefaultExcalidrawPenDefaultsBlock()
}

export function normalizeExcalidrawPenDefaultsOrch(input: unknown): ExcalidrawPenDefaultsOrch {
  return normalizeExcalidrawPenDefaultsBlock(input)
}

export function readExcalidrawPenDefaultsOrch(storage?: Storage | null): ExcalidrawPenDefaultsOrch {
  return readExcalidrawPenDefaultsBlock(storage)
}

export function writeExcalidrawPenDefaultsOrch(defaults: ExcalidrawPenDefaultsOrch, storage?: Storage | null): void {
  writeExcalidrawPenDefaultsBlock(defaults, storage)
}

export function buildExcalidrawPenDefaultsAppStatePatchOrch(
  defaults: ExcalidrawPenDefaultsOrch,
  currentAppState?: Record<string, unknown>,
): Record<string, unknown> {
  return buildExcalidrawPenDefaultsAppStatePatchBlock(defaults, currentAppState)
}

export function readExcalidrawActivePresetIdOrch(storage?: Storage | null): string | null {
  return readExcalidrawActivePresetIdBlock(storage)
}

export function writeExcalidrawActivePresetIdOrch(presetId: string, storage?: Storage | null): void {
  writeExcalidrawActivePresetIdBlock(presetId, storage)
}
