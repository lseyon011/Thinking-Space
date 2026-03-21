import { useEffect, useRef } from 'react'
import type { PluginListenerHandle } from '@capacitor/core'
import { isCapacitorNative } from '@/services/lego_blocks/integrations/fsBlock'
import {
  addTopChromeCreateTapListenerBlock,
  addTopChromeMenuTapListenerBlock,
  addTopChromeSearchTapListenerBlock,
  hideTopChromeBlock,
  setTopChromeStateBlock,
  showTopChromeBlock,
} from '@/services/lego_blocks/units/topChromeNativeBridgeBlock'

interface UseNativeTopChromeOptions {
  enabled: boolean
  title: string
  showSearch?: boolean
  showCreate?: boolean
  onMenuTap: () => void
  onSearchTap: () => void
  onCreateTap: () => void
}

export function useNativeTopChromeBlock({
  enabled,
  title,
  showSearch = true,
  showCreate = true,
  onMenuTap,
  onSearchTap,
  onCreateTap,
}: UseNativeTopChromeOptions): void {
  const menuTapRef = useRef(onMenuTap)
  const searchTapRef = useRef(onSearchTap)
  const createTapRef = useRef(onCreateTap)

  useEffect(() => {
    menuTapRef.current = onMenuTap
  }, [onMenuTap])

  useEffect(() => {
    searchTapRef.current = onSearchTap
  }, [onSearchTap])

  useEffect(() => {
    createTapRef.current = onCreateTap
  }, [onCreateTap])

  useEffect(() => {
    if (!enabled || !isCapacitorNative()) return

    void showTopChromeBlock().catch((error: unknown) => {
      console.warn('[useNativeTopChromeBlock] Failed to show native top chrome:', error)
    })

    void setTopChromeStateBlock({
      title,
      visible: true,
      showSearch,
      showCreate,
    }).catch((error: unknown) => {
      console.warn('[useNativeTopChromeBlock] Failed to push native chrome state:', error)
    })
  }, [enabled, showCreate, showSearch, title])

  useEffect(() => {
    if (!enabled || !isCapacitorNative()) return

    let mounted = true
    const handles: PluginListenerHandle[] = []

    const attachListeners = async () => {
      try {
        const [menuHandle, searchHandle, createHandle] = await Promise.all([
          addTopChromeMenuTapListenerBlock(() => menuTapRef.current()),
          addTopChromeSearchTapListenerBlock(() => searchTapRef.current()),
          addTopChromeCreateTapListenerBlock(() => createTapRef.current()),
        ])

        if (!mounted) {
          void menuHandle.remove()
          void searchHandle.remove()
          void createHandle.remove()
          return
        }

        handles.push(menuHandle, searchHandle, createHandle)
      } catch (error) {
        console.warn('[useNativeTopChromeBlock] Failed to attach native chrome listeners:', error)
      }
    }

    void attachListeners()

    return () => {
      mounted = false
      handles.forEach((handle) => {
        void handle.remove()
      })
      void hideTopChromeBlock().catch(() => {})
    }
  }, [enabled])
}
