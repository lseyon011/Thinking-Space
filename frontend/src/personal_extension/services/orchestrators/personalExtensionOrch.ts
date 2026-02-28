import { isCapacitorNative, isElectron } from '@/services/orchestrators/runtimeOrch'
import {
  addPersonalExtensionNoteToWorkspaceBlock,
  clearPersonalExtensionWorkspaceBlock,
  loadPersonalExtensionWorkspaceBlock,
  type PersonalExtensionRuntimeSurfaceBlock,
  type PersonalExtensionWorkspaceSnapshotBlock,
} from '../lego_blocks/integrations/personalExtensionNotesBlock'

export type PersonalExtensionRuntimeSurfaceOrch = PersonalExtensionRuntimeSurfaceBlock
export type PersonalExtensionWorkspaceSnapshotOrch = PersonalExtensionWorkspaceSnapshotBlock

export function getPersonalExtensionRuntimeSurfaceOrch(): PersonalExtensionRuntimeSurfaceOrch {
  if (isElectron()) return 'electron'
  if (isCapacitorNative()) return 'capacitor'
  return 'web'
}

export function loadPersonalExtensionWorkspaceOrch(): PersonalExtensionWorkspaceSnapshotOrch {
  return loadPersonalExtensionWorkspaceBlock(getPersonalExtensionRuntimeSurfaceOrch())
}

export function createPersonalExtensionNoteOrch(text: string): PersonalExtensionWorkspaceSnapshotOrch {
  return addPersonalExtensionNoteToWorkspaceBlock(text, getPersonalExtensionRuntimeSurfaceOrch())
}

export function clearPersonalExtensionWorkspaceOrch(): PersonalExtensionWorkspaceSnapshotOrch {
  return clearPersonalExtensionWorkspaceBlock(getPersonalExtensionRuntimeSurfaceOrch())
}
