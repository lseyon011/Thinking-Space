import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('windowContextBlock', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: globalThis,
    })
    Object.defineProperty(globalThis.window, 'electronAPI', {
      configurable: true,
      value: undefined,
    })
  })

  it('returns a safe default when Electron window context is unavailable', async () => {
    const { getWindowContextBlock } = await import('@/services/lego_blocks/units/windowContextBlock')

    expect(getWindowContextBlock()).toEqual({
      browserWindowId: null,
      sessionId: 'default',
      isMainWindow: false,
      isBackgroundAuthority: true,
    })
  })

  it('sanitizes the preload-provided window context', async () => {
    Object.defineProperty(globalThis.window, 'electronAPI', {
      configurable: true,
      value: {
        isElectron: true,
        windowGetContext: () => ({
          browserWindowId: 7,
          sessionId: 'main-window',
          isMainWindow: 1,
          isBackgroundAuthority: 0,
        }),
      },
    })

    const { getWindowContextBlock } = await import('@/services/lego_blocks/units/windowContextBlock')

    expect(getWindowContextBlock()).toEqual({
      browserWindowId: 7,
      sessionId: 'main-window',
      isMainWindow: true,
      isBackgroundAuthority: false,
    })
  })

  it('subscribes to window-context updates when the Electron bridge is available', async () => {
    const unsubscribe = vi.fn()
    const onWindowContext = vi.fn((handler: (context: unknown) => void) => {
      handler({
        browserWindowId: 11,
        sessionId: 'window-abc',
        isMainWindow: false,
        isBackgroundAuthority: true,
      })
      return unsubscribe
    })

    Object.defineProperty(globalThis.window, 'electronAPI', {
      configurable: true,
      value: {
        isElectron: true,
        windowGetContext: () => undefined,
        onWindowContext,
      },
    })

    const { subscribeWindowContextBlock } = await import('@/services/lego_blocks/units/windowContextBlock')
    const handler = vi.fn()
    const cleanup = subscribeWindowContextBlock(handler)

    expect(onWindowContext).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({
      browserWindowId: 11,
      sessionId: 'window-abc',
      isMainWindow: false,
      isBackgroundAuthority: true,
    })

    cleanup()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
