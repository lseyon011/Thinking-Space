import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import { Switch } from '@/components/lego_blocks/units/ui/switch'
import AiSettingsOrch from '@/components/orchestrators/AiSettingsOrch'
import { useUserProfileBlock } from '@/components/lego_blocks/hooks/shared/useUserProfileBlock'
import { UI_COLOR_MODE_OPTIONS_BLOCK, UI_THEME_OPTIONS_BLOCK, useUIThemeBlock } from '@/components/lego_blocks/units/UIThemeBlock'
import { USER_PROFILE_FILE_PATH_BLOCK, deriveUserProfileSymbolBlock } from '@/services/lego_blocks/units/userProfileBlock'
import { clearAppCacheOrch, hardRefreshOrch } from '@/services/orchestrators/appCacheOrch'
import {
  readMarkdownEditorSettingsOrch,
  writeMarkdownEditorSettingsOrch,
  type MarkdownEditorSettingsBlock,
} from '@/services/orchestrators/markdownEditorSettingsOrch'
import { isCapacitorNative, isElectron } from '@/services/orchestrators/runtimeOrch'
import {
  getDefaultF9ExecutionSettingsOrch,
  readF9ExecutionSettingsOrch,
  writeF9ExecutionSettingsOrch,
} from '@/personal_extension/services/orchestrators/f9ExecutionSettingsOrch'
import {
  clearF9WebullCredentialsBlock,
  readF9WebullCredentialStatusBlock,
  saveF9WebullCredentialsBlock,
} from '@/personal_extension/services/lego_blocks/units/f9WebullConfigBlock'
import {
  clearGoogleDriveAuthOrch,
  connectGoogleDriveAuthOrch,
  getGoogleOauthClientIdOrch,
  readGoogleDriveAuthOrch,
  setGoogleOauthClientIdOrch,
} from '@/services/orchestrators/googleDriveAuthOrch'
import {
  DEFAULT_EXPLORER_FOLDER_COLOR_PRESET_BLOCK,
  type ExplorerFolderColorPreferenceBlock,
  type ExplorerIconStyleBlock,
} from '@/services/orchestrators/vaultUiPreferencesOrch'
import {
  addRssFeedOrch,
  addRssFeedGroupOrch,
  getRssRetentionDaysOrch,
  readRssFeedPreferencesOrch,
  removeRssFeedOrch,
  removeRssFeedGroupOrch,
  setRssRetentionDaysOrch,
  updateRssFeedOrch,
  updateRssFeedGroupOrch,
  updateRssPresetTagsOrch,
} from '@/services/orchestrators/rssFeedOrch'
import type { RssFeedPreferencesBlock } from '@/services/lego_blocks/units/rssFeedBlock'
import {
  splitTagInputBlock,
  tagColorClassBlock,
  tagColorStyleBlock,
  tagLookupKeyBlock,
} from '@/services/lego_blocks/units/tagBlock'
import {
  addAiWebsiteOrch,
  readAiWebsitesOrch,
  removeAiWebsiteOrch,
  updateAiWebsiteOrch,
} from '@/services/orchestrators/aiWebsiteOrch'
import type { AiWebsiteBlock } from '@/services/lego_blocks/units/aiWebsiteBlock'
import {
  addWebSiteOrch,
  addWebSiteGroupOrch,
  readWebSitePreferencesOrch,
  removeWebSiteOrch,
  removeWebSiteGroupOrch,
  updateWebSiteOrch,
  updateWebSiteGroupOrch,
} from '@/services/orchestrators/webSiteOrch'
import type { WebSitePreferencesBlock } from '@/services/lego_blocks/units/webSiteBlock'
import DeveloperSetupBlock from '@/components/lego_blocks/integrations/DeveloperSetupBlock'

export type SettingsTabId = 'theme' | 'explorer' | 'ai' | 'ai_websites' | 'web_bookmarks' | 'google_docs_sheets' | 'f9' | 'rss' | 'cache' | 'vault' | 'about' | 'developer'
export type SettingsTabWithProfileId = SettingsTabId | 'profile'

interface SettingsOrchProps {
  explorerIconStyle: ExplorerIconStyleBlock
  onExplorerIconStyleChange: (nextStyle: ExplorerIconStyleBlock) => void
  explorerFolderColorRules: ExplorerFolderColorPreferenceBlock[]
  onExplorerFolderColorRulesChange: (nextRules: ExplorerFolderColorPreferenceBlock[]) => Promise<void> | void
  onRequestVaultSwitch: () => void
  initialTab?: SettingsTabWithProfileId
  f9TabLabel?: string
  f9TabIconText?: string
  onF9TabPreferencesChange?: (label: string, iconText: string) => Promise<void> | void
}

