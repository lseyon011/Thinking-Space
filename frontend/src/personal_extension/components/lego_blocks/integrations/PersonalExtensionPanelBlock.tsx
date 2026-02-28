import { Button } from '@/components/lego_blocks/units/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import type { PersonalExtensionNoteBlock } from '@/personal_extension/services/lego_blocks/units/personalExtensionStoreBlock'
import type { PersonalExtensionRuntimeSurfaceOrch } from '@/personal_extension/services/orchestrators/personalExtensionOrch'

interface PersonalExtensionPanelBlockProps {
  runtime: PersonalExtensionRuntimeSurfaceOrch
  notes: PersonalExtensionNoteBlock[]
  draft: string
  loading: boolean
  error: string | null
  onDraftChange: (value: string) => void
  onCreateNote: () => void
  onClearNotes: () => void
}

function formatRuntimeLabelBlock(runtime: PersonalExtensionRuntimeSurfaceOrch): string {
  if (runtime === 'electron') return 'Electron'
  if (runtime === 'capacitor') return 'Capacitor'
  return 'Web'
}

function formatTimestampBlock(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

export default function PersonalExtensionPanelBlock({
  runtime,
  notes,
  draft,
  loading,
  error,
  onDraftChange,
  onCreateNote,
  onClearNotes,
}: PersonalExtensionPanelBlockProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Personal Notes</CardTitle>
          <CardDescription>Quick capture pad for your personal extension workflow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={draft}
            onChange={event => onDraftChange(event.target.value)}
            placeholder="Write a note and save it locally..."
            className="min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onCreateNote} disabled={loading || draft.trim().length === 0}>
              Save Note
            </Button>
            <Button variant="outline" onClick={onClearNotes} disabled={loading || notes.length === 0}>
              Clear All
            </Button>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
          <CardDescription>Runtime and state managed by personal extension services.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="font-medium">Runtime:</span> {formatRuntimeLabelBlock(runtime)}</p>
          <p><span className="font-medium">Saved notes:</span> {notes.length}</p>
          {notes.length > 0 ? (
            <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border p-2">
              {notes.map(note => (
                <div key={note.id} className="rounded-md bg-muted/50 p-2">
                  <p className="whitespace-pre-wrap text-sm">{note.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatTimestampBlock(note.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No notes yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
