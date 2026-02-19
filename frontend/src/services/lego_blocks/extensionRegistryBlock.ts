import type { ExtensionManifest } from './extensionManifestBlock'

export type ExtensionLifecycleStatus = 'active' | 'inactive' | 'invalid'

export type ExtensionRegistryReasonCode =
  | 'MANIFEST_MISSING'
  | 'MANIFEST_READ_FAILED'
  | 'MANIFEST_JSON_INVALID'
  | 'MANIFEST_VALIDATION_FAILED'
  | 'MANIFEST_INCOMPATIBLE'
  | 'EXTENSION_DEACTIVATED'
  | 'EXTENSION_NOT_FOUND'
  | 'EXTENSION_NOT_LOADABLE'

export interface ExtensionRegistryReason {
  code: ExtensionRegistryReasonCode
  message: string
}

export interface ExtensionRuntimeRecord {
  registryKey: string
  folder: string
  manifestPath: string
  extensionId: string | null
  status: ExtensionLifecycleStatus
  loadable: boolean
  manifest: ExtensionManifest | null
  reason: ExtensionRegistryReason | null
  discoveredAt: string
  updatedAt: string
}

const extensionRegistry = new Map<string, ExtensionRuntimeRecord>()

export function clearExtensionRegistryBlock(): void {
  extensionRegistry.clear()
}

export function replaceExtensionRegistryBlock(records: ExtensionRuntimeRecord[]): ExtensionRuntimeRecord[] {
  extensionRegistry.clear()
  for (const record of records) {
    extensionRegistry.set(record.registryKey, { ...record })
  }
  return listExtensionRegistryBlock()
}

export function upsertExtensionRegistryRecordBlock(record: ExtensionRuntimeRecord): ExtensionRuntimeRecord {
  const normalized = { ...record, updatedAt: new Date().toISOString() }
  extensionRegistry.set(record.registryKey, normalized)
  return normalized
}

export function getExtensionRegistryRecordBlock(registryKey: string): ExtensionRuntimeRecord | null {
  const record = extensionRegistry.get(registryKey)
  return record ? { ...record } : null
}

export function listExtensionRegistryBlock(): ExtensionRuntimeRecord[] {
  return [...extensionRegistry.values()]
    .map(record => ({ ...record }))
    .sort((a, b) => a.registryKey.localeCompare(b.registryKey))
}

export function removeExtensionRegistryRecordBlock(registryKey: string): boolean {
  return extensionRegistry.delete(registryKey)
}

