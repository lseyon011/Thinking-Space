import {
  clearNativeAiOauthCredentialsBlock,
  createNativeAiOauthTransferCodeBlock,
  importNativeAiOauthTransferCodeBlock,
  readNativeAiOauthCredentialsBlock,
  type NativeAiOauthCredentials,
} from '@/services/lego_blocks/integrations/aiOauthCredentialStoreBlock'
import {
  getClaudeCredentialsBlock,
  getCodexCredentialsBlock,
} from '@/services/lego_blocks/integrations/aiProviderBlock'
import { isElectron } from './runtimeOrch'

export interface ImportedAiLoginState {
  hasClaudeOauth: boolean
  hasCodexOauth: boolean
}

export function getImportedAiLoginStateOrch(): ImportedAiLoginState {
  const creds = readNativeAiOauthCredentialsBlock()
  return {
    hasClaudeOauth: !!creds.claude,
    hasCodexOauth: !!creds.openaiCodex,
  }
}

export async function generateDesktopAiLoginTransferCodeOrch(): Promise<string> {
  if (!isElectron()) {
    throw new Error('Desktop transfer code can only be generated from Electron runtime')
  }
  const [claude, codex] = await Promise.all([
    getClaudeCredentialsBlock(),
    getCodexCredentialsBlock(),
  ])
  const credentials: NativeAiOauthCredentials = {
    ...(claude ? {
      claude: {
        accessToken: claude.accessToken,
        refreshToken: claude.refreshToken,
        expiresAt: claude.expiresAt,
      },
    } : {}),
    ...(codex ? {
      openaiCodex: {
        accessToken: codex.accessToken,
        refreshToken: codex.refreshToken,
        expiresAt: codex.expiresAt,
        ...(codex.accountId ? { accountId: codex.accountId } : {}),
      },
    } : {}),
  }
  return createNativeAiOauthTransferCodeBlock(credentials)
}

export function importAiLoginTransferCodeOrch(
  transferCode: string,
): ImportedAiLoginState {
  importNativeAiOauthTransferCodeBlock(transferCode)
  return getImportedAiLoginStateOrch()
}

export function clearImportedAiLoginsOrch(): ImportedAiLoginState {
  clearNativeAiOauthCredentialsBlock()
  return getImportedAiLoginStateOrch()
}
