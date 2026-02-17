import type { HierarchyDbStatus } from './typesBlock'
import { getStoredVaultRoot } from './storageKeyBlock'

function getElectronVaultRootBlock(): string {
  const vaultRoot = getStoredVaultRoot()
  if (!vaultRoot) throw new Error('Vault root not configured')
  return vaultRoot
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>
  let detail = 'Request failed'
  try {
    const payload = await res.json()
    if (payload?.detail) detail = String(payload.detail)
  } catch {
    // ignore json parse issues and keep fallback
  }
  throw new Error(detail)
}

export async function getHierarchyDbStatusBlock(): Promise<HierarchyDbStatus> {
  if (window.electronAPI?.isElectron) {
    if (!window.electronAPI.hierarchyDbStatus) {
      throw new Error('Hierarchy DB status IPC is unavailable in this build')
    }
    return window.electronAPI.hierarchyDbStatus(getElectronVaultRootBlock())
  }

  const res = await fetch('/api/hierarchy/status')
  return parseJsonOrThrow<HierarchyDbStatus>(res)
}

export async function initHierarchyDbBlock(): Promise<HierarchyDbStatus> {
  if (window.electronAPI?.isElectron) {
    if (!window.electronAPI.initHierarchyDb) {
      throw new Error('Hierarchy DB init IPC is unavailable in this build')
    }
    return window.electronAPI.initHierarchyDb(getElectronVaultRootBlock())
  }

  const res = await fetch('/api/hierarchy/init', { method: 'POST' })
  return parseJsonOrThrow<HierarchyDbStatus>(res)
}
