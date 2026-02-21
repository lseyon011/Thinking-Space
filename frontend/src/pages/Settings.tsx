import { Link } from 'react-router-dom'
import { ArrowLeft, SlidersHorizontal } from 'lucide-react'
import SettingsOrch from '@/components/orchestrators/SettingsOrch'
import type { ExplorerIconStyleBlock } from '@/services/orchestrators/vaultUiPreferencesOrch'

interface SettingsPageProps {
  explorerIconStyle: ExplorerIconStyleBlock
  onExplorerIconStyleChange: (nextStyle: ExplorerIconStyleBlock) => void
  onRequestVaultSwitch: () => void
}

export default function Settings({
  explorerIconStyle,
  onExplorerIconStyleChange,
  onRequestVaultSwitch,
}: SettingsPageProps) {
  return (
    <div className="ltm-page">
      <div className="ltm-page-shell ltm-shell-wide space-y-4">
        <header className="shrink-0">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <SlidersHorizontal className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Manage theme, local cache reset, and vault switching.
              </p>
            </div>
          </div>
        </header>
        <SettingsOrch
          explorerIconStyle={explorerIconStyle}
          onExplorerIconStyleChange={onExplorerIconStyleChange}
          onRequestVaultSwitch={onRequestVaultSwitch}
        />
      </div>
    </div>
  )
}
