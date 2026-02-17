import { useState } from 'react'
import { FolderOpen, Check } from 'lucide-react'
import { Button } from '@/components/lego_blocks/ui/button'
import { selectAndSetVaultRoot } from '@/services/orchestrators/runtimeOrch'

interface Props {
  onComplete: (vaultRoot: string) => void
}

export default function VaultSetup({ onComplete }: Props) {
  const [selecting, setSelecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = async () => {
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

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="mx-auto max-w-md px-6 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <FolderOpen className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Long Term Memory</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Select your Obsidian vault folder to get started. LTM will read and write
          files directly in your vault.
        </p>
        <Button
          className="mt-6"
          size="lg"
          onClick={handleSelect}
          disabled={selecting}
        >
          {selecting ? (
            'Selecting...'
          ) : (
            <>
              <FolderOpen className="mr-2 h-4 w-4" />
              Select Vault Folder
            </>
          )}
        </Button>
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
        </div>
      </div>
    </div>
  )
}
