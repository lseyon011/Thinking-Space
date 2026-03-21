import { useEffect, useRef } from 'react'
import type { PluginListenerHandle } from '@capacitor/core'
import { isCapacitorNative } from '@/services/lego_blocks/integrations/fsBlock'
import type {
  NativeTopChromeTabBridgeItem,
  TopChromeEventPayload,
  TopChromeStateBlock,
} from '@/services/lego_blocks/units/topChromeNativeBridgeBlock'
import {
  addTopChromeListenerBlock,
  hideTopChromeBlock,
  setTopChromeStateBlock,
  showTopChromeBlock,
} from '@/services/lego_blocks/units/topChromeNativeBridgeBlock'

interface UseNativeTopChromeOptions extends TopChromeStateBlock {
  enabled: boolean
  tabs: NativeTopChromeTabBridgeItem[]
  onMenuTap: () => void
  onSearchTap: () => void
  onOpenDebugTap: () => void
  onRefreshTap: () => void
  onSyncTap: () => void
  onRebuildTap: () => void
  onGitCommitTap: () => void
  onGitPushTap: () => void
  onHeaderToggleTap: () => void
  onSidebarToggleTap: () => void
  onCreateTap: () => void
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
}

interface NativeTopChromeCallbackRegistry {
  onMenuTap: () => void
  onSearchTap: () => void
  onOpenDebugTap: () => void
  onRefreshTap: () => void
  onSyncTap: () => void
  onRebuildTap: () => void
  onGitCommitTap: () => void
  onGitPushTap: () => void
  onHeaderToggleTap: () => void
  onSidebarToggleTap: () => void
  onCreateTap: () => void
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
}

function resolveTabId(payload: TopChromeEventPayload): string | null {
  return typeof payload.tabId === 'string' && payload.tabId.trim().length > 0
    ? payload.tabId
    : null
}

export function useNativeTopChromeBlock({
  enabled,
  onMenuTap,
  onSearchTap,
  onOpenDebugTap,
  onRefreshTap,
  onSyncTap,
  onRebuildTap,
  onGitCommitTap,
  onGitPushTap,
  onHeaderToggleTap,
  onSidebarToggleTap,
  onCreateTap,
  onSelectTab,
  onCloseTab,
  ...state
}: UseNativeTopChromeOptions): void {
  const callbackRegistryRef = useRef<NativeTopChromeCallbackRegistry>({
    onMenuTap,
    onSearchTap,
    onOpenDebugTap,
    onRefreshTap,
    onSyncTap,
    onRebuildTap,
    onGitCommitTap,
    onGitPushTap,
    onHeaderToggleTap,
    onSidebarToggleTap,
    onCreateTap,
    onSelectTab,
    onCloseTab,
  })

  useEffect(() => {
    callbackRegistryRef.current = {
      onMenuTap,
      onSearchTap,
      onOpenDebugTap,
      onRefreshTap,
      onSyncTap,
      onRebuildTap,
      onGitCommitTap,
      onGitPushTap,
      onHeaderToggleTap,
      onSidebarToggleTap,
      onCreateTap,
      onSelectTab,
      onCloseTab,
    }
  }, [
    onCloseTab,
    onCreateTap,
    onGitCommitTap,
    onGitPushTap,
    onHeaderToggleTap,
    onMenuTap,
    onOpenDebugTap,
    onRebuildTap,
    onRefreshTap,
    onSearchTap,
    onSelectTab,
    onSidebarToggleTap,
    onSyncTap,
  ])

  useEffect(() => {
    if (!enabled || !isCapacitorNative()) return

    void showTopChromeBlock().catch((error: unknown) => {
      console.warn('[useNativeTopChromeBlock] Failed to show native top chrome:', error)
    })

    void setTopChromeStateBlock({
      ...state,
      visible: true,
    }).catch((error: unknown) => {
      console.warn('[useNativeTopChromeBlock] Failed to push native chrome state:', error)
    })
  }, [enabled, state])

  useEffect(() => {
    if (!enabled || !isCapacitorNative()) return

    let mounted = true
    const handles: PluginListenerHandle[] = []

    const attachListeners = async () => {
      try {
        const nextHandles = await Promise.all([
          addTopChromeListenerBlock('topChromeMenuTap', () => callbackRegistryRef.current.onMenuTap()),
          addTopChromeListenerBlock('topChromeSearchTap', () => callbackRegistryRef.current.onSearchTap()),
          addTopChromeListenerBlock('topChromeOpenDebugTap', () => callbackRegistryRef.current.onOpenDebugTap()),
          addTopChromeListenerBlock('topChromeRefreshTap', () => callbackRegistryRef.current.onRefreshTap()),
          addTopChromeListenerBlock('topChromeSyncTap', () => callbackRegistryRef.current.onSyncTap()),
          addTopChromeListenerBlock('topChromeRebuildTap', () => callbackRegistryRef.current.onRebuildTap()),
          addTopChromeListenerBlock('topChromeGitCommitTap', () => callbackRegistryRef.current.onGitCommitTap()),
          addTopChromeListenerBlock('topChromeGitPushTap', () => callbackRegistryRef.current.onGitPushTap()),
          addTopChromeListenerBlock('topChromeHeaderToggleTap', () => callbackRegistryRef.current.onHeaderToggleTap()),
          addTopChromeListenerBlock('topChromeSidebarToggleTap', () => callbackRegistryRef.current.onSidebarToggleTap()),
          addTopChromeListenerBlock('topChromeCreateTap', () => callbackRegistryRef.current.onCreateTap()),
          addTopChromeListenerBlock('topChromeSelectTab', (payload) => {
            const tabId = resolveTabId(payload)
            if (tabId) callbackRegistryRef.current.onSelectTab(tabId)
          }),
          addTopChromeListenerBlock('topChromeCloseTab', (payload) => {
            const tabId = resolveTabId(payload)
            if (tabId) callbackRegistryRef.current.onCloseTab(tabId)
          }),
        ])

        if (!mounted) {
          nextHandles.forEach((handle) => {
            void handle.remove()
          })
          return
        }

        handles.push(...nextHandles)
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
