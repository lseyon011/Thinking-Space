import { webcrypto } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  decryptPasswordVaultPayloadBlock,
  encryptPasswordVaultPayloadBlock,
} from '@/services/lego_blocks/units/passwordCryptoBlock'

describe('passwordCryptoBlock', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    })
  })

  it('encrypts and decrypts password vault payloads', async () => {
    const encrypted = await encryptPasswordVaultPayloadBlock('{"hello":"world"}', 'correct horse battery staple')
    expect(encrypted.algorithm).toBe('AES-GCM')
    expect(encrypted.keyDerivation.name).toBe('PBKDF2')

    const decrypted = await decryptPasswordVaultPayloadBlock(encrypted, 'correct horse battery staple')
    expect(decrypted).toBe('{"hello":"world"}')
  })

  it('rejects invalid passphrases', async () => {
    const encrypted = await encryptPasswordVaultPayloadBlock('sensitive', 'vault-passphrase')
    await expect(decryptPasswordVaultPayloadBlock(encrypted, 'wrong-passphrase')).rejects.toThrow(
      'Incorrect passphrase or corrupted password vault.',
    )
  })
})
