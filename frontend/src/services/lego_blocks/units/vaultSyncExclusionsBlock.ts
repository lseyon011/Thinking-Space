// Vault sync exclusion registry — vault-relative path prefixes that the
// indexer (walk + parse + IndexedDB cache) should skip. Files at excluded
// prefixes still live on disk and remain accessible across devices, but
// they don't get indexed, parsed, or trigger sync churn.
//
// Primary use case: high-frequency app-data writes (e.g. Webull tick/quote
// snapshots) where the data belongs in the vault for cross-device access
// but has no business being a first-class hierarchy node.

import { getJsonStorageItem, setJsonStorageItem, STORAGE_KEYS } from './storageKeyBlock'

type Listener = (prefixes: string[]) => void

const listeners = new Set<Listener>()

function normalizePrefix(value: string): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .trim()
  return trimmed.length > 0 ? trimmed : null
}

function readRaw(): string[] {
  const raw = getJsonStorageItem<unknown>(STORAGE_KEYS.vaultSyncExcludedPrefixes, [])
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    const normalized = normalizePrefix(typeof entry === 'string' ? entry : '')
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

function writeRaw(prefixes: string[]): void {
  setJsonStorageItem(STORAGE_KEYS.vaultSyncExcludedPrefixes, prefixes)
  for (const listener of listeners) {
    try { listener(prefixes) } catch { /* ignore */ }
  }
}

export function getSyncExcludedPathPrefixes(): string[] {
  return readRaw()
}

export function setSyncExcludedPathPrefixes(prefixes: string[]): string[] {
  const normalized: string[] = []
  const seen = new Set<string>()
  for (const prefix of prefixes) {
    const value = normalizePrefix(prefix)
    if (!value || seen.has(value)) continue
    seen.add(value)
    normalized.push(value)
  }
  writeRaw(normalized)
  return normalized
}

/** Returns the normalized prefix that was added, or null if no change. */
export function addSyncExcludedPathPrefix(prefix: string): string | null {
  const normalized = normalizePrefix(prefix)
  if (!normalized) return null
  const current = readRaw()
  if (current.includes(normalized)) return null
  current.push(normalized)
  writeRaw(current)
  return normalized
}

/** Returns true if a prefix was removed. */
export function removeSyncExcludedPathPrefix(prefix: string): boolean {
  const normalized = normalizePrefix(prefix)
  if (!normalized) return false
  const current = readRaw()
  const next = current.filter(p => p !== normalized)
  if (next.length === current.length) return false
  writeRaw(next)
  return true
}

export function isPathSyncExcluded(path: string, prefixes?: string[]): boolean {
  const list = prefixes ?? readRaw()
  if (list.length === 0) return false
  const normalized = normalizePrefix(path)
  if (!normalized) return false
  for (const prefix of list) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) return true
  }
  return false
}

export function subscribeSyncExcludedPathPrefixes(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
