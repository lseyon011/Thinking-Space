import {
  getDefaultF9ExecutionSettingsBlock,
  readF9ExecutionSettingsBlock,
  writeF9ExecutionSettingsBlock,
  type F9ExecutionSettingsBlock,
} from '../lego_blocks/units/f9ExecutionSettingsBlock'

export type { F9ExecutionSettingsBlock }

export function getDefaultF9ExecutionSettingsOrch(): F9ExecutionSettingsBlock {
  return getDefaultF9ExecutionSettingsBlock()
}

export function readF9ExecutionSettingsOrch(): F9ExecutionSettingsBlock {
  return readF9ExecutionSettingsBlock()
}

export function writeF9ExecutionSettingsOrch(
  settings: F9ExecutionSettingsBlock,
): F9ExecutionSettingsBlock {
  return writeF9ExecutionSettingsBlock(settings)
}

