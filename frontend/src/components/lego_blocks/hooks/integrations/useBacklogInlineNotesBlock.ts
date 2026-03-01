import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NodeRecord } from '@/services/lego_blocks/integrations/dbBlock'
import type { YAMLCommentEntry } from '@/services/lego_blocks/units/yamlNoteBlock'
import { notesSignature } from '@/components/lego_blocks/units/BacklogListDomainBlock'
import { getUserCommentAuthorBlock } from '@/services/lego_blocks/units/userProfileBlock'

interface UseBacklogInlineNotesBlockParams {
  readOnly: boolean
  allowInReadOnly?: boolean
  onUpdateNodeNotes?: (node: NodeRecord, description: string, comments: YAMLCommentEntry[]) => Promise<NodeRecord | void>
  patchCachedNode: (updatedNode: NodeRecord) => void
  setLocalError: (message: string | null) => void
}

interface UseBacklogInlineNotesBlockResult {
  inlineNotesNode: NodeRecord | null
  inlineNotesDescriptionDraft: string
  inlineNotesCommentsDraft: YAMLCommentEntry[]
  inlineNotesCommentDraft: string
  inlineNotesSaving: boolean
  inlineNotesDirty: boolean
  setInlineNotesDescriptionDraft: (nextDescription: string) => void
  setInlineNotesCommentDraft: (nextComment: string) => void
  toggleInlineNotes: (node: NodeRecord) => Promise<void>
  addInlineCommentDraft: () => void
  removeInlineCommentDraft: (index: number) => void
}

