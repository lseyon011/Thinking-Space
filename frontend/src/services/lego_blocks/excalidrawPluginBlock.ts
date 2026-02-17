import type { ExcalidrawPluginStatus } from './typesBlock'

function getElectronPluginApi() {
  if (!window.electronAPI?.isElectron) {
    throw new Error('Excalidraw plugin management is available only on desktop Electron')
  }
  if (!window.electronAPI.excalidrawPluginStatus || !window.electronAPI.installLatestExcalidrawPlugin) {
    throw new Error('Excalidraw plugin IPC is unavailable in this build')
  }
  return window.electronAPI
}

export async function getExcalidrawPluginStatusBlock(vaultRoot: string): Promise<ExcalidrawPluginStatus> {
  return getElectronPluginApi().excalidrawPluginStatus(vaultRoot)
}

export async function installLatestExcalidrawPluginBlock(vaultRoot: string): Promise<ExcalidrawPluginStatus> {
  return getElectronPluginApi().installLatestExcalidrawPlugin(vaultRoot)
}
