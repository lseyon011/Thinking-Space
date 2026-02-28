const PERSONAL_EXTENSION_NOTES_STORAGE_KEY_BLOCK = 'ltm-personal-extension-notes-v1'

export interface PersonalExtensionNoteBlock {
  id: string
  text: string
  createdAt: string
}

function parseNotesBlock(raw: string | null): PersonalExtensionNoteBlock[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((candidate): candidate is PersonalExtensionNoteBlock => (
        !!candidate
        && typeof candidate === 'object'
        && typeof (candidate as PersonalExtensionNoteBlock).id === 'string'
        && typeof (candidate as PersonalExtensionNoteBlock).text === 'string'
        && typeof (candidate as PersonalExtensionNoteBlock).createdAt === 'string'
      ))
      .map(note => ({
        id: note.id.trim(),
        text: note.text.trim(),
        createdAt: note.createdAt.trim(),
      }))
      .filter(note => note.id.length > 0 && note.text.length > 0 && note.createdAt.length > 0)
  } catch {
    return []
  }
}

function readStorageBlock(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(PERSONAL_EXTENSION_NOTES_STORAGE_KEY_BLOCK)
  } catch {
    return null
  }
}

function writeStorageBlock(notes: PersonalExtensionNoteBlock[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(PERSONAL_EXTENSION_NOTES_STORAGE_KEY_BLOCK, JSON.stringify(notes))
  } catch {
    // Ignore storage write failures on restricted runtimes.
  }
}

function createNoteIdBlock(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `personal-note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function listPersonalExtensionNotesBlock(): PersonalExtensionNoteBlock[] {
  return parseNotesBlock(readStorageBlock())
}

export function appendPersonalExtensionNoteBlock(text: string): PersonalExtensionNoteBlock {
  const normalized = text.trim()
  if (!normalized) {
    throw new Error('Note text is required.')
  }

  const nextNote: PersonalExtensionNoteBlock = {
    id: createNoteIdBlock(),
    text: normalized,
    createdAt: new Date().toISOString(),
  }
  const previous = listPersonalExtensionNotesBlock()
  const next = [nextNote, ...previous].slice(0, 100)
  writeStorageBlock(next)
  return nextNote
}

export function clearPersonalExtensionNotesBlock(): void {
  writeStorageBlock([])
}
