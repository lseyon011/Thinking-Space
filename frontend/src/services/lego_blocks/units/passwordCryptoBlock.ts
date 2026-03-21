import {
  base64ToBytesBlock,
  bytesToBase64Block,
  bytesToUtf8Block,
  utf8ToBytesBlock,
} from '@/services/lego_blocks/units/byteEncodingBlock'

export interface PasswordVaultCiphertextBlock {
  version: 1
  algorithm: 'AES-GCM'
  keyDerivation: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    saltBase64: string
  }
  ivBase64: string
  ciphertextBase64: string
}

const PASSWORD_VAULT_SALT_BYTES = 16
const PASSWORD_VAULT_IV_BYTES = 12
const PASSWORD_VAULT_PBKDF2_ITERATIONS = 250_000

function getWebCryptoBlock(): Crypto {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto
  }
  throw new Error('Web Crypto API is unavailable in this runtime.')
}

function normalizePassphraseBlock(passphrase: string): string {
  const normalized = passphrase.trim()
  if (!normalized) throw new Error('Passphrase is required.')
  return normalized
}

function randomBytesBlock(length: number): Uint8Array {
  const out = new Uint8Array(length)
  getWebCryptoBlock().getRandomValues(out)
  return out
}

function toArrayBufferBlock(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function deriveEncryptionKeyBlock(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const subtle = getWebCryptoBlock().subtle
  const passphraseKey = await subtle.importKey(
    'raw',
    toArrayBufferBlock(utf8ToBytesBlock(normalizePassphraseBlock(passphrase))),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBufferBlock(salt),
      iterations,
      hash: 'SHA-256',
    },
    passphraseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  )
}

function parseCiphertextBlock(raw: unknown): PasswordVaultCiphertextBlock {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Password vault file is invalid.')
  }
  const record = raw as Record<string, unknown>
  const keyDerivation = record.keyDerivation
  if (!keyDerivation || typeof keyDerivation !== 'object') {
    throw new Error('Password vault file is invalid.')
  }
  const keyDerivationRecord = keyDerivation as Record<string, unknown>
  if (
    record.version !== 1
    || record.algorithm !== 'AES-GCM'
    || keyDerivationRecord.name !== 'PBKDF2'
    || keyDerivationRecord.hash !== 'SHA-256'
    || typeof keyDerivationRecord.iterations !== 'number'
    || !Number.isFinite(keyDerivationRecord.iterations)
    || keyDerivationRecord.iterations <= 0
    || typeof keyDerivationRecord.saltBase64 !== 'string'
    || typeof record.ivBase64 !== 'string'
    || typeof record.ciphertextBase64 !== 'string'
  ) {
    throw new Error('Password vault file is invalid.')
  }

  return {
    version: 1,
    algorithm: 'AES-GCM',
    keyDerivation: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: Math.floor(keyDerivationRecord.iterations),
      saltBase64: keyDerivationRecord.saltBase64,
    },
    ivBase64: record.ivBase64,
    ciphertextBase64: record.ciphertextBase64,
  }
}

export async function encryptPasswordVaultPayloadBlock(
  payloadText: string,
  passphrase: string,
  options?: {
    iterations?: number
  },
): Promise<PasswordVaultCiphertextBlock> {
  const normalizedPassphrase = normalizePassphraseBlock(passphrase)
  const iterations = Math.max(1, Math.floor(options?.iterations ?? PASSWORD_VAULT_PBKDF2_ITERATIONS))
  const salt = randomBytesBlock(PASSWORD_VAULT_SALT_BYTES)
  const iv = randomBytesBlock(PASSWORD_VAULT_IV_BYTES)
  const subtle = getWebCryptoBlock().subtle
  const key = await deriveEncryptionKeyBlock(normalizedPassphrase, salt, iterations)
  const ciphertext = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBufferBlock(iv),
    },
    key,
    toArrayBufferBlock(utf8ToBytesBlock(payloadText)),
  )

  return {
    version: 1,
    algorithm: 'AES-GCM',
    keyDerivation: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      saltBase64: bytesToBase64Block(salt),
    },
    ivBase64: bytesToBase64Block(iv),
    ciphertextBase64: bytesToBase64Block(new Uint8Array(ciphertext)),
  }
}

export async function decryptPasswordVaultPayloadBlock(
  raw: unknown,
  passphrase: string,
): Promise<string> {
  const normalizedPassphrase = normalizePassphraseBlock(passphrase)
  const record = parseCiphertextBlock(raw)
  const subtle = getWebCryptoBlock().subtle
  const salt = base64ToBytesBlock(record.keyDerivation.saltBase64)
  const iv = base64ToBytesBlock(record.ivBase64)
  const ciphertext = base64ToBytesBlock(record.ciphertextBase64)
  const key = await deriveEncryptionKeyBlock(
    normalizedPassphrase,
    salt,
    record.keyDerivation.iterations,
  )

  try {
    const decrypted = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBufferBlock(iv),
      },
      key,
      toArrayBufferBlock(ciphertext),
    )
    return bytesToUtf8Block(new Uint8Array(decrypted))
  } catch {
    throw new Error('Incorrect passphrase or corrupted password vault.')
  }
}
