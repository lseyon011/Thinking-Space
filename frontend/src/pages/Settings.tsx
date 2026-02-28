import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import SettingsOrch, { type SettingsTabId } from '@/components/orchestrators/SettingsOrch'
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
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const initialTab: SettingsTabId = requestedTab === 'ai'
    ? 'ai'
    : (requestedTab === 'f9'
      ? 'f9'
    : (requestedTab === 'cache'
      ? 'cache'
      : (requestedTab === 'vault' ? 'vault' : 'theme')))

  return (
    <div className="ltm-page">
      <div className="ltm-page-shell ltm-shell-wide space-y-4">
        <header className="shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <SlidersHorizontal className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Manage theme, markdown editor behavior, AI configuration, F9 execution storage, cache reset, and vault switching.
              </p>
            </div>
          </div>
        </header>
        <SettingsOrch
          explorerIconStyle={explorerIconStyle}
          onExplorerIconStyleChange={onExplorerIconStyleChange}
          onRequestVaultSwitch={onRequestVaultSwitch}
          initialTab={initialTab}
        />
      </div>
    </div>
  )
}
