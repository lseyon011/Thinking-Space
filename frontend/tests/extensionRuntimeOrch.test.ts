import { beforeEach, describe, expect, it } from 'vitest'
import { invokeExtensionRuntimeActionOrch } from '@/services/orchestrators/extensionRuntimeOrch'

function installLocalStorageMock(): void {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => { store.clear() },
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() { return store.size },
    },
  })
}

function setElectronApiMock(value: unknown): void {
  const root = globalThis as unknown as { window?: { electronAPI?: unknown } }
  if (!root.window) root.window = {}
  root.window.electronAPI = value
}

describe('extensionRuntimeOrch', () => {
  beforeEach(() => {
    installLocalStorageMock()
    localStorage.clear()
    setElectronApiMock(undefined)
  })

  it('throws when runtime is not electron', async () => {
    await expect(
      invokeExtensionRuntimeActionOrch({
        extensionId: 'com.demo',
        extensionRegistryKey: 'demo',
        extensionPermissions: ['organizer:read'],
        runtimeEntry: 'runtime/main.ts',
        runtimeHandler: 'run',
        actionId: 'run',
        input: {},
      }),
    ).rejects.toThrowError('Extension JS/TS runtime is only available in Electron.')
  })

  it('throws when vault root is not configured', async () => {
    setElectronApiMock({
      isElectron: true,
      extensionRuntimeInvoke: async () => ({ ok: true }),
    } as unknown)

    await expect(
      invokeExtensionRuntimeActionOrch({
        extensionId: 'com.demo',
        extensionRegistryKey: 'demo',
        extensionPermissions: ['organizer:read'],
        runtimeEntry: 'runtime/main.ts',
        runtimeHandler: 'run',
        actionId: 'run',
        input: {},
      }),
    ).rejects.toThrowError('Vault root not configured')
  })

  it('calls electron runtime invoke adapter with expected payload', async () => {
    const payloads: Record<string, unknown>[] = []
    setElectronApiMock({
      isElectron: true,
      extensionRuntimeInvoke: async (payload: Record<string, unknown>) => {
        payloads.push(payload)
        return {
          ok: true,
          requestId: 'req-runtime',
          extensionId: 'com.demo',
          extensionRegistryKey: 'demo',
          actionId: 'run',
          runtimeHandler: 'run',
          warnings: [],
          data: { ok: true },
        }
      },
    } as unknown)
    localStorage.setItem('ltm-vault-root', '/tmp/vault')

    const response = await invokeExtensionRuntimeActionOrch({
      extensionId: 'com.demo',
      extensionRegistryKey: 'demo',
      extensionPermissions: ['organizer:read'],
      runtimeEntry: 'runtime/main.ts',
      runtimeHandler: 'run',
      actionId: 'run',
      input: { filePath: 'notes/a.md' },
      context: { nodeKey: 'tp-da' },
    })

    expect(response.ok).toBe(true)
    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toMatchObject({
      vaultRoot: '/tmp/vault',
      extensionId: 'com.demo',
      extensionRegistryKey: 'demo',
      runtimeEntry: 'runtime/main.ts',
      runtimeHandler: 'run',
      actionId: 'run',
      input: { filePath: 'notes/a.md' },
      context: { nodeKey: 'tp-da' },
    })
  })
})
