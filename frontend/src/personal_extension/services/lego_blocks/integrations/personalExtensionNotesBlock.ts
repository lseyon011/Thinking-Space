import {
  appendPersonalExtensionNoteBlock,
  clearPersonalExtensionNotesBlock,
  listPersonalExtensionNotesBlock,
  type PersonalExtensionNoteBlock,
} from '../units/personalExtensionStoreBlock'

export type PersonalExtensionRuntimeSurfaceBlock = 'electron' | 'capacitor' | 'web'

export interface PersonalExtensionWorkspaceSnapshotBlock {
  runtime: PersonalExtensionRuntimeSurfaceBlock
  notes: PersonalExtensionNoteBlock[]
}

export function loadPersonalExtensionWorkspaceBlock(
  runtime: PersonalExtensionRuntimeSurfaceBlock,
): PersonalExtensionWorkspaceSnapshotBlock {
  return {
    runtime,
    notes: listPersonalExtensionNotesBlock(),
  }
}

export function addPersonalExtensionNoteToWorkspaceBlock(
  text: string,
  runtime: PersonalExtensionRuntimeSurfaceBlock,
): PersonalExtensionWorkspaceSnapshotBlock {
  appendPersonalExtensionNoteBlock(text)
  return loadPersonalExtensionWorkspaceBlock(runtime)
}

export function clearPersonalExtensionWorkspaceBlock(
  runtime: PersonalExtensionRuntimeSurfaceBlock,
): PersonalExtensionWorkspaceSnapshotBlock {
  clearPersonalExtensionNotesBlock()
  return loadPersonalExtensionWorkspaceBlock(runtime)
}
