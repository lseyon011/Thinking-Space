import { registerPlugin } from '@capacitor/core'

export interface FolderPickerPluginBlockDef {
  pickFolder(): Promise<{ url: string; accessing: boolean }>
  restoreBookmark(): Promise<{ url: string; accessing: boolean }>
}

export const folderPickerPluginBlock = registerPlugin<FolderPickerPluginBlockDef>('FolderPicker')
