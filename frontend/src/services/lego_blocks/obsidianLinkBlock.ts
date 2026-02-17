import { getStoredVaultRoot } from './storageKeyBlock'

function normalizeVaultRoot(vaultRoot: string): string {
  return vaultRoot.replace(/\\/g, '/').replace(/\/+$/, '')
}

function inferVaultNameFromRoot(vaultRoot: string): string | null {
  const normalized = normalizeVaultRoot(vaultRoot)
  const parts = normalized.split('/').filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : null
}

function getConfiguredVaultName(): string | null {
  const vaultRoot = getStoredVaultRoot()
  if (!vaultRoot) return null
  return inferVaultNameFromRoot(vaultRoot)
}

function toObsidianFileTarget(path: string): string {
  return path.toLowerCase().endsWith('.md') ? path.slice(0, -3) : path
}

export function isExcalidrawFile(path: string): boolean {
  const lower = path.toLowerCase()
  return lower.endsWith('.excalidraw') || lower.endsWith('.excalidraw.md')
}

export function buildObsidianOpenUrl(path: string): string {
  const vaultName = getConfiguredVaultName() ?? 'Long Term Memory iCloud'
  const fileTarget = toObsidianFileTarget(path)
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(fileTarget)}`
}

export function openFileInObsidian(path: string): void {
  window.location.href = buildObsidianOpenUrl(path)
}
