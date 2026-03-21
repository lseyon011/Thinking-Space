import { webcrypto } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { VaultFS } from '@/services/lego_blocks/integrations/fsBlock'
import {
  createEmptyPasswordVaultBlock,
  loadPasswordVaultBlock,
  savePasswordVaultBlock,
} from '@/services/lego_blocks/integrations/passwordVaultBlock'

class FakeVaultFS implements VaultFS {
  private files = new Map<string, string>()
  private mtimes = new Map<string, number>()
  private tick = 1

  async read(path: string): Promise<string> {
    const value = this.files.get(path)
    if (value == null) throw new Error(`Missing file: ${path}`)
    return value
  }

  async write(path: string, data: string): Promise<void> {
    this.files.set(path, data)
    this.mtimes.set(path, this.tick)
    this.tick += 1
  }

  async readBytes(path: string): Promise<Uint8Array> {
    return new TextEncoder().encode(await this.read(path))
  }

  async writeBytes(path: string, data: Uint8Array): Promise<void> {
    await this.write(path, new TextDecoder().decode(data))
  }

  async create(path: string, data: string): Promise<void> {
    if (await this.exists(path)) throw new Error(`File exists: ${path}`)
    await this.write(path, data)
  }

  async list(): Promise<{ files: string[]; folders: string[] }> {
    return { files: [], folders: [] }
  }

  async walkVault(): Promise<[]> {
    return []
  }

  async stat(path: string): Promise<{ size: number; mtime: number; ctime?: number; isDirectory?: boolean }> {
    const value = this.files.get(path)
    const mtime = this.mtimes.get(path)
    if (value == null || mtime == null) throw new Error(`Missing file: ${path}`)
    return {
      size: value.length,
      mtime,
      ctime: mtime,
      isDirectory: false,
    }
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path)
  }

  async mkdir(): Promise<void> {}

  async delete(path: string): Promise<void> {
    this.files.delete(path)
    this.mtimes.delete(path)
  }

  async process(path: string, fn: (data: string) => string): Promise<void> {
    await this.write(path, fn(await this.read(path)))
  }
}

describe('passwordVaultBlock', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    })
  })

  it('returns an empty vault when the encrypted file does not exist yet', async () => {
    const fs = new FakeVaultFS()
    const loaded = await loadPasswordVaultBlock({
      passphrase: 'vault-passphrase',
      fs,
    })

    expect(loaded.exists).toBe(false)
    expect(loaded.vault.entries).toEqual([])
    expect(loaded.sourceMtime).toBeNull()
  })

  it('saves and reloads encrypted password entries', async () => {
    const fs = new FakeVaultFS()
    const initial = createEmptyPasswordVaultBlock('2026-03-20T00:00:00.000Z')
    initial.updatedAt = '2026-03-20T00:00:00.000Z'
    initial.entries = [{
      id: 'entry-1',
      title: 'GitHub',
      username: 'anurag',
      password: 'secret-123',
      website: 'https://github.com',
      notes: 'MFA enabled',
      tags: ['work', 'code'],
      createdAt: '2026-03-20T00:00:00.000Z',
      updatedAt: '2026-03-20T00:00:00.000Z',
    }]

    const saved = await savePasswordVaultBlock({
      passphrase: 'vault-passphrase',
      vault: initial,
      expectedMtime: null,
      fs,
    })

    const loaded = await loadPasswordVaultBlock({
      passphrase: 'vault-passphrase',
      fs,
    })

    expect(saved.sourceMtime).not.toBeNull()
    expect(loaded.exists).toBe(true)
    expect(loaded.sourceMtime).toBe(saved.sourceMtime)
    expect(loaded.vault.entries).toEqual(initial.entries)
  })

  it('rejects stale writes when the vault file changed on disk', async () => {
    const fs = new FakeVaultFS()
    const first = await savePasswordVaultBlock({
      passphrase: 'vault-passphrase',
      vault: {
        ...createEmptyPasswordVaultBlock('2026-03-20T00:00:00.000Z'),
        updatedAt: '2026-03-20T00:00:00.000Z',
        entries: [{
          id: 'entry-1',
          title: 'GitHub',
          username: '',
          password: 'secret-123',
          tags: [],
          createdAt: '2026-03-20T00:00:00.000Z',
          updatedAt: '2026-03-20T00:00:00.000Z',
        }],
      },
      expectedMtime: null,
      fs,
    })

    await savePasswordVaultBlock({
      passphrase: 'vault-passphrase',
      vault: {
        ...createEmptyPasswordVaultBlock('2026-03-20T00:01:00.000Z'),
        updatedAt: '2026-03-20T00:01:00.000Z',
        entries: [{
          id: 'entry-1',
          title: 'GitHub',
          username: '',
          password: 'rotated-secret',
          tags: [],
          createdAt: '2026-03-20T00:00:00.000Z',
          updatedAt: '2026-03-20T00:01:00.000Z',
        }],
      },
      expectedMtime: first.sourceMtime,
      fs,
    })

    await expect(savePasswordVaultBlock({
      passphrase: 'vault-passphrase',
      vault: {
        ...createEmptyPasswordVaultBlock('2026-03-20T00:02:00.000Z'),
        updatedAt: '2026-03-20T00:02:00.000Z',
        entries: [{
          id: 'entry-1',
          title: 'GitHub',
          username: '',
          password: 'stale-write',
          tags: [],
          createdAt: '2026-03-20T00:00:00.000Z',
          updatedAt: '2026-03-20T00:02:00.000Z',
        }],
      },
      expectedMtime: first.sourceMtime,
      fs,
    })).rejects.toThrow('Password vault changed on disk. Reload it before saving.')
  })
})
