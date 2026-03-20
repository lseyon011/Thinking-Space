// Shared constants mirroring the Python backend's vault conventions.
import excludedDirsList from '../../../../electron/src/config/vaultExcludedDirs.json'

export const EXCLUDED_DIRS = new Set(excludedDirsList)

// Directories whose children are the meaningful "section" level
export const NESTED_ROOTS = new Set([
  'acceleration_core', 'lifeblood_systems', 'operations',
])

export const DATE_FILENAME_RE = /^\d{4}-\d{2}-\d{2}\.md$/

/**
 * Extract the meaningful section name from a vault-relative path.
 *
 * For nested roots (acceleration_core, lifeblood_systems, operations),
 * uses the 2nd path segment (e.g. Webull, sfdl, sfw).
 * For everything else, uses the 1st segment.
 * Root-level files go into "Other".
 */
export function extractSection(relPath: string): string {
  const parts = relPath.split('/')
  if (parts.length < 2) return 'Other'
  if (NESTED_ROOTS.has(parts[0]) && parts.length >= 2) return parts[1]
  return parts[0]
}
