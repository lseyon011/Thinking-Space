import {
  clearExtensionRegistryBlock,
  getExtensionRegistryRecordBlock,
  listExtensionRegistryBlock,
  replaceExtensionRegistryBlock,
  upsertExtensionRegistryRecordBlock,
  type ExtensionRegistryReason,
  type ExtensionRuntimeRecord,
} from '../lego_blocks/extensionRegistryBlock'
import { getVaultFS, type VaultFS } from '../lego_blocks/fsBlock'
import { parseExtensionActionsFromManifestBlock } from '../lego_blocks/extensionActionBlock'
import {
  resolveExtensionManifestCompatibilityOrch,
  validateExtensionManifestOrch,
  type ExtensionHostCompatibilityInput,
} from './extensionHostOrch'

const DEFAULT_EXTENSIONS_ROOT = '.extensions'
const DEFAULT_DEACTIVATED_MESSAGE = 'Extension deactivated by user.'

export interface ExtensionDiscoverInput extends ExtensionHostCompatibilityInput {
  fs?: VaultFS
  extensionsRoot?: string
}

export interface ExtensionReloadInput extends ExtensionDiscoverInput {
  registryKey: string
}

export async function discoverExtensionsOrch(input: ExtensionDiscoverInput): Promise<ExtensionRuntimeRecord[]> {
  const fs = input.fs ?? getVaultFS()
  const extensionsRoot = normalizePath(input.extensionsRoot ?? DEFAULT_EXTENSIONS_ROOT)
  const currentRecords = new Map(listExtensionRegistryBlock().map(record => [record.registryKey, record]))
  const folders = await listExtensionFolders(fs, extensionsRoot)
  const next: ExtensionRuntimeRecord[] = []

  for (const folder of folders) {
    const loaded = await loadExtensionFolder({
      fs,
      folder,
      extensionsRoot,
      appVersion: input.appVersion,
      supportedApiVersions: input.supportedApiVersions,
    })

    const existing = currentRecords.get(loaded.registryKey)
    if (
      existing &&
      existing.status === 'inactive' &&
      existing.reason?.code === 'EXTENSION_DEACTIVATED' &&
      loaded.loadable
    ) {
      next.push({
        ...loaded,
        status: 'inactive',
        reason: existing.reason,
      })
      continue
    }

    next.push(loaded)
  }

  return replaceExtensionRegistryBlock(next)
}

export async function reloadExtensionsOrch(input: ExtensionDiscoverInput): Promise<ExtensionRuntimeRecord[]> {
  return discoverExtensionsOrch(input)
}

export async function reloadExtensionOrch(input: ExtensionReloadInput): Promise<ExtensionRuntimeRecord> {
  const fs = input.fs ?? getVaultFS()
  const extensionsRoot = normalizePath(input.extensionsRoot ?? DEFAULT_EXTENSIONS_ROOT)
  const loaded = await loadExtensionFolder({
    fs,
    folder: input.registryKey,
    extensionsRoot,
    appVersion: input.appVersion,
    supportedApiVersions: input.supportedApiVersions,
  })
  return upsertExtensionRegistryRecordBlock(loaded)
}

export function listRegisteredExtensionsOrch(): ExtensionRuntimeRecord[] {
  return listExtensionRegistryBlock()
}

export function clearExtensionRegistryOrch(): void {
  clearExtensionRegistryBlock()
}

export function deactivateExtensionOrch(
  registryKey: string,
  reasonMessage: string = DEFAULT_DEACTIVATED_MESSAGE,
): ExtensionRuntimeRecord {
  const existing = getExtensionRegistryRecordBlock(registryKey)
  if (!existing) {
    throw new Error(`Extension "${registryKey}" is not registered.`)
  }
  return upsertExtensionRegistryRecordBlock({
    ...existing,
    status: 'inactive',
    reason: {
      code: 'EXTENSION_DEACTIVATED',
      message: reasonMessage.trim() || DEFAULT_DEACTIVATED_MESSAGE,
    },
  })
}

export function activateExtensionOrch(registryKey: string): ExtensionRuntimeRecord {
  const existing = getExtensionRegistryRecordBlock(registryKey)
  if (!existing) {
    throw new Error(`Extension "${registryKey}" is not registered.`)
  }
  if (!existing.loadable) {
    const reason = existing.reason?.message ?? 'Extension is not loadable.'
    throw new Error(reason)
  }
  return upsertExtensionRegistryRecordBlock({
    ...existing,
    status: 'active',
    reason: null,
  })
}

interface LoadExtensionFolderInput extends ExtensionHostCompatibilityInput {
  fs: VaultFS
  folder: string
  extensionsRoot: string
}

