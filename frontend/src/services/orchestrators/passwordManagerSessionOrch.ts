import {
  loadPasswordVaultBlock,
  savePasswordVaultBlock,
  type LoadedPasswordVaultBlock,
  type PasswordVaultDataBlock,
} from '@/services/lego_blocks/integrations/passwordVaultBlock'

export interface PasswordVaultSessionSnapshotOrch {
  unlocked: boolean
  vaultState: LoadedPasswordVaultBlock | null
}

export const PASSWORD_VAULT_SESSION_EVENT_ORCH = 'ltm-password-vault-session'

let passwordVaultSessionPassphraseOrch: string | null = null
let passwordVaultSessionStateOrch: LoadedPasswordVaultBlock | null = null

function dispatchPasswordVaultSessionBlock(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<PasswordVaultSessionSnapshotOrch>(
    PASSWORD_VAULT_SESSION_EVENT_ORCH,
    { detail: getPasswordVaultSessionSnapshotOrch() },
  ))
}

function setPasswordVaultSessionStateBlock(
  nextState: LoadedPasswordVaultBlock | null,
  nextPassphrase: string | null,
): void {
  passwordVaultSessionStateOrch = nextState
  passwordVaultSessionPassphraseOrch = nextPassphrase
  dispatchPasswordVaultSessionBlock()
}

function requireUnlockedPasswordVaultSessionBlock(): {
  passphrase: string
  vaultState: LoadedPasswordVaultBlock
} {
  if (!passwordVaultSessionPassphraseOrch || !passwordVaultSessionStateOrch) {
    throw new Error('Password vault is locked.')
  }
  return {
    passphrase: passwordVaultSessionPassphraseOrch,
    vaultState: passwordVaultSessionStateOrch,
  }
}

export function getPasswordVaultSessionSnapshotOrch(): PasswordVaultSessionSnapshotOrch {
  return {
    unlocked: !!passwordVaultSessionStateOrch && !!passwordVaultSessionPassphraseOrch,
    vaultState: passwordVaultSessionStateOrch,
  }
}

export function subscribePasswordVaultSessionOrch(
  listener: (snapshot: PasswordVaultSessionSnapshotOrch) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<PasswordVaultSessionSnapshotOrch>).detail
    listener(detail ?? getPasswordVaultSessionSnapshotOrch())
  }
  window.addEventListener(PASSWORD_VAULT_SESSION_EVENT_ORCH, handler)
  return () => {
    window.removeEventListener(PASSWORD_VAULT_SESSION_EVENT_ORCH, handler)
  }
}

export async function unlockPasswordVaultSessionOrch(passphrase: string): Promise<LoadedPasswordVaultBlock> {
  const normalizedPassphrase = passphrase.trim()
  if (!normalizedPassphrase) {
    throw new Error('Passphrase is required.')
  }
  const loaded = await loadPasswordVaultBlock({ passphrase: normalizedPassphrase })
  setPasswordVaultSessionStateBlock(loaded, normalizedPassphrase)
  return loaded
}

export function lockPasswordVaultSessionOrch(): void {
  setPasswordVaultSessionStateBlock(null, null)
}

export async function reloadPasswordVaultSessionOrch(): Promise<LoadedPasswordVaultBlock> {
  const { passphrase } = requireUnlockedPasswordVaultSessionBlock()
  const loaded = await loadPasswordVaultBlock({ passphrase })
  setPasswordVaultSessionStateBlock(loaded, passphrase)
  return loaded
}

export async function savePasswordVaultSessionVaultOrch(
  vault: PasswordVaultDataBlock,
): Promise<LoadedPasswordVaultBlock> {
  const { passphrase, vaultState } = requireUnlockedPasswordVaultSessionBlock()
  const saved = await savePasswordVaultBlock({
    passphrase,
    vault,
    expectedMtime: vaultState.sourceMtime,
  })
  const nextState: LoadedPasswordVaultBlock = {
    ...saved,
    exists: true,
  }
  setPasswordVaultSessionStateBlock(nextState, passphrase)
  return nextState
}
