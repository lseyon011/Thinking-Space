import { getVaultFS } from '../lego_blocks/fsBlock'
import { hierarchyToExcalidrawMd } from '../lego_blocks/hierarchyExcalidrawBlock'
import { THINKING_ORGANIZER_DIR } from '../lego_blocks/projectStorageBlock'
import { generateKey } from '../lego_blocks/yamlNoteBlock'
import type { NodeRecord } from '../lego_blocks/dbBlock'

export { THINKING_ORGANIZER_DIR }

export function generateNodeKeyOrch(value: string): string {
  return generateKey(value)
}

export function getVaultFsOrch() {
  return getVaultFS()
}

export function hierarchyToExcalidrawMdOrch(nodes: NodeRecord[]): string {
  return hierarchyToExcalidrawMd(nodes)
}
