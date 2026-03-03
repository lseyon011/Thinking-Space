import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, FileText, FolderOpen, Pencil, Save, Settings2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUILayoutBlock } from '@/components/lego_blocks/hooks/shared/useUILayoutBlock'
import {
  normalizeDescriptorBlock,
  parseGoogleDocFileIdBlock,
  resolveGoogleDocEmbedUrlBlock,
  resolveGoogleDocOpenUrlBlock,
} from '@/services/lego_blocks/integrations/googleDocDocumentCodecBlock'
import type { GoogleDocDocumentModelBlock } from '@/services/lego_blocks/units/googleDocDocumentSchemaBlock'
import {
  GoogleDocDocumentConflictError,
  readGoogleDocDocument,
  saveGoogleDocDocument,
} from '@/services/orchestrators/googleDocDocumentsOrch'
import {
  getOpenInSystemLabelOrch,
  openVaultPathInSystemOrch,
} from '@/services/orchestrators/fileSystemOrch'

type ViewerModeBlock = 'view' | 'edit'

interface GoogleDocDocumentBlockProps {
  path: string
  initialMode?: ViewerModeBlock
  onSaved?: (result: { output_path: string; revision_path: string | null }) => void
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

function GoogleDocDocumentBlock({
  path,
  initialMode = 'view',
  onSaved,
  onClose,
  showCloseButton = false,
  className,
}: GoogleDocDocumentBlockProps) {
  const { layout } = useUILayoutBlock()
  const isIosPhone = layout.surface === 'capacitor-ios' && layout.mode === 'phone'
  const [mode, setMode] = useState<ViewerModeBlock>(initialMode)
  const [document, setDocument] = useState<GoogleDocDocumentModelBlock | null>(null)
  const [draft, setDraft] = useState<GoogleDocDocumentModelBlock | null>(null)
  const [baseMtime, setBaseMtime] = useState<number | null>(null)
  const [baseHash, setBaseHash] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [openInSystemError, setOpenInSystemError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [conflict, setConflict] = useState<GoogleDocDocumentConflictError | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const loadDocument = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSaveError(null)
    setConflict(null)
    try {
      const result = await readGoogleDocDocument(path)
      setDocument(result.document)
      setDraft(result.document)
      setBaseMtime(result.mtime)
      setBaseHash(result.hash)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Google document')
      setDocument(null)
      setDraft(null)
      setBaseMtime(null)
      setBaseHash(null)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    setMode(initialMode)
    void loadDocument()
  }, [initialMode, loadDocument, path])

  useEffect(() => {
    if (!document) return
    setDraft(document)
  }, [document])

  const isEditing = mode === 'edit'

  const snapshotForCompare = useCallback((value: GoogleDocDocumentModelBlock | null): string => {
    if (!value) return ''
    return JSON.stringify({
      ...value,
      descriptor: normalizeDescriptorBlock(value.descriptor),
    })
  }, [])

  const hasChanges = useMemo(
    () => snapshotForCompare(draft) !== snapshotForCompare(document),
    [document, draft, snapshotForCompare],
  )

  const activeDocument = isEditing ? draft : document
  const openUrl = useMemo(
    () => (activeDocument ? resolveGoogleDocOpenUrlBlock(activeDocument.descriptor) : null),
    [activeDocument],
  )
  const embedUrl = useMemo(
    () => (activeDocument ? resolveGoogleDocEmbedUrlBlock(activeDocument.descriptor, isEditing ? 'edit' : 'view') : null),
    [activeDocument, isEditing],
  )
  const filename = path.split('/').pop() || path
  const breadcrumb = path.split('/').slice(0, -1).join(' / ')
  const openInSystemLabel = getOpenInSystemLabelOrch()
  const canOpenInSystem = openInSystemLabel !== null
  const openInSystemButtonLabel = openInSystemLabel ?? 'System'

  const updateDescriptor = useCallback((updater: (current: GoogleDocDocumentModelBlock) => GoogleDocDocumentModelBlock) => {
    setDraft((current) => {
      if (!current) return current
      return updater(current)
    })
    setSaveError(null)
    setConflict(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!draft || baseMtime === null) return
    if (draft.isBinaryDocx) {
      setSaveError('This DOCX file is binary. Add Google Doc metadata in a .gdoc file to edit in-app.')
      return
    }

    setSaving(true)
    setSaveError(null)
    setConflict(null)
    try {
      const result = await saveGoogleDocDocument({
        path,
        document: {
          ...draft,
          descriptor: normalizeDescriptorBlock(draft.descriptor),
        },
        baseMtime,
        baseHash,
      })
      const refreshed = await readGoogleDocDocument(path)
      setDocument(refreshed.document)
      setDraft(refreshed.document)
      setBaseMtime(refreshed.mtime)
      setBaseHash(refreshed.hash)
      onSaved?.(result)
      setMode('view')
      setShowSettings(false)
    } catch (err) {
      if (err instanceof GoogleDocDocumentConflictError) {
        setConflict(err)
        setSaveError(err.message)
      } else {
        setSaveError(err instanceof Error ? err.message : 'Failed to save Google document metadata')
      }
    } finally {
      setSaving(false)
    }
  }, [baseHash, baseMtime, draft, onSaved, path])

  const handleOpenInSystem = useCallback(() => {
    if (!canOpenInSystem) return
    setOpenInSystemError(null)
    void openVaultPathInSystemOrch(path).catch((err) => {
      setOpenInSystemError(err instanceof Error ? err.message : 'Failed to open file in system file manager')
    })
  }, [canOpenInSystem, path])

  const useLatestConflictVersion = useCallback(() => {
    if (!conflict) return
    setDocument(conflict.currentDocument)
    setDraft(conflict.currentDocument)
    setBaseMtime(conflict.currentMtime)
    setBaseHash(conflict.currentHash)
    setSaveError(null)
    setConflict(null)
  }, [conflict])

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-card p-2', className)}>
      <div className={cn(
        'ts-doc-header border-b border-border/50',
        isIosPhone ? 'px-4 py-3.5' : 'px-6 py-5',
      )}>
        <div className={cn(
          'flex items-start justify-between gap-3',
          isIosPhone && 'flex-col items-stretch',
        )}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{filename}</span>
            </div>
            {breadcrumb && <div className="mt-0.5 truncate text-xs text-muted-foreground">{breadcrumb}</div>}
          </div>

          <div className={cn(
            'flex shrink-0 items-center gap-1',
            isIosPhone && 'w-full min-w-0 flex-wrap justify-start gap-1.5',
          )}>
            {!isEditing && (
              <button
                type="button"
                onClick={() => {
                  setMode('edit')
                  setShowSettings(false)
                  setSaveError(null)
                  setConflict(null)
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Edit Google document settings"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}

            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => setShowSettings(v => !v)}
                  className={cn(
                    'inline-flex items-center gap-1 border border-border font-medium transition-colors',
                    isIosPhone ? 'h-7 rounded-md px-2 text-[11px]' : 'rounded-lg px-2.5 py-1 text-xs',
                    showSettings ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('view')
                    setDraft(document)
                    setShowSettings(false)
                    setSaveError(null)
                    setConflict(null)
                  }}
                  className={cn(
                    'border border-border font-medium hover:bg-muted',
                    isIosPhone ? 'h-7 rounded-md px-2 text-[11px]' : 'rounded-lg px-2.5 py-1 text-xs',
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSave() }}
                  disabled={saving || !hasChanges}
                  className={cn(
                    'inline-flex items-center gap-1 border border-border/70 font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
                    isIosPhone ? 'h-7 rounded-md px-2 text-[11px]' : 'rounded-lg px-2.5 py-1 text-xs',
                  )}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}

            {openUrl ? (
              <a
                href={openUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'inline-flex items-center gap-1 border border-border font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  isIosPhone ? 'h-7 rounded-md px-2 text-[11px]' : 'rounded-lg px-2.5 py-1 text-xs',
                )}
                title="Open in Google Docs"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Google Docs</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                className={cn(
                  'inline-flex items-center gap-1 border border-border text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-60',
                  isIosPhone ? 'h-7 rounded-md px-2 text-[11px]' : 'rounded-lg px-2.5 py-1 text-xs',
                )}
                title="Add file ID or open URL in Settings to enable Google Docs open"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Google Docs</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenInSystem}
              disabled={!canOpenInSystem}
              className={cn(
                'inline-flex items-center gap-1 border border-border font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
                isIosPhone ? 'h-7 rounded-md px-2 text-[11px]' : 'rounded-lg px-2.5 py-1 text-xs',
              )}
              title={canOpenInSystem ? `Open file in ${openInSystemButtonLabel}` : 'Open in system file manager is unavailable on web'}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{openInSystemButtonLabel}</span>
            </button>

            {showCloseButton && onClose && (
              <button
                onClick={onClose}
                className={cn(
                  'transition-colors hover:bg-muted',
                  isIosPhone ? 'rounded-md p-1.5' : 'rounded-lg p-1.5',
                )}
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {showSettings && isEditing && draft && (
        <div className={cn(
          'grid gap-2 border-b border-border/40 bg-muted/25',
          isIosPhone ? 'grid-cols-1 px-4 py-3' : 'grid-cols-2 px-6 py-4',
        )}>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Google file ID</span>
            <input
              type="text"
              value={draft.descriptor.fileId ?? ''}
              onChange={(event) => {
                const value = event.target.value
                updateDescriptor((current) => ({
                  ...current,
                  descriptor: normalizeDescriptorBlock({
                    ...current.descriptor,
                    fileId: value,
                  }),
                }))
              }}
              placeholder="1AbCdEf..."
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Open URL (optional)</span>
            <input
              type="text"
              value={draft.descriptor.openUrl ?? ''}
              onChange={(event) => {
                const value = event.target.value
                updateDescriptor((current) => ({
                  ...current,
                  descriptor: normalizeDescriptorBlock({
                    ...current.descriptor,
                    openUrl: value,
                    fileId: parseGoogleDocFileIdBlock(value) ?? current.descriptor.fileId,
                  }),
                }))
              }}
              placeholder="https://docs.google.com/document/d/.../edit"
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Embed view URL (optional)</span>
            <input
              type="text"
              value={draft.descriptor.embedViewUrl ?? ''}
              onChange={(event) => {
                const value = event.target.value
                updateDescriptor((current) => ({
                  ...current,
                  descriptor: normalizeDescriptorBlock({
                    ...current.descriptor,
                    embedViewUrl: value,
                  }),
                }))
              }}
              placeholder="https://docs.google.com/document/d/.../preview"
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Embed edit URL (optional)</span>
            <input
              type="text"
              value={draft.descriptor.embedEditUrl ?? ''}
              onChange={(event) => {
                const value = event.target.value
                updateDescriptor((current) => ({
                  ...current,
                  descriptor: normalizeDescriptorBlock({
                    ...current.descriptor,
                    embedEditUrl: value,
                  }),
                }))
              }}
              placeholder="https://docs.google.com/document/d/.../edit?rm=minimal"
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
            />
          </label>
        </div>
      )}

      {openInSystemError && (
        <div className="mx-6 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {openInSystemError}
        </div>
      )}

      {saveError && (
        <div className="mx-6 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {conflict && (
        <div className="mx-6 mt-3">
          <button
            type="button"
            onClick={useLatestConflictVersion}
            className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            Load latest file version
          </button>
        </div>
      )}

      <div className={cn('min-h-0 flex-1', isIosPhone ? 'px-3 pb-3 pt-3' : 'px-6 py-5')}>
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-muted/40" style={{ width: `${56 + Math.random() * 36}%` }} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-sm text-destructive">{error}</div>
        )}

        {!loading && !error && activeDocument?.isBinaryDocx && (
          <div className="rounded-lg border border-border/60 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
            This DOCX file is binary and cannot be embedded directly. Use a `.gdoc` file (or DOCX metadata JSON) to map a Google Drive file ID for inline view/edit.
          </div>
        )}

        {!loading && !error && !activeDocument?.isBinaryDocx && !embedUrl && (
          <div className="rounded-lg border border-border/60 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
            Add a Google file ID or URL in Settings to enable inline view/edit.
          </div>
        )}

        {!loading && !error && !activeDocument?.isBinaryDocx && embedUrl && (
          <iframe
            ref={iframeRef}
            title={`Google document ${filename}`}
            src={embedUrl}
            className="h-full min-h-[56vh] w-full rounded-xl border border-border/60 bg-background"
            allow="clipboard-read; clipboard-write"
          />
        )}
      </div>
    </div>
  )
}

export default memo(GoogleDocDocumentBlock)