function createExplorerColorRuleId(): string {
  return `explorer-color-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeExplorerFolderPathInput(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function createExplorerRuleKey(rule: Pick<ExplorerFolderColorPreferenceBlock, 'folderPath' | 'includeDescendants'>): string {
  return `${normalizeExplorerFolderPathInput(rule.folderPath)}::${rule.includeDescendants ? 'all' : 'single'}`
}

const TAB_OPTIONS: Array<{ id: SettingsTabWithProfileId; label: string }> = [
  { id: 'theme', label: 'Theme' },
  { id: 'explorer', label: 'Explorer' },
  { id: 'profile', label: 'Profile' },
  { id: 'ai', label: 'AI' },
  { id: 'ai_websites', label: 'AI Websites' },
  { id: 'web_bookmarks', label: 'Web' },
  { id: 'google_docs_sheets', label: 'Google Docs and Sheets' },
  { id: 'f9', label: 'Webull' },
  { id: 'rss', label: 'RSS Feeds' },
  { id: 'cache', label: 'Clear Cache' },
  { id: 'vault', label: 'Select Thinking Space' },
  { id: 'about', label: 'About' },
  { id: 'developer', label: 'Developer' },
]

export default function SettingsOrch({
  explorerIconStyle,
  onExplorerIconStyleChange,
  explorerFolderColorRules,
  onExplorerFolderColorRulesChange,
  onRequestVaultSwitch,
  initialTab = 'theme',
  f9TabLabel: f9TabLabelProp = 'Webull',
  f9TabIconText: f9TabIconTextProp = '',
  onF9TabPreferencesChange,
}: SettingsOrchProps) {
  const { profile, loading: profileLoading, saveProfile, reloadProfile } = useUserProfileBlock()
  const { colorModeId, setColorModeId, themeId } = useUIThemeBlock()
  const [activeTab, setActiveTab] = useState<SettingsTabWithProfileId>(initialTab)
  const [markdownEditorSettings, setMarkdownEditorSettings] = useState<MarkdownEditorSettingsBlock>(
    () => readMarkdownEditorSettingsOrch(),
  )
  const [f9ExecutionFolderPathInput, setF9ExecutionFolderPathInput] = useState<string>('')
  const [f9SavedExecutionFolderPath, setF9SavedExecutionFolderPath] = useState<string>('')
  const [f9WebullAppKeyInput, setF9WebullAppKeyInput] = useState('')
  const [f9WebullAppSecretInput, setF9WebullAppSecretInput] = useState('')
  const [f9WebullCredentialsConfigured, setF9WebullCredentialsConfigured] = useState(false)
  const [f9WebullAppKeyHint, setF9WebullAppKeyHint] = useState<string | null>(null)
  const [f9WebullSecureStorageAvailable, setF9WebullSecureStorageAvailable] = useState(false)
  const [f9TabLabelInput, setF9TabLabelInput] = useState(f9TabLabelProp)
  const [f9TabIconTextInput, setF9TabIconTextInput] = useState(f9TabIconTextProp)
  const [googleOauthClientIdInput, setGoogleOauthClientIdInput] = useState(() => getGoogleOauthClientIdOrch() ?? '')
  const [googleDriveConnected, setGoogleDriveConnected] = useState(() => Boolean(readGoogleDriveAuthOrch()?.accessToken))
  const [googleDriveAuthBusy, setGoogleDriveAuthBusy] = useState(false)
  const [busyAction, setBusyAction] = useState<SettingsTabId | null>(null)
  const [explorerFolderColorRulesDraft, setExplorerFolderColorRulesDraft] = useState<ExplorerFolderColorPreferenceBlock[]>(
    () => explorerFolderColorRules,
  )
  const [explorerRulesDirty, setExplorerRulesDirty] = useState(false)
  const [profileNameInput, setProfileNameInput] = useState('')
  const [profileSymbolInput, setProfileSymbolInput] = useState('')
  const [profileMemoriesInput, setProfileMemoriesInput] = useState('')
  const [profileDirty, setProfileDirty] = useState(false)
  const [busyProfileSave, setBusyProfileSave] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const runtimeLabel = useMemo(() => {
    if (isElectron()) return 'desktop'
    if (isCapacitorNative()) return 'mobile'
    return 'web'
  }, [])
  const f9CredentialEditingSupported = isElectron()

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    setF9TabLabelInput(f9TabLabelProp)
    setF9TabIconTextInput(f9TabIconTextProp)
  }, [f9TabLabelProp, f9TabIconTextProp])

  useEffect(() => {
    let cancelled = false
    if (activeTab !== 'f9') return
    void readF9WebullCredentialStatusBlock()
      .then((status) => {
        if (cancelled) return
        setF9WebullCredentialsConfigured(status.configured)
        setF9WebullAppKeyHint(status.appKeyHint)
        setF9WebullSecureStorageAvailable(status.secureStorageAvailable)
      })
      .catch(() => {
        if (cancelled) return
        setF9WebullCredentialsConfigured(false)
        setF9WebullAppKeyHint(null)
        setF9WebullSecureStorageAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab])

  useEffect(() => {
    setProfileNameInput(profile.name)
    setProfileSymbolInput(profile.symbol)
    setProfileMemoriesInput(profile.memories.join('\n'))
    setProfileDirty(false)
  }, [profile])

  useEffect(() => {
    setExplorerFolderColorRulesDraft(explorerFolderColorRules)
    setExplorerRulesDirty(false)
  }, [explorerFolderColorRules])

  useEffect(() => {
    let cancelled = false
    void readF9ExecutionSettingsOrch()
      .then((settings) => {
        if (cancelled) return
        setF9ExecutionFolderPathInput(settings.executionFolderPath)
        setF9SavedExecutionFolderPath(settings.executionFolderPath)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load F9 settings')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onSaveProfile = async () => {
    const normalizedName = profileNameInput.trim()
    if (!normalizedName) {
      setError('Profile name cannot be empty.')
      return
    }
    const memories = profileMemoriesInput
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
    setBusyProfileSave(true)
    setError(null)
    setMessage(null)
    try {
      await saveProfile({
        name: normalizedName,
        symbol: profileSymbolInput.trim(),
        memories,
      })
      setMessage('Profile saved.')
      setProfileDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setBusyProfileSave(false)
    }
  }

  const onReloadProfile = async () => {
    setBusyProfileSave(true)
    setError(null)
    setMessage(null)
    try {
      await reloadProfile()
      setMessage('Profile reloaded from Thinking Space.')
      setProfileDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reload profile')
    } finally {
      setBusyProfileSave(false)
    }
  }

  const onClearCache = async () => {
    const confirmed = window.confirm('Clear local cache and reload the app now?')
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
    const confirmed = window.confirm('Open Thinking Space folder selector and reload after selection?')
    if (!confirmed) return
    setError(null)
    setMessage('Opening Thinking Space selector...')
    onRequestVaultSwitch()
  }

  const updateMarkdownEditorSettings = (nextSettings: MarkdownEditorSettingsBlock) => {
    setMarkdownEditorSettings(nextSettings)
    writeMarkdownEditorSettingsOrch(nextSettings)
  }

  const onSaveF9TabPreferences = async () => {
    if (!onF9TabPreferencesChange) return
    setBusyAction('f9')
    setError(null)
    setMessage(null)
    try {
      await onF9TabPreferencesChange(f9TabLabelInput, f9TabIconTextInput)
      setMessage('Tab label and icon saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tab preferences')
    } finally {
      setBusyAction(null)
    }
  }

  const onSaveF9Settings = async () => {
    const normalized = f9ExecutionFolderPathInput.trim()
    setBusyAction('f9')
    setError(null)
    setMessage(null)
    try {
      const saved = await writeF9ExecutionSettingsOrch({ executionFolderPath: normalized })
      setF9ExecutionFolderPathInput(saved.executionFolderPath)
      setF9SavedExecutionFolderPath(saved.executionFolderPath)
      setMessage(saved.executionFolderPath
        ? 'F9 execution folder path saved.'
        : 'F9 execution folder path cleared. Execution file sync is disabled until a path is set.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save F9 settings')
    } finally {
      setBusyAction(null)
    }
  }

  const onResetF9Settings = async () => {
    setBusyAction('f9')
    setError(null)
    setMessage(null)
    try {
      const defaults = getDefaultF9ExecutionSettingsOrch()
      const saved = await writeF9ExecutionSettingsOrch(defaults)
      setF9ExecutionFolderPathInput(saved.executionFolderPath)
      setF9SavedExecutionFolderPath(saved.executionFolderPath)
      setMessage('F9 execution folder path reset to default (not configured).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset F9 settings')
    } finally {
      setBusyAction(null)
    }
  }

  const onSaveF9WebullCredentials = async () => {
    if (!f9CredentialEditingSupported) {
      setError('Webull secure credentials are currently supported only in Electron desktop runtime.')
      return
    }
    const appKey = f9WebullAppKeyInput.trim()
    const appSecret = f9WebullAppSecretInput.trim()
    if (!appKey) {
      setError('Webull app key cannot be empty.')
      return
    }
    if (!appSecret) {
      setError('Webull app secret cannot be empty.')
      return
    }
    setBusyAction('f9')
    setError(null)
    setMessage(null)
    try {
      const status = await saveF9WebullCredentialsBlock({ appKey, appSecret })
      setF9WebullCredentialsConfigured(status.configured)
      setF9WebullAppKeyHint(status.appKeyHint)
      setF9WebullSecureStorageAvailable(status.secureStorageAvailable)
      setF9WebullAppSecretInput('')
      setMessage('Webull credentials saved to secure device storage.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Webull credentials')
    } finally {
      setBusyAction(null)
    }
  }

  const refreshGoogleDriveAuthState = () => {
    setGoogleDriveConnected(Boolean(readGoogleDriveAuthOrch()?.accessToken))
  }

  const onSaveGoogleOauthClientId = () => {
    setError(null)
    setMessage(null)
    const normalized = googleOauthClientIdInput.trim()
    setGoogleOauthClientIdOrch(normalized)
    setMessage(normalized ? 'Google OAuth client ID saved.' : 'Google OAuth client ID cleared.')
  }

  const onConnectGoogleDrive = async () => {
    const typedClientId = googleOauthClientIdInput.trim()
    const resolvedClientId = typedClientId || getGoogleOauthClientIdOrch() || ''
    if (!resolvedClientId) {
      setError('Google OAuth client ID is required. Add it in this tab before connecting.')
      return
    }
    setGoogleDriveAuthBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (typedClientId) {
        setGoogleOauthClientIdOrch(typedClientId)
      }
      await connectGoogleDriveAuthOrch({ clientId: resolvedClientId })
      refreshGoogleDriveAuthState()
      setMessage('Google Drive connected.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      refreshGoogleDriveAuthState()
    } finally {
      setGoogleDriveAuthBusy(false)
    }
  }

  const onDisconnectGoogleDrive = () => {
    setError(null)
    setMessage(null)
    clearGoogleDriveAuthOrch()
    refreshGoogleDriveAuthState()
    setMessage('Google Drive disconnected.')
  }

  const onClearF9WebullCredentials = async () => {
    if (!f9CredentialEditingSupported) {
      setError('Webull secure credentials are currently supported only in Electron desktop runtime.')
      return
    }
    setBusyAction('f9')
    setError(null)
    setMessage(null)
    try {
      const status = await clearF9WebullCredentialsBlock()
      setF9WebullCredentialsConfigured(status.configured)
      setF9WebullAppKeyHint(status.appKeyHint)
      setF9WebullSecureStorageAvailable(status.secureStorageAvailable)
      setF9WebullAppKeyInput('')
      setF9WebullAppSecretInput('')
      setMessage('Webull credentials cleared from secure device storage.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear Webull credentials')
    } finally {
      setBusyAction(null)
    }
  }

  const onAddExplorerColorRule = () => {
    setExplorerFolderColorRulesDraft((prev) => [
      ...prev,
      {
        id: createExplorerColorRuleId(),
        folderPath: '',
        color: '#6aaafa',
        includeDescendants: true,
      },
    ])
    setExplorerRulesDirty(true)
    setMessage(null)
    setError(null)
  }

  const onUpdateExplorerColorRule = (
    ruleId: string,
    patch: Partial<ExplorerFolderColorPreferenceBlock>,
  ) => {
    setExplorerFolderColorRulesDraft((prev) => prev.map((rule) => {
      if (rule.id !== ruleId) return rule
      return { ...rule, ...patch }
    }))
    setExplorerRulesDirty(true)
    setMessage(null)
    setError(null)
  }

  const onRemoveExplorerColorRule = (ruleId: string) => {
    setExplorerFolderColorRulesDraft((prev) => prev.filter((rule) => rule.id !== ruleId))
    setExplorerRulesDirty(true)
    setMessage(null)
    setError(null)
  }

  const onResetExplorerColorRules = () => {
    setExplorerFolderColorRulesDraft(explorerFolderColorRules)
    setExplorerRulesDirty(false)
    setMessage('Explorer color rules reset to saved values.')
    setError(null)
  }

  const onLoadLegacyExplorerColorRules = () => {
    setExplorerFolderColorRulesDraft((prev) => {
      const merged = [...prev]
      const indexByKey = new Map<string, number>()
      merged.forEach((rule, index) => {
        indexByKey.set(createExplorerRuleKey(rule), index)
      })
      DEFAULT_EXPLORER_FOLDER_COLOR_PRESET_BLOCK.forEach((preset) => {
        const key = createExplorerRuleKey(preset)
        const foundIndex = indexByKey.get(key)
        if (foundIndex == null) {
          merged.push({
            ...preset,
          })
          indexByKey.set(key, merged.length - 1)
          return
        }
        merged[foundIndex] = {
          ...merged[foundIndex],
          color: preset.color,
        }
      })
      return merged
    })
    setExplorerRulesDirty(true)
    setMessage('Legacy explorer color preset loaded. Save Explorer Settings to persist.')
    setError(null)
  }

  const onSaveExplorerColorRules = async () => {
    const sanitized = explorerFolderColorRulesDraft
      .map((rule) => ({
        ...rule,
        folderPath: normalizeExplorerFolderPathInput(rule.folderPath),
      }))
      .filter((rule) => rule.folderPath.length > 0)
    setBusyAction('explorer')
    setMessage(null)
    setError(null)
    try {
      await onExplorerFolderColorRulesChange(sanitized)
      setExplorerRulesDirty(false)
      setMessage('Explorer settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save explorer settings')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-6">
      <aside className="self-start">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-2">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Sections
          </p>
          <div className="space-y-1">
            {TAB_OPTIONS.map(tab => (
              <Button
                key={tab.id}
                type="button"
                variant={activeTab === tab.id ? 'default' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </aside>

      <div className="space-y-4 min-w-0">
      {activeTab === 'theme' && (
        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Thinking Space currently ships with one interface theme and selectable light or dark overall color modes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {UI_THEME_OPTIONS_BLOCK
                .filter((option) => option.id === themeId)
                .map((option) => (
                  <div key={option.id} className="rounded-md border border-border/60 bg-background px-3 py-3">
                    <div className="text-sm font-medium text-foreground">{option.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
                  </div>
                ))}
            </div>
            <div className="space-y-2 border-t border-border/50 pt-4">
              <label htmlFor="ltm-settings-color-mode-select" className="text-sm font-medium">
                Overall Color Mode
              </label>
              <select
                id="ltm-settings-color-mode-select"
                value={colorModeId}
                onChange={(event) => setColorModeId(event.target.value as typeof colorModeId)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
              >
                {UI_COLOR_MODE_OPTIONS_BLOCK.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {UI_COLOR_MODE_OPTIONS_BLOCK.find((option) => option.id === colorModeId)?.description}
              </p>
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

      {activeTab === 'explorer' && (
        <Card>
          <CardHeader>
            <CardTitle>Explorer</CardTitle>
            <CardDescription>
              Configure explorer icon style and custom folder color rules (saved in Thinking Space UI preferences).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div className="space-y-2 border-t border-border/60 pt-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground">Folder Color Rules</h3>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={onLoadLegacyExplorerColorRules}>
                    Load Legacy Preset
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={onAddExplorerColorRule}>
                    Add Rule
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Each rule colors a folder icon by relative path. Enable descendants to apply the color to nested folders.
              </p>

              <div className="space-y-2">
                {explorerFolderColorRulesDraft.length === 0 && (
                  <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                    No custom rules yet. Add one to color explorer folders.
                  </div>
                )}
                {explorerFolderColorRulesDraft.map((rule) => (
                  <div key={rule.id} className="grid gap-2 rounded-md border border-border/60 p-2 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Folder Path</label>
                      <input
                        type="text"
                        value={rule.folderPath}
                        onChange={(event) => onUpdateExplorerColorRule(rule.id, { folderPath: event.target.value })}
                        placeholder="example/folder/path"
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-ring"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">Color</label>
                      <input
                        type="color"
                        value={rule.color}
                        onChange={(event) => onUpdateExplorerColorRule(rule.id, { color: event.target.value })}
                        className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-1"
                        aria-label={`Color for ${rule.folderPath || 'new rule'}`}
                      />
                    </div>
                    <label className="inline-flex h-9 items-center gap-2 text-xs text-foreground">
                      <input
                        type="checkbox"
                        checked={rule.includeDescendants}
                        onChange={(event) => onUpdateExplorerColorRule(rule.id, { includeDescendants: event.target.checked })}
                        className="h-4 w-4"
                      />
                      Descendants
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => onRemoveExplorerColorRule(rule.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => { void onSaveExplorerColorRules() }}
                disabled={busyAction === 'explorer' || !explorerRulesDirty}
              >
                {busyAction === 'explorer' ? 'Saving...' : 'Save Explorer Settings'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onResetExplorerColorRules}
                disabled={busyAction === 'explorer' || !explorerRulesDirty}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Your profile is stored in your Thinking Space folder at <span className="font-mono">{USER_PROFILE_FILE_PATH_BLOCK}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="ltm-settings-profile-name" className="text-sm font-medium">
                Name
              </label>
              <input
                id="ltm-settings-profile-name"
                type="text"
                value={profileNameInput}
                onChange={(event) => {
                  setProfileNameInput(event.target.value)
                  setProfileDirty(true)
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="ltm-settings-profile-symbol" className="text-sm font-medium">
                Profile Symbol
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="ltm-settings-profile-symbol"
                  type="text"
                  value={profileSymbolInput}
                  onChange={(event) => {
                    setProfileSymbolInput(event.target.value)
                    setProfileDirty(true)
                  }}
                  placeholder={deriveUserProfileSymbolBlock(profileNameInput)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
                />
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/25 text-sm font-semibold text-foreground">
                  {profileSymbolInput.trim() || deriveUserProfileSymbolBlock(profileNameInput)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="ltm-settings-profile-memories" className="text-sm font-medium">
                AI Memories
              </label>
              <textarea
                id="ltm-settings-profile-memories"
                value={profileMemoriesInput}
                onChange={(event) => {
                  setProfileMemoriesInput(event.target.value)
                  setProfileDirty(true)
                }}
                placeholder="One memory per line. AI can append to these later."
                className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              />
              <p className="text-xs text-muted-foreground">
                {profileLoading ? 'Loading profile…' : 'Memories are stored as plain text lines in your profile.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={onSaveProfile}
                disabled={busyProfileSave || (!profileDirty && !profileLoading)}
              >
                {busyProfileSave ? 'Saving...' : 'Save Profile'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { void onReloadProfile() }}
                disabled={busyProfileSave}
              >
                Reload from Thinking Space
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'ai' && (
        <AiSettingsOrch />
      )}

      {activeTab === 'ai_websites' && (
        <AiWebsitesSettingsSection />
      )}

      {activeTab === 'web_bookmarks' && <WebSettingsSection />}

      {activeTab === 'google_docs_sheets' && (
        <Card>
          <CardHeader>
            <CardTitle>Google Docs and Sheets</CardTitle>
            <CardDescription>
              Optional setup for Drive picker. Opening/editing Docs and Sheets works from the in-app Google view without this.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Sign in once inside a Google Doc/Sheet view and that session is reused. Add OAuth client ID only if you want Pick from Drive.
            </p>
            <div className="space-y-2">
              <label htmlFor="ltm-settings-google-oauth-client-id" className="text-sm font-medium">
                Google OAuth Client ID
              </label>
              <input
                id="ltm-settings-google-oauth-client-id"
                type="text"
                value={googleOauthClientIdInput}
                onChange={(event) => setGoogleOauthClientIdInput(event.target.value)}
                placeholder="1234567890-xxxx.apps.googleusercontent.com"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
              />
              <p className="text-xs text-muted-foreground">
                Required only for Connect Google / Pick from Drive. The placeholder is an example format.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Drive picker status: {googleDriveConnected ? 'connected' : 'not connected'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onSaveGoogleOauthClientId}
              >
                Save Client ID
              </Button>
              <Button
                type="button"
                onClick={() => { void onConnectGoogleDrive() }}
                disabled={googleDriveAuthBusy}
              >
                {googleDriveAuthBusy ? 'Connecting...' : 'Connect Google'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onDisconnectGoogleDrive}
                disabled={googleDriveAuthBusy || !googleDriveConnected}
              >
                Disconnect Google
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'f9' && (
        <Card>
          <CardHeader>
            <CardTitle>F9 Settings</CardTitle>
            <CardDescription>
              Configure the tab name, icon, Webull credentials, and execution storage for F9.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <h3 className="text-sm font-medium text-foreground">Tab Appearance</h3>
              <p className="text-xs text-muted-foreground">
                Customize the label and icon shown in the sidebar and tab strip. Changes sync across devices via your vault.
              </p>
              <div className="space-y-2">
                <label htmlFor="ltm-settings-f9-tab-label" className="text-sm font-medium">
                  Tab Label
                </label>
                <input
                  id="ltm-settings-f9-tab-label"
                  type="text"
                  value={f9TabLabelInput}
                  onChange={(event) => setF9TabLabelInput(event.target.value)}
                  placeholder="Webull"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="ltm-settings-f9-tab-icon" className="text-sm font-medium">
                  Tab Icon (text or emoji)
                </label>
                <input
                  id="ltm-settings-f9-tab-icon"
                  type="text"
                  value={f9TabIconTextInput}
                  onChange={(event) => setF9TabIconTextInput(event.target.value)}
                  placeholder="Leave blank for Webull crescent icon"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the default Webull crescent icon, or enter text/emoji (e.g. 📈, W).
                </p>
              </div>
              <Button
                type="button"
                onClick={() => { void onSaveF9TabPreferences() }}
                disabled={busyAction === 'f9' || !onF9TabPreferencesChange}
              >
                {busyAction === 'f9' ? 'Saving...' : 'Save Tab Appearance'}
              </Button>
            </div>
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <h3 className="text-sm font-medium text-foreground">Webull API Credentials</h3>
              {!f9CredentialEditingSupported && (
                <p className="text-xs text-muted-foreground">
                  Secure credential entry is currently available only in the Electron desktop app.
                </p>
              )}
              {f9CredentialEditingSupported && !f9WebullSecureStorageAvailable && (
                <p className="text-xs text-destructive">
                  Secure storage is unavailable on this device/runtime. Webull credentials cannot be saved safely.
                </p>
              )}
              <div className="space-y-2">
                <label htmlFor="ltm-settings-f9-webull-app-key" className="text-sm font-medium">
                  Webull App Key
                </label>
                <input
                  id="ltm-settings-f9-webull-app-key"
                  type="text"
                  value={f9WebullAppKeyInput}
                  onChange={(event) => setF9WebullAppKeyInput(event.target.value)}
                  placeholder="Enter app key"
                  disabled={!f9CredentialEditingSupported}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="ltm-settings-f9-webull-app-secret" className="text-sm font-medium">
                  Webull App Secret
                </label>
                <input
                  id="ltm-settings-f9-webull-app-secret"
                  type="password"
                  value={f9WebullAppSecretInput}
                  onChange={(event) => setF9WebullAppSecretInput(event.target.value)}
                  placeholder="Enter app secret"
                  disabled={!f9CredentialEditingSupported}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Current status: {f9WebullCredentialsConfigured ? `configured (${f9WebullAppKeyHint ?? 'saved'})` : 'not configured'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => { void onSaveF9WebullCredentials() }}
                  disabled={busyAction === 'f9' || !f9CredentialEditingSupported}
                >
                  {busyAction === 'f9' ? 'Saving...' : 'Save Credentials'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { void onClearF9WebullCredentials() }}
                  disabled={busyAction === 'f9' || !f9CredentialEditingSupported || !f9WebullCredentialsConfigured}
                >
                  Clear Credentials
                </Button>
              </div>
            </div>

            <div className="space-y-2 border-t border-border/60 pt-3">
              <h3 className="text-sm font-medium text-foreground">Execution Storage</h3>
              <p className="text-xs text-muted-foreground">
                Configure where F9 stores `overall.json`, company index files, and per-position markdown files.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="ltm-settings-f9-execution-folder" className="text-sm font-medium">
                Execution Folder Path
              </label>
              <input
                id="ltm-settings-f9-execution-folder"
                type="text"
                value={f9ExecutionFolderPathInput}
                onChange={(event) => setF9ExecutionFolderPathInput(event.target.value)}
                placeholder="Optional. Leave blank to disable execution file sync."
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Current saved value:{' '}
              {f9SavedExecutionFolderPath
                ? <span className="font-mono">{f9SavedExecutionFolderPath}</span>
                : <span className="italic">Not configured</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => { void onSaveF9Settings() }}
                disabled={busyAction === 'f9'}
              >
                {busyAction === 'f9' ? 'Saving...' : 'Save F9 Path'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { void onResetF9Settings() }}
                disabled={busyAction === 'f9'}
              >
                Reset to Default
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'rss' && (
        <RssFeedSettingsSection />
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
              Thinking Space selection is preserved, but local caches will be rebuilt after refresh.
            </p>
            <p className="text-sm text-muted-foreground">
              Clear Cache removes local API/OAuth credentials stored in app cache (for example AI and Google Drive),
              so you may need to sign in again.
            </p>
            <Button type="button" onClick={onClearCache} disabled={busyAction === 'cache'}>
              {busyAction === 'cache' ? 'Clearing cache...' : 'Clear Cache'}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'vault' && (
        <Card>
          <CardHeader>
            <CardTitle>Select Thinking Space</CardTitle>
            <CardDescription>
              Open the folder selector for this {runtimeLabel} runtime. The app reloads after selection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use this if you want to switch to a different Thinking Space folder or recover from stale folder context.
            </p>
            <p className="text-sm text-muted-foreground">
              Switching Thinking Space folders does not delete API keys or credentials.
            </p>
            <Button type="button" onClick={onSwitchVault}>
              Open Thinking Space Selector
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'about' && <AboutSection />}

      {activeTab === 'developer' && (
        <Card>
          <CardHeader>
            <CardTitle>Customize This App</CardTitle>
            <CardDescription>
              Modify Thinking Space with AI assistance — see changes live, then build a permanent version.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeveloperSetupBlock />
          </CardContent>
        </Card>
      )}

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}

function AboutSection() {
  const electronVersions = window.electronAPI?.versions

  const rows: Array<{ label: string; value: string }> = electronVersions ? [
    { label: 'Thinking Space', value: electronVersions.app },
    { label: 'Electron', value: electronVersions.electron },
    { label: 'Chromium', value: electronVersions.chrome },
    { label: 'Node.js', value: electronVersions.node },
    { label: 'V8', value: electronVersions.v8 },
  ] : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>About</CardTitle>
        <CardDescription>Runtime and version information.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Version info is only available in the Electron desktop app.</p>
        ) : (
          <dl className="space-y-2">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex items-center gap-4">
                <dt className="w-32 shrink-0 text-sm font-medium text-muted-foreground">{label}</dt>
                <dd className="font-mono text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

const RETENTION_OPTIONS = [7, 14, 30, 60, 90, 180] as const

function RssFeedSettingsSection() {
  const [prefs, setPrefs] = useState<RssFeedPreferencesBlock | null>(null)
  const [newUrl, setNewUrl] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupParent, setNewGroupParent] = useState<string | null>(null)
  const [newTagDraft, setNewTagDraft] = useState('')
  const [retentionDays, setRetentionDays] = useState<number>(() => getRssRetentionDaysOrch())

  const feeds = prefs?.feeds ?? []
  const groups = prefs?.groups ?? []
  const presetTags = prefs?.presetTags ?? []
  const presetTagColors = prefs?.tagColors ?? {}

  useEffect(() => {
    void readRssFeedPreferencesOrch().then(setPrefs)
  }, [])

  const handleAddFeed = async () => {
    const url = newUrl.trim()
    if (!url) return
    const entry = await addRssFeedOrch(url, newTitle.trim() || undefined)
    setPrefs(prev => prev ? { ...prev, feeds: [...prev.feeds, entry] } : prev)
    setNewUrl('')
    setNewTitle('')
  }

  const handleRemoveFeed = async (feedId: string) => {
    await removeRssFeedOrch(feedId)
    setPrefs(prev => prev ? { ...prev, feeds: prev.feeds.filter(f => f.id !== feedId) } : prev)
  }

  const handleUpdateFeedTitle = async (feedId: string, title: string) => {
    await updateRssFeedOrch(feedId, { title })
    setPrefs(prev => prev ? { ...prev, feeds: prev.feeds.map(f => f.id === feedId ? { ...f, title } : f) } : prev)
  }

  const handleUpdateFeedGroup = async (feedId: string, groupId: string | null) => {
    await updateRssFeedOrch(feedId, { groupId })
    setPrefs(prev => prev ? { ...prev, feeds: prev.feeds.map(f => f.id === feedId ? { ...f, groupId } : f) } : prev)
  }

  const handleAddGroup = async () => {
    const name = newGroupName.trim()
    if (!name) return
    const group = await addRssFeedGroupOrch(name, newGroupParent)
    setPrefs(prev => prev ? { ...prev, groups: [...prev.groups, group] } : prev)
    setNewGroupName('')
    setNewGroupParent(null)
  }

  const handleRemoveGroup = async (groupId: string) => {
    await removeRssFeedGroupOrch(groupId)
    setPrefs(prev => {
      if (!prev) return prev
      // Cascade: remove group + ungroup its feeds
      const idsToRemove = new Set<string>()
      function collect(id: string) {
        idsToRemove.add(id)
        for (const g of prev!.groups) if (g.parentGroupId === id) collect(g.id)
      }
      collect(groupId)
      return {
        ...prev,
        groups: prev.groups.filter(g => !idsToRemove.has(g.id)),
        feeds: prev.feeds.map(f => f.groupId && idsToRemove.has(f.groupId) ? { ...f, groupId: null } : f),
      }
    })
  }

  const handleRenameGroup = async (groupId: string, name: string) => {
    await updateRssFeedGroupOrch(groupId, { name })
    setPrefs(prev => prev ? { ...prev, groups: prev.groups.map(g => g.id === groupId ? { ...g, name } : g) } : prev)
  }

  const handleAddPresetTag = async () => {
    const incoming = splitTagInputBlock(newTagDraft).filter(t => !presetTags.includes(t))
    if (incoming.length === 0) { setNewTagDraft(''); return }
    const next = [...presetTags, ...incoming]
    await updateRssPresetTagsOrch(next, presetTagColors)
    setPrefs(prev => prev ? { ...prev, presetTags: next } : prev)
    setNewTagDraft('')
  }

  const handleRemovePresetTag = async (tag: string) => {
    const next = presetTags.filter(t => t !== tag)
    const nextColors = { ...presetTagColors }
    delete nextColors[tagLookupKeyBlock(tag)]
    await updateRssPresetTagsOrch(next, nextColors)
    setPrefs(prev => prev ? { ...prev, presetTags: next, tagColors: nextColors } : prev)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>RSS Feeds</CardTitle>
        <CardDescription>
          Add RSS or Atom feed URLs. They appear in the RSS panel at the bottom of the explorer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Feed list ── */}
        {feeds.length > 0 && (
          <div className="space-y-2">
            {feeds.map(feed => (
              <div key={feed.id} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <input
                    defaultValue={feed.title}
                    onBlur={e => { void handleUpdateFeedTitle(feed.id, e.target.value) }}
                    className="block w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
                    placeholder="Feed title"
                  />
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{feed.url}</span>
                    <select
                      value={feed.groupId ?? ''}
                      onChange={e => { void handleUpdateFeedGroup(feed.id, e.target.value || null) }}
                      className="shrink-0 rounded border border-border/70 bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground outline-none"
                    >
                      <option value="">No group</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 px-2 text-destructive hover:text-destructive"
                  onClick={() => void handleRemoveFeed(feed.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
        {feeds.length === 0 && (
          <div className="rounded-md border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
            No feeds configured yet.
          </div>
        )}

        {/* ── Add feed ── */}
        <div className="space-y-2 rounded-md border border-border/60 p-3">
          <div className="text-xs font-medium text-muted-foreground">Add Feed</div>
          <input
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
            className="block w-full rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
            onKeyDown={e => { if (e.key === 'Enter') void handleAddFeed() }}
          />
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Title (optional — auto-detected from feed)"
            className="block w-full rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
            onKeyDown={e => { if (e.key === 'Enter') void handleAddFeed() }}
          />
          <Button size="sm" onClick={() => void handleAddFeed()} disabled={!newUrl.trim()}>
            Add Feed
          </Button>
        </div>

        {/* ── Feed groups ── */}
        <div className="space-y-2 rounded-md border border-border/60 p-3">
          <div className="text-xs font-medium text-muted-foreground">Feed Groups</div>
          {groups.length > 0 && (
            <div className="space-y-1.5">
              {groups.map(g => (
                <div key={g.id} className="flex items-center gap-2 rounded border border-border/40 px-2 py-1.5">
                  <input
                    defaultValue={g.name}
                    onBlur={e => { void handleRenameGroup(g.id, e.target.value) }}
                    className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
                    placeholder="Group name"
                  />
                  {g.parentGroupId && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      in {groups.find(p => p.id === g.parentGroupId)?.name ?? '?'}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 shrink-0 px-1.5 text-[11px] text-destructive hover:text-destructive"
                    onClick={() => void handleRemoveGroup(g.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="New group name"
              className="min-w-0 flex-1 rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
              onKeyDown={e => { if (e.key === 'Enter') void handleAddGroup() }}
            />
            {groups.length > 0 && (
              <select
                value={newGroupParent ?? ''}
                onChange={e => setNewGroupParent(e.target.value || null)}
                className="shrink-0 rounded border border-border/70 bg-background px-1.5 py-1.5 text-xs outline-none"
              >
                <option value="">Root level</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
            <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => void handleAddGroup()} disabled={!newGroupName.trim()}>
              Add
            </Button>
          </div>
        </div>

        {/* ── Preset tags ── */}
        <div className="space-y-2 rounded-md border border-border/60 p-3">
          <div className="text-xs font-medium text-muted-foreground">Global Preset Tags</div>
          <div className="text-[11px] text-muted-foreground">
            Define tags here to make them available as one-click chips when tagging articles.
          </div>
          {presetTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {presetTags.map(tag => (
                <span
                  key={tag}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    tagColorClassBlock(tag, 'solid'),
                  )}
                  style={tagColorStyleBlock(tag, 'solid', presetTagColors[tagLookupKeyBlock(tag)])}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => void handleRemovePresetTag(tag)}
                    className="opacity-60 hover:opacity-100"
                    aria-label={`Remove ${tag}`}
                  >
                    <span className="text-xs">&times;</span>
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={newTagDraft}
              onChange={e => setNewTagDraft(e.target.value)}
              placeholder="Add tags (comma separated)"
              className="min-w-0 flex-1 rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleAddPresetTag() } }}
            />
            <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => void handleAddPresetTag()} disabled={!newTagDraft.trim()}>
              Add
            </Button>
          </div>
        </div>

        {/* ── Retention ── */}
        <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 px-3 py-2.5">
          <div>
            <div className="text-sm font-medium">Article Retention</div>
            <div className="text-xs text-muted-foreground">
              Articles older than this are auto-purged. Articles with tags or <code className="text-xs">keep: true</code> are kept forever.
            </div>
          </div>
          <select
            value={retentionDays}
            onChange={e => {
              const days = Number(e.target.value)
              setRetentionDays(days)
              setRssRetentionDaysOrch(days)
            }}
            className="shrink-0 rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
          >
            {RETENTION_OPTIONS.map(d => (
              <option key={d} value={d}>{d} days</option>
            ))}
            {!RETENTION_OPTIONS.includes(retentionDays as typeof RETENTION_OPTIONS[number]) && (
              <option value={retentionDays}>{retentionDays} days</option>
            )}
          </select>
        </div>
      </CardContent>
    </Card>
  )
}

function AiWebsitesSettingsSection() {
  const [sites, setSites] = useState<AiWebsiteBlock[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNameDraft, setEditNameDraft] = useState('')

  useEffect(() => { void readAiWebsitesOrch().then(setSites) }, [])

  const handleAdd = async () => {
    const url = newUrl.trim()
    if (!url) return
    const entry = await addAiWebsiteOrch(newName.trim() || url, url)
    setSites(prev => [...prev, entry])
    setNewUrl('')
    setNewName('')
  }

  const handleRemove = async (id: string) => {
    await removeAiWebsiteOrch(id)
    setSites(prev => prev.filter(s => s.id !== id))
  }

  const handleStartEdit = (site: AiWebsiteBlock) => {
    setEditingId(site.id)
    setEditNameDraft(site.name)
  }

  const handleSaveEdit = async (id: string) => {
    const name = editNameDraft.trim()
    if (!name) return
    await updateAiWebsiteOrch(id, { name })
    setSites(prev => prev.map(s => s.id === id ? { ...s, name } : s))
    setEditingId(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Websites</CardTitle>
        <CardDescription>
          Add AI chat websites (like grok.com, chatgpt.com) to the Chat tab.
          Each entry gets its own isolated login session — add the same site twice for two different accounts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {sites.length === 0 && (
            <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
              No AI websites added yet.
            </div>
          )}
          {sites.map(site => (
            <div key={site.id} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
              {editingId === site.id ? (
                <>
                  <input
                    type="text"
                    value={editNameDraft}
                    onChange={e => setEditNameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(site.id) }}
                    className="h-8 flex-1 rounded border border-input bg-background px-2 text-sm outline-none focus:border-ring"
                    autoFocus
                  />
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleSaveEdit(site.id)}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{site.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{site.url}</div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleStartEdit(site)}>
                    Rename
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleRemove(site.id)}>
                    Remove
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-border/60 pt-3">
          <h3 className="text-sm font-medium">Add Website</h3>
          <input
            type="text"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="https://grok.com"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
          />
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Display name (optional, e.g. Grok - Work Account)"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
          />
          <Button type="button" onClick={handleAdd} disabled={!newUrl.trim()}>
            Add Website
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function WebSettingsSection() {
  const [prefs, setPrefs] = useState<WebSitePreferencesBlock>({ bookmarks: [], groups: [] })
  const [newSiteUrl, setNewSiteUrl] = useState('')
  const [newSiteName, setNewSiteName] = useState('')
  const [newSiteGroupId, setNewSiteGroupId] = useState<string>('__none__')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupParent, setNewGroupParent] = useState<string | null>(null)
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)
  const [editingSiteName, setEditingSiteName] = useState('')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')

  useEffect(() => { void readWebSitePreferencesOrch().then(setPrefs) }, [])

  const handleAddSite = async () => {
    const url = newSiteUrl.trim()
    if (!url) return
    const groupId = newSiteGroupId === '__none__' ? null : newSiteGroupId
    const entry = await addWebSiteOrch(newSiteName.trim() || url, url, groupId)
    setPrefs(prev => ({ ...prev, bookmarks: [...prev.bookmarks, entry] }))
    setNewSiteUrl('')
    setNewSiteName('')
  }

  const handleRemoveSite = async (id: string) => {
    await removeWebSiteOrch(id)
    setPrefs(prev => ({ ...prev, bookmarks: prev.bookmarks.filter(b => b.id !== id) }))
  }

  const handleSaveSiteName = async (id: string) => {
    const name = editingSiteName.trim()
    if (!name) return
    await updateWebSiteOrch(id, { name })
    setPrefs(prev => ({ ...prev, bookmarks: prev.bookmarks.map(b => b.id === id ? { ...b, name } : b) }))
    setEditingSiteId(null)
  }

  const handleAddGroup = async () => {
    const name = newGroupName.trim()
    if (!name) return
    const group = await addWebSiteGroupOrch(name, newGroupParent)
    setPrefs(prev => ({ ...prev, groups: [...prev.groups, group] }))
    setNewGroupName('')
    setNewGroupParent(null)
  }

  const handleRemoveGroup = async (groupId: string) => {
    await removeWebSiteGroupOrch(groupId)
    setPrefs(prev => {
      const idsToRemove = new Set<string>()
      function collect(id: string) {
        idsToRemove.add(id)
        for (const g of prev.groups) if (g.parentGroupId === id) collect(g.id)
      }
      collect(groupId)
      return {
        groups: prev.groups.filter(g => !idsToRemove.has(g.id)),
        bookmarks: prev.bookmarks.map(b => b.groupId && idsToRemove.has(b.groupId) ? { ...b, groupId: null } : b),
      }
    })
  }

  const handleSaveGroupName = async (groupId: string) => {
    const name = editingGroupName.trim()
    if (!name) return
    await updateWebSiteGroupOrch(groupId, name)
    setPrefs(prev => ({ ...prev, groups: prev.groups.map(g => g.id === groupId ? { ...g, name } : g) }))
    setEditingGroupId(null)
  }

  return (
    <div className="space-y-6">
      {/* Groups */}
      <Card>
        <CardHeader>
          <CardTitle>Groups</CardTitle>
          <CardDescription>Organise your web sites into groups (like folders).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {prefs.groups.length === 0 && (
              <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                No groups yet.
              </div>
            )}
            {prefs.groups.map(group => (
              <div key={group.id} className="flex items-center gap-2 rounded-md border border-border/40 px-2 py-1.5">
                {editingGroupId === group.id ? (
                  <>
                    <input
                      type="text"
                      value={editingGroupName}
                      onChange={e => setEditingGroupName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveGroupName(group.id) }}
                      className="h-8 flex-1 rounded border border-input bg-background px-2 text-sm outline-none focus:border-ring"
                      autoFocus
                    />
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleSaveGroupName(group.id)}>Save</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingGroupId(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{group.name}</span>
                    {group.parentGroupId && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        in {prefs.groups.find(p => p.id === group.parentGroupId)?.name ?? '?'}
                      </span>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 shrink-0 px-1.5 text-[11px]" onClick={() => { setEditingGroupId(group.id); setEditingGroupName(group.name) }}>Rename</Button>
                    <Button size="sm" variant="ghost" className="h-6 shrink-0 px-1.5 text-[11px] text-destructive hover:text-destructive" onClick={() => handleRemoveGroup(group.id)}>Remove</Button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-border/60 pt-3">
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddGroup() }}
              placeholder="New group name"
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
            />
            {prefs.groups.length > 0 && (
              <select
                value={newGroupParent ?? ''}
                onChange={e => setNewGroupParent(e.target.value || null)}
                className="shrink-0 rounded border border-border/70 bg-background px-1.5 py-1.5 text-xs outline-none"
              >
                <option value="">Root level</option>
                {prefs.groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
            <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={handleAddGroup} disabled={!newGroupName.trim()}>Add</Button>
          </div>
        </CardContent>
      </Card>

      {/* Bookmarks */}
      <Card>
        <CardHeader>
          <CardTitle>Web Sites</CardTitle>
          <CardDescription>
            Add any website. Each entry gets its own isolated login session — add the same site twice for two accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {prefs.bookmarks.length === 0 && (
              <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                No sites yet.
              </div>
            )}
            {prefs.bookmarks.map(bm => (
              <div key={bm.id} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
                {editingSiteId === bm.id ? (
                  <>
                    <input
                      type="text"
                      value={editingSiteName}
                      onChange={e => setEditingSiteName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveSiteName(bm.id) }}
                      className="h-8 flex-1 rounded border border-input bg-background px-2 text-sm outline-none focus:border-ring"
                      autoFocus
                    />
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleSaveSiteName(bm.id)}>Save</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingSiteId(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{bm.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{bm.url}</div>
                      {bm.groupId && (
                        <div className="text-[11px] text-muted-foreground/60">
                          {prefs.groups.find(g => g.id === bm.groupId)?.name ?? ''}
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingSiteId(bm.id); setEditingSiteName(bm.name) }}>Rename</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleRemoveSite(bm.id)}>Remove</Button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border/60 pt-3">
            <h3 className="text-sm font-medium">Add Site</h3>
            <input
              type="url"
              value={newSiteUrl}
              onChange={e => setNewSiteUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddSite() }}
              placeholder="https://github.com"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
            />
            <input
              type="text"
              value={newSiteName}
              onChange={e => setNewSiteName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddSite() }}
              placeholder="Name (optional)"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
            />
            {prefs.groups.length > 0 && (
              <select
                value={newSiteGroupId}
                onChange={e => setNewSiteGroupId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              >
                <option value="__none__">No group</option>
                {prefs.groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
            <Button onClick={handleAddSite} disabled={!newSiteUrl.trim()} className="w-full">
              Add Site
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
