import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, PenLine, Loader2, CheckCircle2, LayoutList, Eye, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/lego_blocks/ui/card'
import { Button } from '@/components/lego_blocks/ui/button'
import { Switch } from '@/components/lego_blocks/ui/switch'
import CascadingFolderPicker, {
  addRecent,
  type CascadingFolderPickerChange,
} from '@/components/lego_blocks/CascadingFolderPickerBlock'
import EmotionTagger from '@/components/lego_blocks/EmotionTaggerBlock'
import AiAssistControlsBlock from '@/components/lego_blocks/AiAssistControlsBlock'
import AiAssistReviewBlock from '@/components/lego_blocks/AiAssistReviewBlock'
import { useAiAssistRuntimeBlock } from '@/components/lego_blocks/AiAssistRuntimeBlock'
import ThoughtsCalendarOrch from '@/components/orchestrators/ThoughtsCalendarOrch'
import { useMarkdownViewer } from '@/components/orchestrators/MarkdownViewerOrch'
import { invokeCapabilityOrThrow } from '@/services/orchestrators/capabilityRouterOrch'
import type { CapabilityActor } from '@/services/lego_blocks/capabilityRegistryBlock'

const STORAGE_KEY = 'ltm-new-thought-recents'
const THOUGHTS_ACTOR: CapabilityActor = { kind: 'human', id: 'ui.new-thought' }

type Tab = 'create' | 'view'

function todayFilename() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}.md`
}

function CreateTab() {
  const { openFileForEdit } = useMarkdownViewer()
  const [folderSegments, setFolderSegments] = useState<string[]>([])
  const [folderBasePath, setFolderBasePath] = useState('')
  const [folderPath, setFolderPath] = useState('')
  const [filename, setFilename] = useState(todayFilename())
  const [title, setTitle] = useState('')
  const [dateHeader, setDateHeader] = useState(true)
  const [content, setContent] = useState('')
  const [emotions, setEmotions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedPath, setSavedPath] = useState<string | null>(null)
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

  const handleFolderChange = (change: CascadingFolderPickerChange) => {
    setFolderSegments(change.baseSegments)
    setFolderBasePath(change.basePath)
    setFolderPath(change.destinationPath)
    setSavedPath(null)
    setError(null)
  }

  const handleSave = async () => {
    if (!folderPath.trim() || !filename.trim() || !content.trim()) return

    setSaving(true)
    setError(null)
    setSavedPath(null)

    try {
      const data = await invokeCapabilityOrThrow({
        capability: 'thoughts.create',
        input: {
          folder_path: folderPath,
          filename,
          content,
          title: title.trim() || null,
          date_header: dateHeader,
          emotions,
        },
        actor: THOUGHTS_ACTOR,
      })

      setSavedPath(data.output_path)
      addRecent(STORAGE_KEY, folderSegments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const targetPath = folderPath.trim() && filename.trim()
    ? `${folderPath.replace(/\/$/, '')}/${filename.trim()}`
    : null

  const handleEditExisting = () => {
    if (!targetPath) return
    openFileForEdit(targetPath)
  }

  const handleCreateAnother = () => {
    setContent('')
    setTitle('')
    setFilename(todayFilename())
    setSavedPath(null)
    setError(null)
    clearAssistState()
  }

  const canSave = folderPath.trim() && filename.trim() && content.trim() && !saving

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
              defaultPath={['lifeblood_systems', 'sfdl']}
              onChange={handleFolderChange}
              requiredSuffixSegments={['thoughts']}
              previewLabel="Thought folder preview"
              storageKey={STORAGE_KEY}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
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
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Emotions</label>
            <EmotionTagger selected={emotions} onChange={setEmotions} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Filename</label>
              <input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="2026-02-09.md"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Title (optional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Becomes # Title at the top"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Content</label>
            <AiAssistControlsBlock
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              runningAction={assistRunningAction}
              loading={aiSelectionLoading}
              disabled={saving}
              onRun={(action) => { void runAssistAction(action, content) }}
            />

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

            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                if (assistSuggestion || assistError) clearAssistState()
              }}
              placeholder="What's on your mind?"
              className="min-h-[400px] w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={!canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>

            <Button
              variant="secondary"
              onClick={handleEditExisting}
              disabled={!targetPath || saving}
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit existing
            </Button>

            {savedPath && (
              <Button variant="outline" onClick={handleCreateAnother}>
                Create another
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

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
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
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Thoughts</h1>
              <p className="text-sm text-muted-foreground">
                Capture a thought and review them over time.
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
