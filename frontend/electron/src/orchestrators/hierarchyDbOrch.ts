import {
  getHierarchyDbStatusBlock,
  initHierarchyDbBlock,
  type HierarchyDbStatusBlock,
} from '../lego_blocks/hierarchyDbBlock'

export function initializeHierarchyDbOrch(vaultRoot: string): HierarchyDbStatusBlock {
  return initHierarchyDbBlock(vaultRoot)
}

export function getHierarchyDbStatusOrch(vaultRoot: string): HierarchyDbStatusBlock {
  return getHierarchyDbStatusBlock(vaultRoot)
}
