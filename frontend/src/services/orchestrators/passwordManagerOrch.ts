import {
  createEmptyPasswordVaultBlock,
  createPasswordVaultEntryIdBlock,
  getPasswordVaultFilePathBlock,
  loadPasswordVaultBlock,
  savePasswordVaultBlock,
  type LoadedPasswordVaultBlock,
  type PasswordVaultDataBlock,
  type PasswordVaultEntryBlock,
  type SavedPasswordVaultBlock,
} from '@/services/lego_blocks/integrations/passwordVaultBlock'

export {
  createEmptyPasswordVaultBlock as createEmptyPasswordVaultOrch,
  createPasswordVaultEntryIdBlock as createPasswordVaultEntryIdOrch,
  getPasswordVaultFilePathBlock as getPasswordVaultFilePathOrch,
  loadPasswordVaultBlock as loadPasswordVaultOrch,
  savePasswordVaultBlock as savePasswordVaultOrch,
}

export type {
  LoadedPasswordVaultBlock,
  PasswordVaultDataBlock,
  PasswordVaultEntryBlock,
  SavedPasswordVaultBlock,
}
