import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckSquare, Loader2, CheckCircle2, LayoutList, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/lego_blocks/ui/card'
import { Button } from '@/components/lego_blocks/ui/button'
import CascadingFolderPicker, { addRecent } from '@/components/lego_blocks/CascadingFolderPickerBlock'
import TodoCalendarOrch from '@/components/orchestrators/TodoCalendarOrch'
import { createTodos } from '@/services/orchestrators/todosOrch'

type Tab = 'create' | 'view'

const STORAGE_KEY = 'ltm-todos-recents'

function todayDateStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function CreateTab() {
  const [folderSegments, setFolderSegments] = useState<string[]>([])
  const [folderPath, setFolderPath] = useState('')
  const [dateStr, setDateStr] = useState(todayDateStr())
  const [tasksText, setTasksText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [itemsAdded, setItemsAdded] = useState(0)

  const handleFolderChange = (segments: string[], fullPath: string) => {
    setFolderSegments(segments)
    setFolderPath(fullPath)
    setSavedPath(null)
    setError(null)
  }

  const handleSave = async () => {
    const items = tasksText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)

    if (!folderPath.trim() || !dateStr.trim() || items.length === 0) return

    setSaving(true)
    setError(null)
    setSavedPath(null)

    try {
      const data = await createTodos(
        folderPath.replace(/\/todos\/?$/, '') + '/todos',
        dateStr,
        items,
      )

      setSavedPath(data.output_path)
      setItemsAdded(data.items_added)
      addRecent(STORAGE_KEY, folderSegments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateAnother = () => {
    setTasksText('')
    setDateStr(todayDateStr())
    setSavedPath(null)
    setError(null)
  }

  const itemCount = tasksText.split('\n').filter(l => l.trim()).length
  const canSave = folderPath.trim() && dateStr.trim() && itemCount > 0 && !saving

  return (
    <div className="grid gap-6 lg:grid-cols-[clamp(240px,27vw,340px)_minmax(0,1fr)]">
      {/* Sidebar - folder picker */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Destination</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 pb-4">
              <label className="text-xs text-muted-foreground">Folder path</label>
              <input
                value={folderPath}
                onChange={(e) => {
                  const next = e.target.value
                  setFolderPath(next)
                  setFolderSegments(next.split('/').filter(Boolean))
                  setSavedPath(null)
                  setError(null)
                }}
                placeholder="acceleration_core/F9"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
            <CascadingFolderPicker
              defaultPath={['lifeblood_systems', 'sfdl']}
              onChange={handleFolderChange}
              storageKey={STORAGE_KEY}
            />
            {folderPath && (
              <p className="text-[11px] text-muted-foreground/60 mt-2">
                Saves to <span className="font-medium">{folderPath.replace(/\/todos\/?$/, '')}/todos/</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main area - date + tasks */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Date</label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="h-10 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Tasks</label>
              {itemCount > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
              )}
            </div>
            <textarea
              value={tasksText}
              onChange={(e) => setTasksText(e.target.value)}
              placeholder="One task per line..."
              className="min-h-[300px] w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={!canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
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
                {itemsAdded} task{itemsAdded !== 1 ? 's' : ''} saved to{' '}
                <span className="font-medium text-foreground">{savedPath}</span>
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

export default function Todos() {
  const [tab, setTab] = useState<Tab>('create')

  return (
    <div className="ltm-page">
      <div className="ltm-page-shell ltm-shell-wide">
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
              <CheckSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Todos</h1>
              <p className="text-sm text-muted-foreground">
                Create and track tasks across vault sections.
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
        {tab === 'view' && <TodoCalendarOrch />}
      </div>
    </div>
  )
}
