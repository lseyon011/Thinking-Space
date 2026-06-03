import { useCallback, useEffect, useRef } from 'react'
import type { PluginListenerHandle } from '@capacitor/core'
import {
  addTopChromeListenerBlock,
  commitNativeNavigationBlock,
  consumePendingForwardBlock,
  popNativeNavigationBlock,
  pushNativeNavigationBlock,
  setNativeNavigationStackBlock,
} from '../../../../services/lego_blocks/units/topChromeNativeBridgeBlock'
import { invokeNativeBackHandlerBlock } from './useNativeBackHandlerBlock'

interface UseNativePushNavigationOptions {
  /** Called when Swift asks React to render a path (typically react-router navigate). */
  onRequestRender: (path: string) => void | Promise<void>
  /** Optional: notified when a transition completes (use to resume paused animations). */
  onDidFinish?: (path: string) => void
  /** Enable/disable the bridge listeners. Pass false on non-iOS to avoid registering. */
  enabled?: boolean
}

interface UseNativePushNavigationApi {
  /** Ask Swift to perform a UIKit push transition to `path`. */
  push: (path: string) => Promise<void>
  /** Ask Swift to pop the top of the native stack. */
  pop: () => Promise<void>
  /** Reset the native stack (e.g. on tab switch via the rail). */
  setStack: (stack: string[]) => Promise<void>
}

/**
 * Bidirectional bridge for the iPhone push navigation.
 *
 * Direction A — React → Swift: caller invokes `push(path)`. Swift snapshots
 * the current page, then fires `topChromeNavRequestRender` so React can
 * navigate. After react-router commits the new route, this hook automatically
 * calls `commitNativeNavigationBlock(path)` to tell Swift "start animating."
 *
 * Direction B — Swift → React: when Swift's transition finishes, it fires
 * `topChromeNavDidFinish`. The optional `onDidFinish` callback lets callers
 * resume paused animations (chat streams, video) once the snapshot is gone.
 */
export function useNativePushNavigationBlock(
  options: UseNativePushNavigationOptions,
): UseNativePushNavigationApi {
  const { onRequestRender, onDidFinish, enabled = true } = options

  // Stable refs so the listener effect doesn't re-subscribe on every render.
  const onRequestRenderRef = useRef(onRequestRender)
  const onDidFinishRef = useRef(onDidFinish)
  onRequestRenderRef.current = onRequestRender
  onDidFinishRef.current = onDidFinish

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const handles: PluginListenerHandle[] = []

    void (async () => {
      const requestRenderHandle = await addTopChromeListenerBlock(
        'topChromeNavRequestRender',
        (payload) => {
          const path = payload.path
          if (typeof path !== 'string' || path.length === 0) return
          const direction = payload.direction === 'back' ? 'back' : 'forward'
          void (async () => {
            try {
              // Generic "go back": invoke whatever close action the active
              // tab has registered via useNativeBackHandlerBlock. This is
              // what makes back work for content types that don't live in
              // the URL (RSS articles, notebook views, etc.) — not just
              // URL-routed file open. The navigate(path) still runs after
              // so URL-state content (file) gets its URL restored too.
              //
              // Generic "go forward": if the push was via
              // pushNativeWithForwardBlock, run the caller's onForward
              // closure AND skip navigate — the closure's setSearchParams
              // is the authority on URL state. Otherwise (plain
              // pushNativeNavigationBlock with a real URL), navigate(path)
              // does the work.
              if (direction === 'back') {
                invokeNativeBackHandlerBlock()
                await onRequestRenderRef.current(path)
              } else {
                const fwd = consumePendingForwardBlock()
                if (fwd) {
                  fwd()
                } else {
                  await onRequestRenderRef.current(path)
                }
              }
            } catch (err) {
              console.error('[useNativePushNavigation] onRequestRender threw', err)
            }
            // Tell Swift the React side has committed — it can now animate.
            try {
              await commitNativeNavigationBlock(path)
            } catch (err) {
              console.error('[useNativePushNavigation] commit failed', err)
            }
          })()
        },
      )
      if (cancelled) {
        void requestRenderHandle.remove()
        return
      }
      handles.push(requestRenderHandle)

      const didFinishHandle = await addTopChromeListenerBlock(
        'topChromeNavDidFinish',
        (payload) => {
          const path = payload.path
          if (typeof path !== 'string' || path.length === 0) return
          onDidFinishRef.current?.(path)
        },
      )
      if (cancelled) {
        void didFinishHandle.remove()
        return
      }
      handles.push(didFinishHandle)
    })()

    return () => {
      cancelled = true
      for (const h of handles) {
        void h.remove()
      }
    }
  }, [enabled])

  const push = useCallback(async (path: string) => {
    await pushNativeNavigationBlock(path)
  }, [])

  const pop = useCallback(async () => {
    await popNativeNavigationBlock()
  }, [])

  const setStack = useCallback(async (stack: string[]) => {
    await setNativeNavigationStackBlock(stack)
  }, [])

  return { push, pop, setStack }
}
