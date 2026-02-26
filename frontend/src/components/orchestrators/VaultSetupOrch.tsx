import { useState } from 'react'
import { FolderOpen, Check, Globe, Server } from 'lucide-react'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { selectAndSetVaultRoot } from '@/services/orchestrators/runtimeOrch'
import {
  isElectron,
  isCapacitorNative,
  isBrowserFSAvailable,
  pickAndInitBrowserVaultFS,
  setVaultFSInstance,
  setVaultRoot,
} from '@/services/lego_blocks/fsBlock'
import { getStoredVaultRoot } from '@/services/lego_blocks/storageKeyBlock'
import { probeBackendConnectionBlock } from '@/services/lego_blocks/backendConnectionBlock'
import { registerPlugin } from '@capacitor/core'

// Native folder picker plugin (defined in AppDelegate.swift)
interface FolderPickerPluginDef {
  pickFolder(): Promise<{ url: string; accessing: boolean }>
  restoreBookmark(): Promise<{ url: string; accessing: boolean }>
}

const FolderPicker = registerPlugin<FolderPickerPluginDef>('FolderPicker')

interface Props {
  onComplete: (vaultRoot: string) => void
}

export default function VaultSetup({ onComplete }: Props) {
  const [selecting, setSelecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isElectronApp = isElectron()
  const isCapacitor = isCapacitorNative()
  const isNativeApp = isElectronApp || isCapacitor
  const hasBrowserFS = !isNativeApp && isBrowserFSAvailable()
  const hasBackendOption = !isNativeApp
  const isBackendReconnect = getStoredVaultRoot() === 'web-backend'

  // Electron: use native folder picker via IPC
  const handleElectronSelect = async () => {
    setSelecting(true)
    setError(null)
    try {
      const selected = await selectAndSetVaultRoot()
      if (selected) {
        onComplete(selected)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select folder')
    } finally {
      setSelecting(false)
    }
  }

  // Capacitor (iOS): open native folder picker showing local + iCloud
  const handleCapacitorSelect = async () => {
    setSelecting(true)
    setError(null)
    try {
      const result = await FolderPicker.pickFolder()
      // Store the absolute path — CapacitorVaultFS will use it directly
      // Prefix with cap-picker: so we know it's a picker-selected absolute path
      const vaultMarker = `cap-picker:${result.url}`
      setVaultRoot(vaultMarker)
      onComplete(vaultMarker)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('cancel')) {
        setError(msg)
      }
    } finally {
      setSelecting(false)
    }
  }

  // Browser: use File System Access API
  const handleBrowserFolderPick = async () => {
    setSelecting(true)
    setError(null)
    try {
      const browserFS = await pickAndInitBrowserVaultFS()
      setVaultFSInstance(browserFS)
      setVaultRoot('browser-fs')
      onComplete('browser-fs')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled
      } else {
        setError(err instanceof Error ? err.message : 'Failed to open folder')
      }
    } finally {
      setSelecting(false)
    }
  }

  // Web: connect/refresh FastAPI backend and verify vault access.
  const handleBackendConnect = async () => {
    setSelecting(true)
    setError(null)
    try {
      const probe = await probeBackendConnectionBlock(true)
      if (!probe.connected) {
        throw new Error(probe.error || 'Backend is reachable but vault is unavailable')
      }
      setVaultRoot('web-backend')
      onComplete('web-backend')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to backend')
    } finally {
      setSelecting(false)
    }
  }

  const handleNativeSelect = isElectronApp ? handleElectronSelect : handleCapacitorSelect

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="mx-auto max-w-md px-6 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <FolderOpen className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Thinking Space</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isNativeApp
            ? 'Select your vault folder to get started. You can pick a local folder or one in iCloud Drive.'
            : 'Choose how to connect to your vault.'}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {isNativeApp && (
            <Button size="lg" onClick={handleNativeSelect} disabled={selecting}>
              {selecting ? 'Selecting...' : (
                <>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Select Vault Folder
                </>
              )}
            </Button>
          )}

          {hasBrowserFS && (
            <Button size="lg" onClick={handleBrowserFolderPick} disabled={selecting}>
              {selecting ? 'Opening...' : (
                <>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Open Local Folder
                </>
              )}
            </Button>
          )}

          {hasBackendOption && (
            <div className="space-y-2 text-left">
              <Button
                size="lg"
                variant={hasBrowserFS ? 'outline' : 'default'}
                onClick={() => { void handleBackendConnect() }}
                disabled={selecting}
                className="w-full"
              >
                <Server className="mr-2 h-4 w-4" />
                {selecting
                  ? (isBackendReconnect ? 'Refreshing Backend...' : 'Connecting Backend...')
                  : (isBackendReconnect ? 'Refresh Backend Connection' : 'Connect to Backend')}
              </Button>
              <p className="text-xs text-muted-foreground">
                Backend mode does not use a browser folder picker. The vault path is configured on the backend via
                `LTM_VAULT_ROOT` or `THINK_SPACE_VAULT_ROOT`.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}

        <div className="mt-8 space-y-2 text-left text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
            <span>All data stays on your machine — nothing is uploaded</span>
          </div>
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
            <span>Works alongside Obsidian — no conflicts</span>
          </div>
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
            <span>You can change the vault folder later in settings</span>
          </div>
          {hasBrowserFS && (
            <div className="flex items-start gap-2">
              <Globe className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
              <span>Open Local Folder works without any server — your browser reads files directly</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
