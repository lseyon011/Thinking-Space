import { useEffect, useState } from 'react'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import { useProjectsBlock } from '@/components/lego_blocks/hooks/shared/useProjectsBlock'
import {
  addProjectBlock,
  removeProjectBlock,
  updateProjectBlock,
} from '@/services/lego_blocks/integrations/projectsStorageBlock'
import type { ProjectBlock } from '@/services/lego_blocks/units/projectBlock'

/**
 * ProjectsSettingsBlock — Projects sub-page rendered inside the existing
 * SettingsOrch. Lets the user create / rename / delete projects and edit
 * the mission statement that canvas surfaces read.
 *
 * Source of truth: `.thinking-space/projects.json` via projectsStorageBlock.
 * On every write the storage block dispatches a window event that all
 * `useProjectsBlock` consumers (this page + canvas anchors + pickers) listen
 * to, so edits propagate live.
 */
export default function ProjectsSettingsBlock() {
  const { projects, loading } = useProjectsBlock()
  const [drafts, setDrafts] = useState<Record<string, { name: string; mission: string }>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newMission, setNewMission] = useState('')

  // Sync draft buffers when the persisted list changes (covers external edits +
  // post-save echoes from the change event).
  useEffect(() => {
    setDrafts(prev => {
      const next: Record<string, { name: string; mission: string }> = {}
      for (const project of projects) {
        next[project.id] = prev[project.id] ?? { name: project.name, mission: project.mission }
      }
      return next
    })
  }, [projects])

  const dirtyIds = projects.filter(project => {
    const draft = drafts[project.id]
    if (!draft) return false
    return draft.name !== project.name || draft.mission !== project.mission
  }).map(p => p.id)

  const updateDraft = (id: string, patch: Partial<{ name: string; mission: string }>) => {
    setDrafts(prev => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }))
    setMessage(null)
    setError(null)
  }

  const onSave = async (project: ProjectBlock) => {
    const draft = drafts[project.id]
    if (!draft) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await updateProjectBlock(project.id, { name: draft.name, mission: draft.mission })
      setMessage(`Saved "${draft.name.trim() || project.name}".`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project.')
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async (project: ProjectBlock) => {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(`Delete project "${project.name}"? Canvases bound to it will fall back to the first project.`)
      : true
    if (!confirmed) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await removeProjectBlock(project.id)
      setMessage(`Deleted "${project.name}".`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project.')
    } finally {
      setBusy(false)
    }
  }

  const onAdd = async () => {
    const name = newName.trim()
    if (!name) {
      setError('Project name cannot be empty.')
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await addProjectBlock({ name, mission: newMission })
      setNewName('')
      setNewMission('')
      setMessage(`Added "${name}".`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add project.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>
            Lightweight contexts you can bind to any canvas surface (Home, Webull F9, ...). Each canvas
            shows the bound project's name as its heading and its mission underneath.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
              Loading projects...
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
              No projects yet. Add one below — canvas surfaces will pick it up automatically.
            </div>
          )}

          <div className="space-y-3">
            {projects.map(project => {
              const draft = drafts[project.id] ?? { name: project.name, mission: project.mission }
              const isDirty = dirtyIds.includes(project.id)
              return (
                <div key={project.id} className="space-y-2 rounded-md border border-border/60 p-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Name</label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={e => updateDraft(project.id, { name: e.target.value })}
                      placeholder="Project name"
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:border-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Mission</label>
                    <textarea
                      value={draft.mission}
                      onChange={e => updateDraft(project.id, { mission: e.target.value })}
                      placeholder="A one- or two-line statement of what this project is about."
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-ring"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => { void onSave(project) }}
                      disabled={busy || !isDirty}
                    >
                      {busy ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => updateDraft(project.id, { name: project.name, mission: project.mission })}
                      disabled={busy || !isDirty}
                    >
                      Reset
                    </Button>
                    <span className="flex-1" />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => { void onRemove(project) }}
                      disabled={busy}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="space-y-2 border-t border-border/60 pt-4">
            <h3 className="text-sm font-medium">Add Project</h3>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Project name"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
            />
            <textarea
              value={newMission}
              onChange={e => setNewMission(e.target.value)}
              placeholder="Mission (optional)"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <Button
              type="button"
              onClick={() => { void onAdd() }}
              disabled={busy || !newName.trim()}
            >
              {busy ? 'Adding...' : 'Add Project'}
            </Button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