async function loadExtensionFolder(input: LoadExtensionFolderInput): Promise<ExtensionRuntimeRecord> {
  const folder = normalizePath(input.folder)
  const manifestPath = joinPath(input.extensionsRoot, folder, 'manifest.json')
  const discoveredAt = new Date().toISOString()

  if (!folder) {
    return buildRecord({
      registryKey: folder,
      folder,
      manifestPath,
      status: 'invalid',
      loadable: false,
      extensionId: null,
      manifest: null,
      actions: [],
      reason: {
        code: 'MANIFEST_MISSING',
        message: 'Extension folder name is empty.',
      },
      discoveredAt,
    })
  }

  const manifestExists = await pathExists(input.fs, manifestPath)
  if (!manifestExists) {
    return buildRecord({
      registryKey: folder,
      folder,
      manifestPath,
      status: 'invalid',
      loadable: false,
      extensionId: null,
      manifest: null,
      actions: [],
      reason: {
        code: 'MANIFEST_MISSING',
        message: `Missing manifest.json for extension folder "${folder}".`,
      },
      discoveredAt,
    })
  }

  let manifestRawText = ''
  try {
    manifestRawText = await input.fs.read(manifestPath)
  } catch (error) {
    return buildRecord({
      registryKey: folder,
      folder,
      manifestPath,
      status: 'invalid',
      loadable: false,
      extensionId: null,
      manifest: null,
      actions: [],
      reason: {
        code: 'MANIFEST_READ_FAILED',
        message: error instanceof Error ? error.message : String(error),
      },
      discoveredAt,
    })
  }

  let manifestJson: unknown
  try {
    manifestJson = JSON.parse(manifestRawText)
  } catch {
    return buildRecord({
      registryKey: folder,
      folder,
      manifestPath,
      status: 'invalid',
      loadable: false,
      extensionId: null,
      manifest: null,
      actions: [],
      reason: {
        code: 'MANIFEST_JSON_INVALID',
        message: `Manifest JSON is invalid for extension folder "${folder}".`,
      },
      discoveredAt,
    })
  }

  const parsed = validateExtensionManifestOrch(manifestJson)
  if (!parsed.ok) {
    return buildRecord({
      registryKey: folder,
      folder,
      manifestPath,
      status: 'invalid',
      loadable: false,
      extensionId: null,
      manifest: null,
      actions: [],
      reason: {
        code: 'MANIFEST_VALIDATION_FAILED',
        message: `${parsed.error.field}: ${parsed.error.message}`,
      },
      discoveredAt,
    })
  }

  const parsedActions = parseExtensionActionsFromManifestBlock(manifestJson)
  if (!parsedActions.ok) {
    return buildRecord({
      registryKey: folder,
      folder,
      manifestPath,
      status: 'invalid',
      loadable: false,
      extensionId: parsed.manifest.id,
      manifest: parsed.manifest,
      actions: [],
      reason: {
        code: 'ACTIONS_VALIDATION_FAILED',
        message: `${parsedActions.error.field}: ${parsedActions.error.message}`,
      },
      discoveredAt,
    })
  }

  const compatibility = resolveExtensionManifestCompatibilityOrch(parsed.manifest, {
    appVersion: input.appVersion,
    supportedApiVersions: input.supportedApiVersions,
  })
  if (!compatibility.loadable) {
    return buildRecord({
      registryKey: folder,
      folder,
      manifestPath,
      status: 'inactive',
      loadable: false,
      extensionId: parsed.manifest.id,
      manifest: parsed.manifest,
      actions: parsedActions.actions,
      reason: {
        code: 'MANIFEST_INCOMPATIBLE',
        message: compatibility.reason?.message ?? 'Extension manifest is incompatible.',
      },
      discoveredAt,
    })
  }

  return buildRecord({
    registryKey: folder,
    folder,
    manifestPath,
    status: 'active',
    loadable: true,
    extensionId: parsed.manifest.id,
    manifest: parsed.manifest,
    actions: parsedActions.actions,
    reason: null,
    discoveredAt,
  })
}

function buildRecord(params: {
  registryKey: string
  folder: string
  manifestPath: string
  extensionId: string | null
  status: ExtensionRuntimeRecord['status']
  loadable: boolean
  manifest: ExtensionRuntimeRecord['manifest']
  actions: ExtensionRuntimeRecord['actions']
  reason: ExtensionRegistryReason | null
  discoveredAt: string
}): ExtensionRuntimeRecord {
  return {
    registryKey: params.registryKey,
    folder: params.folder,
    manifestPath: params.manifestPath,
    extensionId: params.extensionId,
    status: params.status,
    loadable: params.loadable,
    manifest: params.manifest,
    actions: params.actions,
    reason: params.reason,
    discoveredAt: params.discoveredAt,
    updatedAt: params.discoveredAt,
  }
}

async function listExtensionFolders(fs: VaultFS, extensionsRoot: string): Promise<string[]> {
  try {
    const listed = await fs.list(extensionsRoot)
    return listed.folders
      .filter(folder => !folder.startsWith('.'))
      .map(folder => folder.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

async function pathExists(fs: VaultFS, path: string): Promise<boolean> {
  try {
    return await fs.exists(path)
  } catch {
    return false
  }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function joinPath(...parts: string[]): string {
  return parts.map(normalizePath).filter(Boolean).join('/')
}
