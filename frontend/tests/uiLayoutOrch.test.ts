import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getUILayoutStateOrch,
  subscribeUILayoutOrch,
  type UILayoutWindowLike,
} from '@/services/orchestrators/uiLayoutOrch'

type Listener = () => void

class EventHub {
  private readonly listeners = new Map<string, Set<Listener>>()

  addEventListener(type: string, listener: Listener): void {
    let bucket = this.listeners.get(type)
    if (!bucket) {
      bucket = new Set<Listener>()
      this.listeners.set(type, bucket)
    }
    bucket.add(listener)
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener)
  }

  emit(type: string): void {
    const bucket = this.listeners.get(type)
    if (!bucket) return
    for (const listener of bucket) listener()
  }
}

class ProbeElement {
  style = { cssText: '' }
  remove(): void {}
}

interface FakeWindow extends UILayoutWindowLike {
  emit: (type: string) => void
}

function createFakeWindow(width: number, height: number): FakeWindow {
  const windowHub = new EventHub()
  const viewportHub = new EventHub()
  const visualViewport = {
    width,
    height,
    addEventListener: (type: string, listener: Listener) => viewportHub.addEventListener(type, listener),
    removeEventListener: (type: string, listener: Listener) => viewportHub.removeEventListener(type, listener),
  }

  return {
    innerWidth: width,
    innerHeight: height,
    visualViewport,
    document: {
      body: {
        appendChild: () => {},
      },
      createElement: () => new ProbeElement(),
    },
    getComputedStyle: () => ({
      paddingTop: '11px',
      paddingRight: '3px',
      paddingBottom: '9px',
      paddingLeft: '2px',
    }),
    addEventListener: (type: string, listener: Listener) => windowHub.addEventListener(type, listener),
    removeEventListener: (type: string, listener: Listener) => windowHub.removeEventListener(type, listener),
    emit: (type: string) => {
      windowHub.emit(type)
      viewportHub.emit(type)
    },
  }
}

describe('uiLayoutOrch', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('computes layout state from provided runtime and viewport', () => {
    const windowRef = createFakeWindow(430, 932)
    const state = getUILayoutStateOrch({
      windowRef,
      runtimeFlags: {
        isElectron: false,
        isCapacitorNative: true,
        platformName: 'ios',
      },
    })

    expect(state.mode).toBe('phone')
    expect(state.hasBottomBar).toBe(true)
    expect(state.surface).toBe('capacitor-ios')
    expect(state.safeAreaInsets).toEqual({
      top: 11,
      right: 3,
      bottom: 9,
      left: 2,
    })
  })

  it('subscribes to resize/orientation updates with debounce', () => {
    vi.useFakeTimers()
    const windowRef = createFakeWindow(900, 1200)
    const modes: string[] = []

    const unsubscribe = subscribeUILayoutOrch(
      (state) => {
        modes.push(state.mode)
      },
      {
        windowRef,
        runtimeFlags: {
          isElectron: false,
          isCapacitorNative: true,
          platformName: 'ios',
        },
        safeAreaInsets: { top: 20, bottom: 16 },
        debounceMs: 40,
      },
    )

    expect(modes).toEqual(['tablet'])

    windowRef.innerWidth = 1300
    windowRef.innerHeight = 900
    windowRef.visualViewport!.width = 1300
    windowRef.visualViewport!.height = 900
    windowRef.emit('resize')

    vi.advanceTimersByTime(39)
    expect(modes).toEqual(['tablet'])

    vi.advanceTimersByTime(1)
    expect(modes).toEqual(['tablet', 'desktop'])

    unsubscribe()
    windowRef.innerWidth = 420
    windowRef.innerHeight = 900
    windowRef.visualViewport!.width = 420
    windowRef.visualViewport!.height = 900
    windowRef.emit('orientationchange')
    vi.runAllTimers()
    expect(modes).toEqual(['tablet', 'desktop'])
  })
})

