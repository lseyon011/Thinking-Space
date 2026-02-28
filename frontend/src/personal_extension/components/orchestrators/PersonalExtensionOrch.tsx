import { useCallback, useEffect, useState } from 'react'
import PersonalExtensionPanelBlock from '../lego_blocks/integrations/PersonalExtensionPanelBlock'
import {
  createPersonalExtensionNoteOrch,
  clearPersonalExtensionWorkspaceOrch,
  loadPersonalExtensionWorkspaceOrch,
  type PersonalExtensionRuntimeSurfaceOrch,
} from '../../services/orchestrators/personalExtensionOrch'
import type { PersonalExtensionNoteBlock } from '../../services/lego_blocks/units/personalExtensionStoreBlock'

export default function PersonalExtensionOrch() {
  const [runtime, setRuntime] = useState<PersonalExtensionRuntimeSurfaceOrch>('web')
  const [notes, setNotes] = useState<PersonalExtensionNoteBlock[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const workspace = loadPersonalExtensionWorkspaceOrch()
    setRuntime(workspace.runtime)
    setNotes(workspace.notes)
  }, [])

  const handleCreateNote = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    setLoading(true)
    setError(null)
    try {
      const workspace = createPersonalExtensionNoteOrch(text)
      setRuntime(workspace.runtime)
      setNotes(workspace.notes)
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note.')
    } finally {
      setLoading(false)
    }
  }, [draft])

  const handleClearNotes = useCallback(() => {
    setLoading(true)
    setError(null)
    try {
      const workspace = clearPersonalExtensionWorkspaceOrch()
      setRuntime(workspace.runtime)
      setNotes(workspace.notes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear notes.')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <PersonalExtensionPanelBlock
      runtime={runtime}
      notes={notes}
      draft={draft}
      loading={loading}
      error={error}
      onDraftChange={setDraft}
      onCreateNote={handleCreateNote}
      onClearNotes={handleClearNotes}
    />
  )
}
