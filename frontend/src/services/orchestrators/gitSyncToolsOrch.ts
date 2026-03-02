import {
  STORAGE_KEYS,
  getJsonStorageItem,
  getStoredVaultRoot,
  setJsonStorageItem,
} from '@/services/orchestrators/storageOrch'
import { isElectron } from '@/services/orchestrators/runtimeOrch'

interface GitSyncStatusEntryOrch {
  lastCommitAt: number | null
  lastPushAt: number | null
}

type GitSyncStatusMapOrch = Record<string, GitSyncStatusEntryOrch>

export interface GitCommitResultOrch {
  committed: boolean
  finishedAt: number
  message: string
  commitHash?: string
}

export interface GitPushResultOrch {
  finishedAt: number
  message: string
}

const DEFAULT_GIT_SYNC_STATUS_ENTRY_ORCH: GitSyncStatusEntryOrch = {
  lastCommitAt: null,
  lastPushAt: null,
}

const UNSUPPORTED_ROOT_MARKERS_ORCH = new Set([
  'web-backend',
  'browser-fs',
])

function normalizeVaultRootOrch(vaultRoot: string | null | undefined): string {
  if (typeof vaultRoot !== 'string') return ''
  return vaultRoot.trim()
}

function hasGitBridgeOrch(): boolean {
  return typeof window !== 'undefined' && typeof window.electronAPI?.git === 'function'
}

function readGitSyncStatusMapOrch(): GitSyncStatusMapOrch {
  const raw = getJsonStorageItem<GitSyncStatusMapOrch>(
    STORAGE_KEYS.gitSyncActionsByVault,
    {},
  )
  if (!raw || typeof raw !== 'object') return {}
  const normalized: GitSyncStatusMapOrch = {}
  for (const [vaultRoot, entry] of Object.entries(raw)) {
    const normalizedRoot = normalizeVaultRootOrch(vaultRoot)
    if (!normalizedRoot || !entry || typeof entry !== 'object') continue
    const lastCommitAt = typeof entry.lastCommitAt === 'number' && Number.isFinite(entry.lastCommitAt)
      ? entry.lastCommitAt
      : null
    const lastPushAt = typeof entry.lastPushAt === 'number' && Number.isFinite(entry.lastPushAt)
      ? entry.lastPushAt
      : null
    normalized[normalizedRoot] = { lastCommitAt, lastPushAt }
  }
  return normalized
}

function writeGitSyncStatusMapOrch(statusMap: GitSyncStatusMapOrch): void {
  setJsonStorageItem(STORAGE_KEYS.gitSyncActionsByVault, statusMap)
}

function resolveGitVaultRootOrch(vaultRoot?: string | null): string {
  const root = normalizeVaultRootOrch(vaultRoot ?? getStoredVaultRoot())
  if (!root) {
    throw new Error('Vault root is not configured.')
  }
  if (UNSUPPORTED_ROOT_MARKERS_ORCH.has(root) || root.startsWith('cap-picker:')) {
    throw new Error('Git actions require a local desktop vault.')
  }
  return root
}

async function runGitOrch(vaultRoot: string, args: string[]): Promise<string> {
  if (!hasGitBridgeOrch()) {
    throw new Error('Git actions are only available in desktop runtime.')
  }
  return window.electronAPI!.git(vaultRoot, args)
}

function patchGitSyncStatusEntryOrch(
  vaultRoot: string,
  patch: Partial<GitSyncStatusEntryOrch>,
): GitSyncStatusEntryOrch {
  const statusMap = readGitSyncStatusMapOrch()
  const current = statusMap[vaultRoot] ?? DEFAULT_GIT_SYNC_STATUS_ENTRY_ORCH
  const next: GitSyncStatusEntryOrch = {
    lastCommitAt: patch.lastCommitAt ?? current.lastCommitAt,
    lastPushAt: patch.lastPushAt ?? current.lastPushAt,
  }
  statusMap[vaultRoot] = next
  writeGitSyncStatusMapOrch(statusMap)
  return next
}

export function isGitSyncToolsSupportedOrch(): boolean {
  return isElectron() && hasGitBridgeOrch()
}

export function readGitSyncStatusOrch(vaultRoot?: string | null): GitSyncStatusEntryOrch {
  const root = normalizeVaultRootOrch(vaultRoot ?? getStoredVaultRoot())
  if (!root) return { ...DEFAULT_GIT_SYNC_STATUS_ENTRY_ORCH }
  const entry = readGitSyncStatusMapOrch()[root]
  if (!entry) return { ...DEFAULT_GIT_SYNC_STATUS_ENTRY_ORCH }
  return entry
}

export async function gitCommitAllOrch(
  commitMessage: string,
  vaultRoot?: string | null,
): Promise<GitCommitResultOrch> {
  const trimmedMessage = commitMessage.trim()
  if (!trimmedMessage) {
    throw new Error('Commit message cannot be empty.')
  }

  const root = resolveGitVaultRootOrch(vaultRoot)
  await runGitOrch(root, ['rev-parse', '--is-inside-work-tree'])

  const pending = await runGitOrch(root, ['status', '--porcelain'])
  if (!pending.trim()) {
    return {
      committed: false,
      finishedAt: Date.now(),
      message: 'No changes to commit.',
    }
  }

  await runGitOrch(root, ['add', '-A'])
  await runGitOrch(root, ['commit', '-m', trimmedMessage])
  const commitHash = (await runGitOrch(root, ['rev-parse', '--short', 'HEAD'])).trim()
  const finishedAt = Date.now()

  patchGitSyncStatusEntryOrch(root, { lastCommitAt: finishedAt })

  return {
    committed: true,
    finishedAt,
    commitHash: commitHash || undefined,
    message: commitHash ? `Committed ${commitHash}.` : 'Commit completed.',
  }
}

export async function gitPushOrch(vaultRoot?: string | null): Promise<GitPushResultOrch> {
  const root = resolveGitVaultRootOrch(vaultRoot)
  await runGitOrch(root, ['rev-parse', '--is-inside-work-tree'])
  await runGitOrch(root, ['push'])
  const finishedAt = Date.now()

  patchGitSyncStatusEntryOrch(root, { lastPushAt: finishedAt })

  return {
    finishedAt,
    message: 'Push completed.',
  }
}
