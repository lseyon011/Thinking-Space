import {
  googleDocFileKindFromPathBlock,
  type GoogleDocFileKindBlock,
} from '@/services/lego_blocks/units/googleDocDocumentPathBlock'
import type {
  GoogleDocDescriptorBlock,
  GoogleDocDocumentModelBlock,
} from '@/services/lego_blocks/units/googleDocDocumentSchemaBlock'
import {
  extractGoogleDocIdFromUrlBlock,
  parseGoogleDriveShortcutBlock,
} from '@/services/lego_blocks/units/googleDriveShortcutBlock'

interface GoogleDocFilePayloadBlock {
  kind?: 'google_doc'
  fileId?: string
  title?: string
  url?: string
  openUrl?: string
  embedViewUrl?: string
  embedEditUrl?: string
  doc_id?: string
  documentId?: string
  file_id?: string
  resource_id?: string
  webViewLink?: string
}

export interface EncodedGoogleDocDocumentBlock {
  text: string
  bytes: Uint8Array
}

export function decodeGoogleDocDocumentBlock(path: string, input: { text?: string | null; isBinaryDocx?: boolean }): GoogleDocDocumentModelBlock {
  const kind = googleDocFileKindFromPathBlock(path)
  const isBinaryDocx = Boolean(input.isBinaryDocx)
  if (isBinaryDocx) {
    return {
      kind,
      descriptor: {
        kind: 'google_doc',
      },
      isBinaryDocx: true,
    }
  }

  const text = input.text ?? ''
  const descriptor = decodeDescriptorFromTextBlock(text, kind)
  return {
    kind,
    descriptor,
    isBinaryDocx: false,
  }
}

export function encodeGoogleDocDocumentBlock(document: GoogleDocDocumentModelBlock): EncodedGoogleDocDocumentBlock {
  const normalized = normalizeDescriptorBlock(document.descriptor)
  const text = `${JSON.stringify(normalized, null, 2)}\n`
  const bytes = new TextEncoder().encode(text)
  return { text, bytes }
}

export function resolveGoogleDocOpenUrlBlock(descriptor: GoogleDocDescriptorBlock): string | null {
  const normalized = normalizeDescriptorBlock(descriptor)
  if (normalized.openUrl?.trim()) return normalized.openUrl.trim()
  if (!normalized.fileId) return null
  return `https://docs.google.com/document/d/${encodeURIComponent(normalized.fileId)}/edit`
}

export function resolveGoogleDocEmbedUrlBlock(
  descriptor: GoogleDocDescriptorBlock,
  mode: 'view' | 'edit',
): string | null {
  const normalized = normalizeDescriptorBlock(descriptor)
  if (mode === 'edit' && normalized.embedEditUrl?.trim()) return normalized.embedEditUrl.trim()
  if (mode === 'view' && normalized.embedViewUrl?.trim()) return normalized.embedViewUrl.trim()
  if (!normalized.fileId) return null
  if (mode === 'edit') {
    return `https://docs.google.com/document/d/${encodeURIComponent(normalized.fileId)}/edit?rm=minimal`
  }
  return `https://docs.google.com/document/d/${encodeURIComponent(normalized.fileId)}/preview`
}

export function normalizeDescriptorBlock(input: GoogleDocDescriptorBlock): GoogleDocDescriptorBlock {
  const openUrl = input.openUrl?.trim() || undefined
  const embedViewUrl = input.embedViewUrl?.trim() || undefined
  const embedEditUrl = input.embedEditUrl?.trim() || undefined
  const inferredFileId = parseGoogleDocFileIdBlock(openUrl)

  return {
    kind: 'google_doc',
    fileId: sanitizeValueBlock(input.fileId) || inferredFileId || undefined,
    title: sanitizeValueBlock(input.title),
    openUrl,
    embedViewUrl,
    embedEditUrl,
  }
}

export function parseGoogleDocFileIdBlock(value: string | null | undefined): string | null {
  const text = value?.trim()
  if (!text) return null
  const byPath = text.match(/\/(?:document|file)\/d\/([A-Za-z0-9_-]+)/i)
  if (byPath?.[1]) return byPath[1]
  const byQuery = text.match(/[?&]id=([A-Za-z0-9_-]+)/i)
  if (byQuery?.[1]) return byQuery[1]
  if (/^[A-Za-z0-9_-]{16,}$/.test(text)) return text
  return null
}

function decodeDescriptorFromTextBlock(text: string, kind: GoogleDocFileKindBlock): GoogleDocDescriptorBlock {
  const trimmed = stripUtf8BomBlock(text).trim()
  if (!trimmed) {
    return {
      kind: 'google_doc',
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeDescriptorBlock({
      kind: 'google_doc',
      openUrl: trimmed,
      title: kind === 'docx' ? 'Google Drive DOCX' : 'Google Doc',
    })
  }

  try {
    const parsed = JSON.parse(trimmed) as GoogleDocFilePayloadBlock
    const openUrl = sanitizeValueBlock(parsed.openUrl)
      || sanitizeValueBlock(parsed.url)
      || sanitizeValueBlock(parsed.webViewLink)
    const parsedShortcut = parseGoogleDriveShortcutBlock(trimmed)
    return normalizeDescriptorBlock({
      kind: 'google_doc',
      fileId: sanitizeValueBlock(parsed.fileId)
        || sanitizeValueBlock(parsed.file_id)
        || sanitizeValueBlock(parsed.doc_id)
        || sanitizeValueBlock(parsed.documentId)
        || sanitizeValueBlock(parsed.resource_id)
        || parsedShortcut?.docId
        || parsedShortcut?.fileId
        || (openUrl ? extractGoogleDocIdFromUrlBlock(openUrl) ?? undefined : undefined),
      title: sanitizeValueBlock(parsed.title) || parsedShortcut?.title,
      openUrl: openUrl || parsedShortcut?.url,
      embedViewUrl: sanitizeValueBlock(parsed.embedViewUrl),
      embedEditUrl: sanitizeValueBlock(parsed.embedEditUrl),
    })
  } catch {
    const parsedShortcut = parseGoogleDriveShortcutBlock(trimmed)
    if (parsedShortcut) {
      return normalizeDescriptorBlock({
        kind: 'google_doc',
        fileId: parsedShortcut.docId || parsedShortcut.fileId,
        title: parsedShortcut.title || (kind === 'docx' ? 'Google Drive DOCX' : 'Google Doc'),
        openUrl: parsedShortcut.url,
      })
    }

    return normalizeDescriptorBlock({
      kind: 'google_doc',
      openUrl: trimmed,
      title: kind === 'docx' ? 'Google Drive DOCX' : 'Google Doc',
    })
  }
}

function sanitizeValueBlock(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function stripUtf8BomBlock(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
}
