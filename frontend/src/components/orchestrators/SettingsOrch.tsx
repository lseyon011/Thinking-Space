import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/lego_blocks/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/ui/card'
import { Switch } from '@/components/lego_blocks/ui/switch'
import AiSettingsOrch from '@/components/orchestrators/AiSettingsOrch'
import { UI_THEME_OPTIONS_BLOCK, useUIThemeBlock } from '@/components/lego_blocks/UIThemeBlock'
import { clearAppCacheOrch, hardRefreshOrch } from '@/services/orchestrators/appCacheOrch'
import {
  readMarkdownEditorSettingsOrch,
  writeMarkdownEditorSettingsOrch,
  type MarkdownEditorSettingsBlock,
} from '@/services/orchestrators/markdownEditorSettingsOrch'
import { isCapacitorNative, isElectron } from '@/services/orchestrators/runtimeOrch'
import type { ExplorerIconStyleBlock } from '@/services/orchestrators/vaultUiPreferencesOrch'
import type { UIThemeId } from '@/services/orchestrators/uiThemeOrch'

export type SettingsTabId = 'theme' | 'ai' | 'cache' | 'vault'

interface SettingsOrchProps {
  explorerIconStyle: ExplorerIconStyleBlock
  onExplorerIconStyleChange: (nextStyle: ExplorerIconStyleBlock) => void
  onRequestVaultSwitch: () => void
  initialTab?: SettingsTabId
}

const TAB_OPTIONS: Array<{ id: SettingsTabId; label: string }> = [
  { id: 'theme', label: 'Theme' },
  { id: 'ai', label: 'AI' },
  { id: 'cache', label: 'Clear Cache' },
  { id: 'vault', label: 'Select Vault' },
]

export default function SettingsOrch({
  explorerIconStyle,
  onExplorerIconStyleChange,
  onRequestVaultSwitch,
  initialTab = 'theme',
}: SettingsOrchProps) {
  const { themeId, setThemeId } = useUIThemeBlock()
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab)
  const [markdownEditorSettings, setMarkdownEditorSettings] = useState<MarkdownEditorSettingsBlock>(
    () => readMarkdownEditorSettingsOrch(),
  )
  const [busyAction, setBusyAction] = useState<SettingsTabId | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const runtimeLabel = useMemo(() => {
    if (isElectron()) return 'desktop'
    if (isCapacitorNative()) return 'mobile'
    return 'web'
  }, [])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const onClearCache = async () => {
    const confirmed = window.confirm('Clear local cache and hard refresh now?')
    if (!confirmed) return
    setBusyAction('cache')
    setError(null)
    setMessage(null)
    try {
      await clearAppCacheOrch({ preserveVaultRoot: true })
      hardRefreshOrch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cache')
    } finally {
      setBusyAction(null)
    }
  }

  const onSwitchVault = () => {
    const confirmed = window.confirm('Open vault selector and hard refresh after selecting a vault?')
    if (!confirmed) return
    setError(null)
    setMessage('Opening vault selector...')
    onRequestVaultSwitch()
  }

  const updateMarkdownEditorSettings = (nextSettings: MarkdownEditorSettingsBlock) => {
    setMarkdownEditorSettings(nextSettings)
    writeMarkdownEditorSettingsOrch(nextSettings)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TAB_OPTIONS.map(tab => (
          <Button
            key={tab.id}
            type="button"
            variant={activeTab === tab.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'theme' && (
        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Personalize the interface look and explorer icon style.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="ltm-settings-theme-select" className="text-sm font-medium">
                App Theme
              </label>
              <select
                id="ltm-settings-theme-select"
                value={themeId}
                onChange={(event) => setThemeId(event.target.value as UIThemeId)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
              >
                {UI_THEME_OPTIONS_BLOCK.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="ltm-settings-explorer-icon-style-select" className="text-sm font-medium">
                Explorer Icon Style
              </label>
              <select
                id="ltm-settings-explorer-icon-style-select"
                value={explorerIconStyle}
                onChange={(event) => onExplorerIconStyleChange(event.target.value as ExplorerIconStyleBlock)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
              >
                <option value="outline">Outline</option>
                <option value="filled">Filled</option>
              </select>
            </div>
            <div className="space-y-2 border-t border-border/50 pt-4">
              <h3 className="text-sm font-medium text-foreground">Markdown Editor</h3>
              <p className="text-xs text-muted-foreground">
                Configure how markdown is displayed in view mode.
              </p>
              <label className="flex items-center justify-between gap-4 rounded-md border border-border/60 px-3 py-2.5">
                <div className="space-y-0.5">
                  <div className="text-sm text-foreground">Preserve spaces in view mode</div>
                  <div className="text-xs text-muted-foreground">Keeps repeated and trailing spaces visible.</div>
                </div>
                <Switch
                  checked={markdownEditorSettings.preserveSpacesInViewMode}
                  onCheckedChange={(checked) => updateMarkdownEditorSettings({
                    ...markdownEditorSettings,
                    preserveSpacesInViewMode: checked,
                  })}
                  aria-label="Preserve spaces in view mode"
                />
              </label>
              <label className="flex items-center justify-between gap-4 rounded-md border border-border/60 px-3 py-2.5">
                <div className="space-y-0.5">
                  <div className="text-sm text-foreground">Preserve new lines in view mode</div>
                  <div className="text-xs text-muted-foreground">Renders soft line breaks as visible line breaks.</div>
                </div>
                <Switch
                  checked={markdownEditorSettings.preserveNewlinesInViewMode}
                  onCheckedChange={(checked) => updateMarkdownEditorSettings({
                    ...markdownEditorSettings,
                    preserveNewlinesInViewMode: checked,
                  })}
                  aria-label="Preserve new lines in view mode"
                />
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'ai' && (
        <AiSettingsOrch />
      )}

      {activeTab === 'cache' && (
        <Card>
          <CardHeader>
            <CardTitle>Clear Cache</CardTitle>
            <CardDescription>
              Clears local app cache (IndexedDB + local settings cache) and reloads the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Vault selection is preserved, but local caches will be rebuilt after refresh.
            </p>
            <Button type="button" onClick={onClearCache} disabled={busyAction === 'cache'}>
              {busyAction === 'cache' ? 'Clearing cache...' : 'Clear Cache + Hard Refresh'}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'vault' && (
        <Card>
          <CardHeader>
            <CardTitle>Select Vault</CardTitle>
            <CardDescription>
              Open the vault selector for this {runtimeLabel} runtime and hard refresh after selection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use this if you want to switch to a different vault or recover from stale vault context.
            </p>
            <Button type="button" onClick={onSwitchVault}>
              Open Vault Selector
            </Button>
          </CardContent>
        </Card>
      )}

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
