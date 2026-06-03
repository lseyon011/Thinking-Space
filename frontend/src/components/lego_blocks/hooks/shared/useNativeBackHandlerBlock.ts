import { useEffect, useRef } from 'react'

/**
 * Generic "go to previous screen" for the iPhone push-nav system.
 *
 * Different tabs (and different content types within a tab) close in different
 * ways — RSS viewers, browser overlays, notebook views, inline files. Rather
 * than hardcoding the back chevron + edge-swipe to one specific close handler,
 * each tab orchestrator declares: "while this content is active, here's how
 * to go back." When the native pop fires, the topmost registered handler runs.
 *
 * Usage:
 *   useNativeBackHandlerBlock({
 *     active: hasInlineContentForPhone,
 *     onBack: () => {
 *       // priority cascade — close whatever's on top
 *       if (rssArticle) { setRssArticle(null); return }
 *       if (browserUrl) { setBrowserUrl(null); return }
 *       if (filePath)   { setFilePath(null);   return }
 *     },
 *   })
 *
 * Stack semantics: last writer wins. If two components both go active at the
 * same time, the more recently mounted one takes precedence; when it
 * unregisters, the previous one is restored.
 */

type BackHandler = () => void
const handlerStack: BackHandler[] = []

/** Invoke the top of the back-handler stack, if any. Returns true on success. */
export function invokeNativeBackHandlerBlock(): boolean {
  const handler = handlerStack[handlerStack.length - 1]
  if (!handler) return false
  try {
    handler()
    return true
  } catch (err) {
    console.error('[useNativeBackHandlerBlock] handler threw', err)
    return false
  }
}

/** True when at least one handler is registered. */
export function hasNativeBackHandlerBlock(): boolean {
  return handlerStack.length > 0
}

interface UseNativeBackHandlerOptions {
  /** Register the handler while this is true; unregister when false. */
  active: boolean
  onBack: () => void
}

export function useNativeBackHandlerBlock({ active, onBack }: UseNativeBackHandlerOptions): void {
  const handlerRef = useRef(onBack)
  handlerRef.current = onBack

  useEffect(() => {
    if (!active) return
    // Stable identity so we can find ourselves in the stack later.
    const stable: BackHandler = () => handlerRef.current()
    handlerStack.push(stable)
    return () => {
      const idx = handlerStack.lastIndexOf(stable)
      if (idx >= 0) {
        handlerStack.splice(idx, 1)
      }
    }
  }, [active])
}
