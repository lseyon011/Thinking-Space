import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, PenLine, Loader2, CheckCircle2, LayoutList, Eye, Pencil, Trash2, X, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { Switch } from '@/components/lego_blocks/units/ui/switch'
import CascadingFolderPicker, {
  addRecent,
  type CascadingFolderPickerChange,
} from '@/components/lego_blocks/integrations/CascadingFolderPickerBlock'
import EmotionTagger from '@/components/lego_blocks/integrations/EmotionTaggerBlock'
import AiAssistControlsBlock from '@/components/lego_blocks/integrations/AiAssistControlsBlock'
import AiAssistReviewBlock from '@/components/lego_blocks/integrations/AiAssistReviewBlock'
import { useAiAssistRuntimeBlock } from '@/components/lego_blocks/integrations/AiAssistRuntimeBlock'
import InfoPanelToggleButtonBlock from '@/components/lego_blocks/units/InfoPanelToggleButtonBlock'
import AiPanelToggleButtonBlock from '@/components/lego_blocks/units/AiPanelToggleButtonBlock'
import MarkdownRichEditorBlock from '@/components/lego_blocks/integrations/MarkdownRichEditorBlock'
import MarkdownDocumentBlock from '@/components/lego_blocks/integrations/MarkdownDocumentBlock'
import ThoughtsCalendarOrch from '@/components/orchestrators/ThoughtsCalendarOrch'
import { deleteVaultPathOrch } from '@/services/orchestrators/fileSystemOrch'
import { invokeCapabilityOrThrow } from '@/services/orchestrators/capabilityRouterOrch'
import { findRelated, type SimilarityMatch } from '@/services/lego_blocks/aiBlock'
import type { CapabilityActor } from '@/services/lego_blocks/capabilityRegistryBlock'

const DESTINATION_RECENTS_KEY = 'ltm-new-note-destination-recents'
const CUSTOM_SHORTCUTS_KEY = 'ltm-new-note-custom-shortcuts'
const DESTINATION_USAGE_COUNTS_KEY = 'ltm-new-note-destination-usage-counts'
const DEFAULT_BASE_PATH = ['lifeblood_systems', 'sfdl']
const THOUGHTS_ACTOR: CapabilityActor = { kind: 'human', id: 'ui.new-note' }

type Tab = 'create' | 'view'

interface DestinationShortcut {
  id: string
  label: string
  pathSegments: string[]
  builtIn?: boolean
}

const BUILT_IN_SHORTCUTS: DestinationShortcut[] = [
  { id: 'thoughts', label: 'Thoughts', pathSegments: ['thoughts'], builtIn: true },
  { id: 'meetings', label: 'Meetings', pathSegments: ['meetings'], builtIn: true },
  { id: 'todo', label: 'To Do', pathSegments: ['todos'], builtIn: true },
  { id: 'none', label: 'None', pathSegments: [], builtIn: true },
]

function todayFilename() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}.md`
}

function normalizeSegments(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value.flatMap(segment => (typeof segment === 'string' ? segment.split('/') : []))
    : (typeof value === 'string' ? value.split('/') : [])
  return parts
    .map(segment => segment.trim())
    .filter(Boolean)
}

function endsWithSegments(path: string[], suffix: string[]): boolean {
  if (suffix.length === 0) return true
  if (path.length < suffix.length) return false
  const offset = path.length - suffix.length
  for (let index = 0; index < suffix.length; index += 1) {
    if (path[offset + index] !== suffix[index]) return false
  }
  return true
}

function withSuffix(path: string[], suffix: string[]): string[] {
  return endsWithSegments(path, suffix)
    ? [...path]
    : [...path, ...suffix]
}

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJsonStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage failures in restricted runtimes.
  }
}

function readCustomShortcuts(): DestinationShortcut[] {
  const parsed = readJsonStorage<Array<{ id: string; label: string; pathSegments: string[] }>>(CUSTOM_SHORTCUTS_KEY, [])
  return parsed
    .map(shortcut => ({
      id: shortcut.id,
      label: shortcut.label.trim(),
      pathSegments: normalizeSegments(shortcut.pathSegments),
      builtIn: false,
    }))
    .filter(shortcut => shortcut.id && shortcut.label && shortcut.pathSegments.length > 0)
}

function writeCustomShortcuts(shortcuts: DestinationShortcut[]): void {
  const stored = shortcuts
    .filter(shortcut => !shortcut.builtIn)
    .map(shortcut => ({
      id: shortcut.id,
      label: shortcut.label,
      pathSegments: shortcut.pathSegments,
    }))
  writeJsonStorage(CUSTOM_SHORTCUTS_KEY, stored)
}

function readDestinationUsageCounts(): Record<string, number> {
  const parsed = readJsonStorage<Record<string, number>>(DESTINATION_USAGE_COUNTS_KEY, {})
  const normalized: Record<string, number> = {}
  for (const [path, count] of Object.entries(parsed)) {
    const cleanedPath = normalizeSegments(path).join('/')
    if (!cleanedPath) continue
    if (!Number.isFinite(count) || count <= 0) continue
    normalized[cleanedPath] = Math.round(count)
  }
  return normalized
}

function writeDestinationUsageCounts(counts: Record<string, number>): void {
  writeJsonStorage(DESTINATION_USAGE_COUNTS_KEY, counts)
}

function topUsedDestinations(counts: Record<string, number>, limit = 5): Array<{ path: string; count: number }> {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([path, count]) => ({ path, count }))
}

function filenameFromTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `${slug}.md` : todayFilename()
}

function ensureMarkdownFilename(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return todayFilename()
  return /\.md$/i.test(trimmed) ? trimmed : `${trimmed}.md`
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`
}

