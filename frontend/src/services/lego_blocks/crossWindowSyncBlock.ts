// Cross-window vault sync via BroadcastChannel.
// When any window writes a file, other windows re-sync that file into IndexedDB.
// Works across Electron windows, browser tabs, and any same-origin context.

const CHANNEL_NAME = 'ltm-vault-sync'

export interface VaultChangeMessage {
  type: 'file-changed' | 'file-deleted'
  filePath: string
  timestamp: number
}

let _channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel {
  if (!_channel) _channel = new BroadcastChannel(CHANNEL_NAME)
  return _channel
}

export function notifyFileChanged(filePath: string): void {
  getChannel().postMessage({
    type: 'file-changed',
    filePath,
    timestamp: Date.now(),
  } satisfies VaultChangeMessage)
}

export function notifyFileDeleted(filePath: string): void {
  getChannel().postMessage({
    type: 'file-deleted',
    filePath,
    timestamp: Date.now(),
  } satisfies VaultChangeMessage)
}

export function onVaultChange(
  handler: (msg: VaultChangeMessage) => void,
): () => void {
  const channel = getChannel()
  const listener = (event: MessageEvent<VaultChangeMessage>) => {
    handler(event.data)
  }
  channel.addEventListener('message', listener)
  return () => channel.removeEventListener('message', listener)
}