export function useBacklogInlineNotesBlock({
  readOnly,
  allowInReadOnly = false,
  onUpdateNodeNotes,
  patchCachedNode,
  setLocalError,
}: UseBacklogInlineNotesBlockParams): UseBacklogInlineNotesBlockResult {
  const notesReadOnly = readOnly && !allowInReadOnly
  const [inlineNotesNode, setInlineNotesNode] = useState<NodeRecord | null>(null)
  const [inlineNotesDescriptionDraft, setInlineNotesDescriptionDraft] = useState('')
  const [inlineNotesCommentsDraft, setInlineNotesCommentsDraft] = useState<YAMLCommentEntry[]>([])
  const [inlineNotesCommentDraft, setInlineNotesCommentDraft] = useState('')
  const [inlineNotesSaving, setInlineNotesSaving] = useState(false)
  const [inlineNotesBaselineSignature, setInlineNotesBaselineSignature] = useState<string | null>(null)
  const inlineNotesSessionRef = useRef(0)
  const inlineNotesAutoSaveSignatureRef = useRef<string | null>(null)

  const saveInlineNotesSnapshot = useCallback(async (
    node: NodeRecord,
    descriptionDraft: string,
    commentsDraft: YAMLCommentEntry[],
  ): Promise<NodeRecord> => {
    if (!onUpdateNodeNotes) return node
    const description = descriptionDraft.trim()
    const comments = commentsDraft
    const updated = await onUpdateNodeNotes(node, description, comments)
    const nextNode = updated ?? { ...node, description, comments }
    patchCachedNode(nextNode)
    return nextNode
  }, [onUpdateNodeNotes, patchCachedNode])

  const closeInlineNotes = useCallback(() => {
    inlineNotesSessionRef.current += 1
    inlineNotesAutoSaveSignatureRef.current = null
    setInlineNotesNode(null)
    setInlineNotesDescriptionDraft('')
    setInlineNotesCommentsDraft([])
    setInlineNotesCommentDraft('')
    setInlineNotesBaselineSignature(null)
  }, [])

  const openInlineNotes = useCallback((node: NodeRecord) => {
    const initialDescription = (node.description ?? '').trim()
    const initialComments = node.comments ?? []
    inlineNotesSessionRef.current += 1
    inlineNotesAutoSaveSignatureRef.current = null
    setInlineNotesDescriptionDraft(initialDescription)
    setInlineNotesCommentsDraft(initialComments)
    setInlineNotesCommentDraft('')
    setInlineNotesBaselineSignature(notesSignature(initialDescription, initialComments))
    setInlineNotesNode(node)
  }, [])

  const addInlineCommentDraft = useCallback(() => {
    const next = inlineNotesCommentDraft.trim()
    if (!next) return
    setInlineNotesCommentsDraft(prev => [
      ...prev,
      {
        text: next,
        added_at: new Date().toISOString(),
        added_by: getUserCommentAuthorBlock(),
      },
    ])
    setInlineNotesCommentDraft('')
  }, [inlineNotesCommentDraft])

  const removeInlineCommentDraft = useCallback((index: number) => {
    setInlineNotesCommentsDraft(prev => prev.filter((_, idx) => idx !== index))
  }, [])

  const commitInlineNotes = useCallback(async (): Promise<void> => {
    if (!inlineNotesNode || !onUpdateNodeNotes) return
    if (inlineNotesSaving) return

    const description = inlineNotesDescriptionDraft.trim()
    const comments = inlineNotesCommentsDraft
    const signature = notesSignature(description, comments)
    if (signature === inlineNotesBaselineSignature) return

    const activeSession = inlineNotesSessionRef.current
    setInlineNotesSaving(true)
    setLocalError(null)
    try {
      const nextNode = await saveInlineNotesSnapshot(inlineNotesNode, description, comments)
      if (inlineNotesSessionRef.current !== activeSession) return
      setInlineNotesNode(nextNode)
      setInlineNotesBaselineSignature(notesSignature(nextNode.description ?? '', nextNode.comments ?? []))
      inlineNotesAutoSaveSignatureRef.current = signature
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to update notes')
    } finally {
      setInlineNotesSaving(false)
    }
  }, [
    inlineNotesBaselineSignature,
    inlineNotesCommentsDraft,
    inlineNotesDescriptionDraft,
    inlineNotesNode,
    inlineNotesSaving,
    onUpdateNodeNotes,
    saveInlineNotesSnapshot,
    setLocalError,
  ])

  const inlineNotesPayloadSignature = useMemo(() => (
    inlineNotesNode
      ? notesSignature(inlineNotesDescriptionDraft, inlineNotesCommentsDraft)
      : null
  ), [inlineNotesCommentsDraft, inlineNotesDescriptionDraft, inlineNotesNode])

  const inlineNotesDirty = inlineNotesNode
    ? inlineNotesPayloadSignature !== inlineNotesBaselineSignature
    : false

  useEffect(() => {
    if (!inlineNotesNode || !onUpdateNodeNotes || notesReadOnly) return
    if (inlineNotesSaving || !inlineNotesDirty) return
    if (!inlineNotesPayloadSignature) return
    if (inlineNotesAutoSaveSignatureRef.current === inlineNotesPayloadSignature) return

    const timeoutId = window.setTimeout(() => {
      inlineNotesAutoSaveSignatureRef.current = inlineNotesPayloadSignature
      void commitInlineNotes()
    }, 900)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    commitInlineNotes,
    inlineNotesDirty,
    inlineNotesNode,
    inlineNotesPayloadSignature,
    inlineNotesSaving,
    notesReadOnly,
    onUpdateNodeNotes,
  ])

  const toggleInlineNotes = useCallback(async (node: NodeRecord) => {
    if (notesReadOnly || !onUpdateNodeNotes || inlineNotesSaving) return
    setLocalError(null)

    const activeNode = inlineNotesNode
    if (activeNode) {
      const currentSignature = notesSignature(inlineNotesDescriptionDraft, inlineNotesCommentsDraft)
      const activeDirty = currentSignature !== inlineNotesBaselineSignature
      if (activeDirty) {
        setInlineNotesSaving(true)
        try {
          const persisted = await saveInlineNotesSnapshot(activeNode, inlineNotesDescriptionDraft, inlineNotesCommentsDraft)
          setInlineNotesBaselineSignature(notesSignature(persisted.description ?? '', persisted.comments ?? []))
          setInlineNotesNode(persisted)
        } catch (err) {
          setLocalError(err instanceof Error ? err.message : 'Failed to update notes')
          return
        } finally {
          setInlineNotesSaving(false)
        }
      }
    }

    if (inlineNotesNode?.uuid === node.uuid) {
      closeInlineNotes()
      return
    }

    openInlineNotes(node)
  }, [
    closeInlineNotes,
    inlineNotesBaselineSignature,
    inlineNotesCommentsDraft,
    inlineNotesDescriptionDraft,
    inlineNotesNode,
    inlineNotesSaving,
    onUpdateNodeNotes,
    openInlineNotes,
    notesReadOnly,
    saveInlineNotesSnapshot,
    setLocalError,
  ])

  return {
    inlineNotesNode,
    inlineNotesDescriptionDraft,
    inlineNotesCommentsDraft,
    inlineNotesCommentDraft,
    inlineNotesSaving,
    inlineNotesDirty,
    setInlineNotesDescriptionDraft,
    setInlineNotesCommentDraft,
    toggleInlineNotes,
    addInlineCommentDraft,
    removeInlineCommentDraft,
  }
}
