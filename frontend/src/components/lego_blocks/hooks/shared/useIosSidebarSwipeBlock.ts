import { useEffect, useRef } from 'react'
import {
  shouldCloseDrawerFromSwipeBlock,
  shouldIgnoreEdgeSwipeFromTargetBlock,
  shouldOpenDrawerFromSwipeBlock,
  shouldStartEdgeSwipeOpenBlock,
} from '@/services/lego_blocks/units/uiGestureBlock'
import {
  addInlineWebViewSwipeOpenListenerBlock,
  addInlineWebViewSwipeCloseListenerBlock,
} from '@/services/lego_blocks/units/inlineWebViewBlock'

interface UseIosSidebarSwipeOptions {
  /** Only attach gestures on iOS Capacitor. */
  isIos: boolean
  /** Current open state of the sidebar. */
  isOpen: boolean
  /** Suppress gestures while the keyboard is visible. */
  keyboardVisible?: boolean
  /**
   * Called to toggle the sidebar. The hook fires this when the open gesture
   * completes (sidebar was closed) or the close gesture completes (sidebar
   * was open), matching the existing toggle-event pattern used by each tab.
   */
  onToggle: () => void
}

/**
 * Attaches iOS-only swipe gestures to open/close a tab sidebar:
 *  - Open: swipe right from the left edge (≤24 px) when sidebar is closed.
 *  - Close: swipe left from anywhere when sidebar is open.
 *
 * Both gestures are window-level and respect the shared uiGestureBlock
 * thresholds so they feel identical to the global nav-drawer gesture.
 */
export function useIosSidebarSwipeBlock({
  isIos,
  isOpen,
  keyboardVisible = false,
  onToggle,
}: UseIosSidebarSwipeOptions): void {
  const openSwipeRef = useRef<{ x: number; y: number } | null>(null)
  const closeSwipeRef = useRef<{ x: number; y: number } | null>(null)

  // Edge-swipe to open (fires when sidebar is closed)
  useEffect(() => {
    if (!isIos || isOpen || keyboardVisible) {
      openSwipeRef.current = null
      return
    }

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return
      if (shouldIgnoreEdgeSwipeFromTargetBlock(e.target)) {
        openSwipeRef.current = null
        return
      }
      if (!shouldStartEdgeSwipeOpenBlock(touch.clientX)) return
      openSwipeRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchMove = (e: TouchEvent) => {
      const start = openSwipeRef.current
      if (!start) return
      const touch = e.touches[0]
      if (!touch) return
      if (shouldOpenDrawerFromSwipeBlock(touch.clientX - start.x, touch.clientY - start.y)) {
        openSwipeRef.current = null
        onToggle()
      }
    }

    const clear = () => { openSwipeRef.current = null }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', clear)
    window.addEventListener('touchcancel', clear)

    // Also handle swipes that start on the native WKWebView overlay (InlineWebViewPlugin).
    // The overlay's left-edge strip fires this event when a rightward swipe is detected natively.
    let capHandle: import('@capacitor/core').PluginListenerHandle | null = null
    let mounted = true
    void addInlineWebViewSwipeOpenListenerBlock(onToggle).then(h => {
      if (mounted) capHandle = h
      else void h.remove()
    })

    return () => {
      mounted = false
      void capHandle?.remove()
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', clear)
      window.removeEventListener('touchcancel', clear)
    }
  }, [isIos, isOpen, keyboardVisible, onToggle])

  // Swipe-left to close (fires when sidebar is open)
  useEffect(() => {
    if (!isIos || !isOpen) {
      closeSwipeRef.current = null
      return
    }

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return
      closeSwipeRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchMove = (e: TouchEvent) => {
      const start = closeSwipeRef.current
      if (!start) return
      const touch = e.touches[0]
      if (!touch) return
      if (shouldCloseDrawerFromSwipeBlock(touch.clientX - start.x, touch.clientY - start.y)) {
        closeSwipeRef.current = null
        onToggle()
      }
    }

    const clear = () => { closeSwipeRef.current = null }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', clear)
    window.addEventListener('touchcancel', clear)

    // Also handle close swipes that start on the native WKWebView overlay.
    let capHandle: import('@capacitor/core').PluginListenerHandle | null = null
    let mounted = true
    void addInlineWebViewSwipeCloseListenerBlock(onToggle).then(h => {
      if (mounted) capHandle = h
      else void h.remove()
    })

    return () => {
      mounted = false
      void capHandle?.remove()
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', clear)
      window.removeEventListener('touchcancel', clear)
    }
  }, [isIos, isOpen, onToggle])
}
