import { useState } from 'react'
import { FolderOpen, Check, Globe, Server } from 'lucide-react'
import { Button } from '@/components/lego_blocks/ui/button'
import { selectAndSetVaultRoot } from '@/services/orchestrators/runtimeOrch'
import {
  isElectron,
  isCapacitorNative,
  isBrowserFSAvailable,
  pickAndInitBrowserVaultFS,
  setVaultFSInstance,
  setVaultRoot,
} from '@/services/lego_blocks/fsBlock'

interface Props {
  onComplete: (vaultRoot: string) => void
}

export default function VaultSetup({ onComplete }: Props) {
  const [selecting, setSelecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isNativeApp = isElectron() || isCapacitorNative()
  const hasBrowserFS = !isNativeApp && isBrowserFSAvailable()
  const hasBackendOption = !isNativeApp

  // Electron / Capacitor: use native folder picker
  const handleNativeSelect = async () => {
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

  // Browser: use File System Access API
  const handleBrowserFolderPick = async () => {
    setSelecting(true)
    setError(null)
    try {
      const browserFS = await pickAndInitBrowserVaultFS()
      setVaultFSInstance(browserFS)
      setVaultRoot('browser-fs') // marker value for localStorage
      onComplete('browser-fs')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled the picker
      } else {
        setError(err instanceof Error ? err.message : 'Failed to open folder')
      }
    } finally {
      setSelecting(false)
    }
  }

  // Web: connect to FastAPI backend (existing WebVaultFS)
  const handleBackendConnect = () => {
    // WebVaultFS is the default — just set a vault root and proceed
    setVaultRoot('web-backend')
    onComplete('web-backend')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="mx-auto max-w-md px-6 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <FolderOpen className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Long Term Memory</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isNativeApp
            ? 'Select your Obsidian vault folder to get started. LTM will read and write files directly in your vault.'
            : 'Choose how to connect to your vault.'}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {/* Native app: single button */}
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

          {/* Browser: File System Access API option */}
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

          {/* Web: backend connection option */}
          {hasBackendOption && (
            <Button
              size="lg"
              variant={hasBrowserFS ? 'outline' : 'default'}
              onClick={handleBackendConnect}
              disabled={selecting}
            >
              <Server className="mr-2 h-4 w-4" />
              Connect to Backend
            </Button>
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