function CreateTab() {
  const [pickerDefaultPath, setPickerDefaultPath] = useState<string[]>(DEFAULT_BASE_PATH)
  const [pickerVersion, setPickerVersion] = useState(0)
  const [folderBaseSegments, setFolderBaseSegments] = useState<string[]>([])
  const [folderBasePath, setFolderBasePath] = useState('')
  const [activeShortcutId, setActiveShortcutId] = useState<string>('thoughts')
  const [customShortcuts, setCustomShortcuts] = useState<DestinationShortcut[]>([])
  const [customShortcutLabel, setCustomShortcutLabel] = useState('')
  const [customShortcutPath, setCustomShortcutPath] = useState('')
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})
  const [filename, setFilename] = useState(todayFilename())
  const [filenameTouched, setFilenameTouched] = useState(false)
  const [useCustomTitle, setUseCustomTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [dateHeader, setDateHeader] = useState(true)
  const [content, setContent] = useState('')
  const [emotions, setEmotions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [editorPath, setEditorPath] = useState<string | null>(null)
  const [showMetaPanel, setShowMetaPanel] = useState(false)
  const [showAiAssist, setShowAiAssist] = useState(false)
  const [relatedThoughts, setRelatedThoughts] = useState<SimilarityMatch[]>([])
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [relatedError, setRelatedError] = useState<string | null>(null)
  const {
    aiSelectionLoading,
    selectedProvider,
    selectedModel,
    assistRunningAction,
    assistError,
    assistSuggestion,
    runAssistAction,
    applyAssistSuggestion,
    dismissAssistSuggestion,
    clearAssistState,
  } = useAiAssistRuntimeBlock({
    scope: 'new_thought',
    useCase: 'new_thought.assist',
  })

  useEffect(() => {
    setCustomShortcuts(readCustomShortcuts())
    setUsageCounts(readDestinationUsageCounts())
  }, [])

  const allShortcuts = useMemo(
    () => [...BUILT_IN_SHORTCUTS, ...customShortcuts],
    [customShortcuts],
  )

  const shortcutsById = useMemo(() => {
    const map = new Map<string, DestinationShortcut>()
    for (const shortcut of allShortcuts) map.set(shortcut.id, shortcut)
    return map
  }, [allShortcuts])

  const activeShortcut = shortcutsById.get(activeShortcutId) ?? BUILT_IN_SHORTCUTS[0]
  const destinationSegments = useMemo(
    () => withSuffix(folderBaseSegments, activeShortcut.pathSegments),
    [activeShortcut.pathSegments, folderBaseSegments],
  )
  const destinationPath = destinationSegments.join('/')
  const normalizedFilename = ensureMarkdownFilename(filename)

  const rememberDestinationUsage = useCallback((segments: string[]) => {
    const normalized = normalizeSegments(segments)
    if (normalized.length === 0) return
    addRecent(DESTINATION_RECENTS_KEY, normalized)
    setUsageCounts((previous) => {
      const key = normalized.join('/')
      const next = {
        ...previous,
        [key]: (previous[key] ?? 0) + 1,
      }
      writeDestinationUsageCounts(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (!useCustomTitle) return
    if (filenameTouched) return
    setFilename(filenameFromTitle(title))
  }, [filenameTouched, title, useCustomTitle])

  useEffect(() => {
    if (assistRunningAction || assistSuggestion || assistError) {
      setShowAiAssist(true)
    }
  }, [assistError, assistRunningAction, assistSuggestion])

  const handleFolderChange = (change: CascadingFolderPickerChange) => {
    setFolderBaseSegments(change.baseSegments)
    setFolderBasePath(change.basePath)
    setSavedPath(null)
    setError(null)
    setMessage(null)
  }

  const handleShortcutSelect = (shortcutId: string) => {
    setActiveShortcutId(shortcutId)
    const shortcut = shortcutsById.get(shortcutId)
    if (!shortcut || folderBaseSegments.length === 0) return
    rememberDestinationUsage(withSuffix(folderBaseSegments, shortcut.pathSegments))
  }

  const handleApplyDestinationPath = (path: string) => {
    const nextBaseSegments = normalizeSegments(path)
    if (nextBaseSegments.length === 0) return
    setPickerDefaultPath(nextBaseSegments)
    setPickerVersion(current => current + 1)
    setFolderBaseSegments(nextBaseSegments)
    setFolderBasePath(nextBaseSegments.join('/'))
    setActiveShortcutId('none')
    setSavedPath(null)
    setEditorPath(null)
    setError(null)
    setMessage(null)
    rememberDestinationUsage(nextBaseSegments)
  }

  const handleAddCustomShortcut = () => {
    const label = customShortcutLabel.trim()
    const pathSegments = normalizeSegments(customShortcutPath)
    if (!label || pathSegments.length === 0) {
      setError('Custom shortcut needs both a label and path suffix.')
      return
    }
    const shortcut: DestinationShortcut = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label,
      pathSegments,
      builtIn: false,
    }
    const next = [...customShortcuts, shortcut]
    setCustomShortcuts(next)
    writeCustomShortcuts(next)
    setCustomShortcutLabel('')
    setCustomShortcutPath('')
    setError(null)
    setMessage(`Added shortcut "${label}".`)
  }

  const handleDeleteCustomShortcut = (shortcutId: string) => {
    const next = customShortcuts.filter(shortcut => shortcut.id !== shortcutId)
    setCustomShortcuts(next)
    writeCustomShortcuts(next)
    if (activeShortcutId === shortcutId) setActiveShortcutId('thoughts')
    setMessage('Removed custom shortcut.')
  }

  const handleCustomTitleToggle = (enabled: boolean) => {
    setUseCustomTitle(enabled)
    if (!enabled) {
      setTitle('')
      setFilename(todayFilename())
      setFilenameTouched(false)
      return
    }
    setFilenameTouched(false)
    setFilename(filenameFromTitle(title))
  }

  const handleSave = async () => {
    if (!destinationPath.trim() || !filename.trim() || !content.trim()) return

    setSaving(true)
    setError(null)
    setMessage(null)
    setSavedPath(null)

    try {
      const data = await invokeCapabilityOrThrow({
        capability: 'thoughts.create',
        input: {
          folder_path: destinationPath,
          filename: normalizedFilename,
          content,
          title: useCustomTitle ? (title.trim() || null) : null,
          date_header: dateHeader,
          emotions,
        },
        actor: THOUGHTS_ACTOR,
      })

      setSavedPath(data.output_path)
      setEditorPath(data.output_path)
      rememberDestinationUsage(destinationSegments)
      setMessage(`Saved ${data.output_path}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const targetPath = destinationPath.trim() && filename.trim()
    ? `${destinationPath.replace(/\/$/, '')}/${normalizedFilename}`
    : null
  const contentMeta = useMemo(() => {
    const normalized = content.replace(/\r\n/g, '\n')
    const trimmed = normalized.trim()
    return {
      lines: trimmed ? normalized.split('\n').length : 0,
      words: trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0,
      headings: (normalized.match(/^#{1,6}\s/gm) || []).length,
      size: formatBytes(new TextEncoder().encode(normalized).length),
    }
  }, [content])
  const titleForPreview = useMemo(() => {
    if (useCustomTitle && title.trim()) return title.trim()
    return normalizedFilename.replace(/\.md$/i, '').replace(/[-_]+/g, ' ').trim() || 'untitled'
  }, [normalizedFilename, title, useCustomTitle])
  const frontmatterPreview = useMemo(() => {
    const lines = [
      `title: ${JSON.stringify(titleForPreview)}`,
      'type: thought',
      'status: active',
    ]
    if (emotions.length > 0) {
      lines.push('emotions:')
      for (const emotion of emotions) lines.push(`  - ${JSON.stringify(emotion)}`)
    }
    lines.push('created_at: <generated on save>')
    lines.push('updated_at: <generated on save>')
    return lines.join('\n')
  }, [emotions, titleForPreview])

  useEffect(() => {
    if (!showAiAssist || saving) {
      setRelatedThoughts([])
      setRelatedError(null)
      setRelatedLoading(false)
      return
    }

    const source = content.trim()
    if (source.length < 24) {
      setRelatedThoughts([])
      setRelatedError(null)
      setRelatedLoading(false)
      return
    }

    let cancelled = false
    setRelatedLoading(true)
    setRelatedError(null)

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const matches = await findRelated({
            text: source,
            sourceFilePath: targetPath ?? undefined,
            preferredTypes: ['thought'],
            limit: 6,
          })
          if (cancelled) return
          setRelatedThoughts(matches)
        } catch (err) {
          if (cancelled) return
          setRelatedError(err instanceof Error ? err.message : 'Failed to load related thoughts')
          setRelatedThoughts([])
        } finally {
          if (!cancelled) setRelatedLoading(false)
        }
      })()
    }, 320)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [content, saving, showAiAssist, targetPath])

  const handleEditExisting = () => {
    if (!targetPath) return
    setEditorPath(targetPath)
    setMessage(`Opened ${targetPath} in editor.`)
  }

  const handleCreateAnother = () => {
    setContent('')
    setTitle('')
    setUseCustomTitle(false)
    setFilename(todayFilename())
    setFilenameTouched(false)
    setEditorPath(null)
    setSavedPath(null)
    setError(null)
    setMessage(null)
    clearAssistState()
  }

  const handleDeleteCurrent = async () => {
    if (!editorPath) return
    if (!window.confirm(`Delete note?\n\n${editorPath}`)) return
    setDeleting(true)
    setError(null)
    setMessage(null)
    try {
      await deleteVaultPathOrch(editorPath)
      setMessage(`Deleted ${editorPath}.`)
      if (savedPath === editorPath) setSavedPath(null)
      setEditorPath(null)
      setContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note')
    } finally {
      setDeleting(false)
    }
  }

  const canSave = destinationPath.trim() && filename.trim() && content.trim() && !saving
  const mostUsedDestinations = useMemo(() => topUsedDestinations(usageCounts, 5), [usageCounts])

  return (
    <div className="grid gap-6 lg:grid-cols-[clamp(240px,27vw,340px)_minmax(0,1fr)]">
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Destination</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 pb-1">
              <label className="text-xs text-muted-foreground">Base folder path</label>
              <p className="text-[11px] text-muted-foreground/70 break-all">
                {folderBasePath || '(choose a folder)'}
              </p>
            </div>
            <CascadingFolderPicker
              key={`new-note-picker-${pickerVersion}`}
              defaultPath={pickerDefaultPath}
              onChange={handleFolderChange}
              previewLabel="Destination preview"
              storageKey={DESTINATION_RECENTS_KEY}
            />

            <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
              <label className="text-xs text-muted-foreground">Shortcuts</label>
              <div className="flex flex-wrap gap-2">
                {allShortcuts.map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className={`inline-flex items-center rounded-full border px-1 py-1 ${
                      activeShortcutId === shortcut.id
                        ? 'border-primary/80 bg-primary text-primary-foreground'
                        : 'border-border/60 bg-muted/20 text-muted-foreground'
                    }`}
                  >
                    <button
                      type="button"
                      className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-90"
                      onClick={() => handleShortcutSelect(shortcut.id)}
                    >
                      {shortcut.label}
                    </button>
                    {!shortcut.builtIn && (
                      <button
                        type="button"
                        className={`rounded-full p-1 transition-colors ${
                          activeShortcutId === shortcut.id
                            ? 'text-primary-foreground/90 hover:bg-primary-foreground/20'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                        onClick={() => handleDeleteCustomShortcut(shortcut.id)}
                        title={`Remove shortcut ${shortcut.label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid gap-2">
                <input
                  value={customShortcutLabel}
                  onChange={(event) => setCustomShortcutLabel(event.target.value)}
                  placeholder="Shortcut name"
                  className="h-8 rounded-full border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex gap-2">
                  <input
                    value={customShortcutPath}
                    onChange={(event) => setCustomShortcutPath(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleAddCustomShortcut()
                      }
                    }}
                    placeholder="Path suffix (example: clients/acme/notes)"
                    className="h-8 flex-1 rounded-full border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded-full border border-border/70 bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    onClick={handleAddCustomShortcut}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {mostUsedDestinations.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
                <label className="text-xs text-muted-foreground">Most used (top 5)</label>
                <div className="space-y-1.5">
                  {mostUsedDestinations.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      onClick={() => handleApplyDestinationPath(entry.path)}
                      className="flex w-full items-center justify-between rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <span className="min-w-0 break-all">{entry.path}</span>
                      <span className="ml-2 shrink-0 tabular-nums">{entry.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 border-t border-border/40 pt-3">
              <p className="text-[11px] text-muted-foreground/70 break-all">
                Active destination: {destinationPath || '(choose a folder)'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Emotions</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <EmotionTagger selected={emotions} onChange={setEmotions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Note Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center gap-3">
              <Switch
                checked={dateHeader}
                onCheckedChange={setDateHeader}
                id="date-header"
              />
              <label htmlFor="date-header" className="text-sm text-muted-foreground cursor-pointer">
                Add date header
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={useCustomTitle}
                onCheckedChange={handleCustomTitleToggle}
                id="custom-title"
              />
              <label htmlFor="custom-title" className="text-sm text-muted-foreground cursor-pointer">
                Use custom title
              </label>
            </div>
          </CardContent>
        </Card>

        {(message || error) && (
          <div className="space-y-2">
            {message && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {editorPath ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm">Edit Note</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditorPath(null)}>
                  Back to Compose
                </Button>
                <Button variant="outline" size="sm" onClick={handleCreateAnother}>
                  Create Another
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => { void handleDeleteCurrent() }}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground break-all">{editorPath}</p>
          </CardHeader>
          <CardContent className="p-0">
            <MarkdownDocumentBlock
              path={editorPath}
              initialMode="edit"
              onSaved={({ output_path }) => {
                setSavedPath(output_path)
                setMessage(`Saved ${output_path}.`)
              }}
              className="h-[calc(100dvh-18rem)] min-h-[520px] rounded-b-xl"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Compose Note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Filename</label>
                <input
                  value={filename}
                  onChange={(event) => {
                    setFilename(event.target.value)
                    setFilenameTouched(true)
                  }}
                  placeholder="2026-02-26.md"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                <p className="text-[11px] text-muted-foreground/70">
                  Saved as: {normalizedFilename}
                </p>
              </div>

              {useCustomTitle && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Custom title</label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Becomes the note title + heading"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs text-muted-foreground">Content</label>
                <div className="flex items-center gap-1">
                  <InfoPanelToggleButtonBlock active={showMetaPanel} onToggle={() => setShowMetaPanel(v => !v)} />
                  <AiPanelToggleButtonBlock active={showAiAssist} onToggle={() => setShowAiAssist(v => !v)} />
                </div>
              </div>

              {showMetaPanel && (
                <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span><strong className="text-foreground/70">{contentMeta.lines}</strong> lines</span>
                    <span><strong className="text-foreground/70">{contentMeta.words}</strong> words</span>
                    <span><strong className="text-foreground/70">{contentMeta.headings}</strong> headings</span>
                    <span>{contentMeta.size}</span>
                  </div>
                  <div className="space-y-1.5 border-t border-border/30 pt-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      YAML Metadata
                    </div>
                    <textarea
                      value={frontmatterPreview}
                      readOnly
                      spellCheck={false}
                      className="min-h-[8rem] w-full rounded-md border border-border/60 bg-background px-2.5 py-2 font-mono text-xs text-foreground outline-none"
                      aria-label="YAML metadata preview"
                    />
                    <div className="text-[11px] text-muted-foreground">
                      Preview only. Final metadata is generated on save.
                    </div>
                  </div>
                </div>
              )}

              {showAiAssist && (
                <div className="space-y-2">
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                        <Sparkles className="h-3.5 w-3.5" />
                        Purpose for This File
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Uses steward metadata generation to create a proposal for YAML frontmatter.
                      </span>
                    </div>
                  </div>

                  <AiAssistControlsBlock
                    selectedProvider={selectedProvider}
                    selectedModel={selectedModel}
                    runningAction={assistRunningAction}
                    loading={aiSelectionLoading}
                    disabled={saving}
                    onRun={(action) => { void runAssistAction(action, content) }}
                    helperText="Suggestions apply inline. Auto-save is enabled by default; use Save for immediate commit. Configure provider/model in AI Settings."
                  />

                  <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Related Thoughts
                    </div>
                    {relatedLoading && (
                      <div className="text-xs text-muted-foreground">Finding related notes...</div>
                    )}
                    {relatedError && (
                      <div className="text-xs text-destructive">{relatedError}</div>
                    )}
                    {!relatedLoading && !relatedError && relatedThoughts.length === 0 && (
                      <div className="text-xs text-muted-foreground">
                        Keep typing to see lexical matches from your thought cache.
                      </div>
                    )}
                    {relatedThoughts.map(match => (
                      <button
                        key={match.node.uuid}
                        type="button"
                        className="w-full rounded-md border border-border/70 bg-background px-2.5 py-2 text-left transition-colors hover:bg-muted/40"
                        onClick={() => {
                          setEditorPath(match.node.filePath)
                          setMessage(`Opened ${match.node.filePath} in editor.`)
                        }}
                      >
                        <div className="truncate text-xs font-medium text-foreground">{match.node.title}</div>
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{match.node.filePath}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          Score {Math.round(match.normalizedScore * 100)}% · {match.reasons.join(', ') || 'lexical'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {assistSuggestion && (
                <AiAssistReviewBlock
                  suggestion={assistSuggestion}
                  onApply={() => {
                    applyAssistSuggestion((next) => {
                      setContent(next)
                    })
                  }}
                  onDiscard={dismissAssistSuggestion}
                />
              )}

              {assistError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {assistError}
                </div>
              )}

              <MarkdownRichEditorBlock
                value={content}
                onChange={(next) => {
                  setContent(next)
                  if (assistSuggestion || assistError) clearAssistState()
                }}
                placeholder="What's on your mind?"
                toolbarAlwaysVisible
                className="min-h-[400px] rounded-lg border border-input overflow-hidden"
              />
            </div>

            <div className="rounded-md border border-border/60 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
              Destination file: <span className="font-mono text-foreground break-all">{targetPath ?? '(select destination + filename)'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSave} disabled={!canSave}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Note'}
              </Button>

              <Button
                variant="secondary"
                onClick={handleEditExisting}
                disabled={!targetPath || saving}
              >
                <Pencil className="h-4 w-4 mr-1.5" />
                Open Existing
              </Button>

              {(savedPath || content.trim()) && (
                <Button variant="outline" onClick={handleCreateAnother}>
                  Reset Draft
                </Button>
              )}
            </div>

            {savedPath && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span>
                  Saved to <span className="font-medium text-foreground">{savedPath}</span>
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function NewThought() {
  const [tab, setTab] = useState<Tab>('create')

  return (
    <div className="relative isolate ltm-page overflow-hidden">
      <div className="ltm-page-fixed-bg-anchor">
        <div className="ltm-page-fixed-bg-canvas">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(59,130,246,0.25),transparent_60%),radial-gradient(900px_500px_at_80%_0%,rgba(168,85,247,0.18),transparent_55%),radial-gradient(800px_500px_at_50%_100%,rgba(16,185,129,0.12),transparent_55%)]" />
          <div
            className="absolute inset-0 opacity-28"
            style={{
              backgroundImage:
                'radial-gradient(rgba(31,41,55,0.25) 1px, transparent 1px), radial-gradient(rgba(31,41,55,0.15) 1px, transparent 1px)',
              backgroundSize: '180px 180px, 300px 300px',
              backgroundPosition: '0 0, 90px 110px',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-background/60" />
        </div>
      </div>

      <div className="relative z-10 ltm-page-shell ltm-shell-wide">
        <header className="mb-6 sm:mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <PenLine className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">New Note</h1>
              <p className="text-sm text-muted-foreground">
                Capture notes quickly, then refine them in the shared editor.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant={tab === 'create' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setTab('create')}
            >
              <LayoutList className="h-3.5 w-3.5 mr-1.5" />
              Create
            </Button>
            <Button
              variant={tab === 'view' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setTab('view')}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              View
            </Button>
          </div>
        </header>

        {tab === 'create' && <CreateTab />}
        {tab === 'view' && <ThoughtsCalendarOrch />}
      </div>
    </div>
  )
}
