import type { HierarchyDbStatus } from '../lego_blocks/typesBlock'
import {
  getHierarchyDbStatusBlock,
  initHierarchyDbBlock,
} from '../lego_blocks/hierarchyDbBlock'

export async function getHierarchyDbStatus(): Promise<HierarchyDbStatus> {
  return getHierarchyDbStatusBlock()
}

export async function initHierarchyDb(): Promise<HierarchyDbStatus> {
  return initHierarchyDbBlock()
}
