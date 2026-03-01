export const GLOBAL_SYNC_REFRESH_EVENT_BLOCK = 'ltm:global-sync-refresh'

export interface GlobalSyncRefreshDetailBlock {
  source: 'topbar' | 'unknown'
  requestedAt: number
  vaultSyncAttempted: boolean
  vaultSyncSucceeded: boolean
}

const DEFAULT_DETAIL_BLOCK: GlobalSyncRefreshDetailBlock = {
  source: 'unknown',
  requestedAt: 0,
  vaultSyncAttempted: false,
  vaultSyncSucceeded: false,
}

export function dispatchGlobalSyncRefreshBlock(detail: GlobalSyncRefreshDetailBlock): void {
  window.dispatchEvent(new CustomEvent<GlobalSyncRefreshDetailBlock>(GLOBAL_SYNC_REFRESH_EVENT_BLOCK, { detail }))
}

export function addGlobalSyncRefreshListenerBlock(
  listener: (detail: GlobalSyncRefreshDetailBlock) => void,
): () => void {
  const handler = (event: Event) => {
    const custom = event as CustomEvent<GlobalSyncRefreshDetailBlock>
    listener(custom.detail ?? DEFAULT_DETAIL_BLOCK)
  }
  window.addEventListener(GLOBAL_SYNC_REFRESH_EVENT_BLOCK, handler as EventListener)
  return () => {
    window.removeEventListener(GLOBAL_SYNC_REFRESH_EVENT_BLOCK, handler as EventListener)
  }
}
