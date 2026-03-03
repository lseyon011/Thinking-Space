import { getStoredVaultRoot } from '@/services/orchestrators/storageOrch'

const GOOGLE_DRIVE_ROOT_HINTS_BLOCK = [
  /google\s*drive/i,
  /googledrive/i,
  /cloudstorage[\\/]+googledrive/i,
]

export function isGoogleDriveVaultOrch(vaultRoot?: string | null): boolean {
  const raw = (vaultRoot ?? getStoredVaultRoot() ?? '').trim()
  if (!raw) return false
  return GOOGLE_DRIVE_ROOT_HINTS_BLOCK.some((pattern) => pattern.test(raw))
}
