import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, FileText, FolderOpen, Pencil, Save, Settings2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUILayoutBlock } from '@/components/lego_blocks/hooks/shared/useUILayoutBlock'
import GoogleWorkspaceViewerBlock from '@/components/lego_blocks/integrations/GoogleWorkspaceViewerBlock'
import {
  normalizeDescriptorBlock,
  parseGoogleDocFileIdBlock,
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
  openExternalUrlOrch,
  openVaultPathInSystemOrch,
} from '@/services/orchestrators/fileSystemOrch'
import {
  readGoogleDriveAuthOrch,
  type GoogleDriveAuthStateOrch,
} from '@/services/orchestrators/googleDriveAuthOrch'
import {
  listGoogleDriveDocumentsOrch,
  type GoogleDriveFilePickerItemOrch,
} from '@/services/orchestrators/googleDrivePickerOrch'
import { isGoogleDriveVaultOrch } from '@/services/orchestrators/googleDriveVaultOrch'

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
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [conflict, setConflict] = useState<GoogleDocDocumentConflictError | null>(null)
  const [googleAuth, setGoogleAuth] = useState<GoogleDriveAuthStateOrch | null>(() => readGoogleDriveAuthOrch())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerItems, setPickerItems] = useState<GoogleDriveFilePickerItemOrch[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)

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
  const filename = path.split('/').pop() || path
  const breadcrumb = path.split('/').slice(0, -1).join(' / ')
  const openInSystemLabel = getOpenInSystemLabelOrch()
  const canOpenInSystem = openInSystemLabel !== null
  const openInSystemButtonLabel = openInSystemLabel ?? 'System'
  const canOpenGoogleDocs = Boolean(openUrl) || canOpenInSystem
  const isGoogleDriveVault = useMemo(() => isGoogleDriveVaultOrch(), [])
  const hasGoogleConnection = Boolean(googleAuth?.accessToken)

  useEffect(() => {
    if (!isEditing) {
      setPickerOpen(false)
      setPickerQuery('')
      setPickerError(null)
      setShowAdvancedFields(false)
    }
  }, [isEditing])

  useEffect(() => {
    if (!showSettings) {
      setPickerOpen(false)
      setPickerQuery('')
      setPickerError(null)
      setShowAdvancedFields(false)
      return
    }
    setGoogleAuth(readGoogleDriveAuthOrch())
  }, [showSettings])

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

  const handleOpenGoogleDocs = useCallback(() => {
    setOpenInSystemError(null)
    if (openUrl) {
      void openExternalUrlOrch(openUrl).catch((err) => {
        setOpenInSystemError(err instanceof Error ? err.message : 'Failed to open Google Docs')
      })
      return
    }
    if (!canOpenInSystem) return
    void openVaultPathInSystemOrch(path).catch((err) => {
      setOpenInSystemError(err instanceof Error ? err.message : 'Failed to open file in system file manager')
    })
  }, [canOpenInSystem, openUrl, path])

  const loadGoogleDocsPicker = useCallback(async (query: string) => {
    setPickerLoading(true)
    setPickerError(null)
    try {
      const items = await listGoogleDriveDocumentsOrch({
        query,
        pageSize: isIosPhone ? 15 : 24,
      })
      setPickerItems(items)
    } catch (err) {
      setPickerItems([])
      setPickerError(err instanceof Error ? err.message : 'Failed to load Google Drive documents')
    } finally {
      setPickerLoading(false)
    }
  }, [isIosPhone])

  useEffect(() => {
    if (!pickerOpen || !showSettings || !isEditing || !hasGoogleConnection) return
    const handle = window.setTimeout(() => {
      void loadGoogleDocsPicker(pickerQuery.trim())
    }, 220)
    return () => {
      window.clearTimeout(handle)
    }
  }, [hasGoogleConnection, isEditing, loadGoogleDocsPicker, pickerOpen, pickerQuery, showSettings])

  const handlePickGoogleDoc = useCallback((item: GoogleDriveFilePickerItemOrch) => {
    updateDescriptor((current) => ({
      ...current,
      descriptor: normalizeDescriptorBlock({
        ...current.descriptor,
        fileId: item.id,
        title: item.name,
        openUrl: item.webViewLink || `https://docs.google.com/document/d/${encodeURIComponent(item.id)}/edit`,
      }),
    }))
    setPickerOpen(false)
    setPickerQuery('')
    setPickerError(null)
  }, [updateDescriptor])

  const useLatestConflictVersion = useCallback(() => {
    if (!conflict) return
    setDocument(conflict.currentDocument)
    setDraft(conflict.currentDocument)
    setBaseMtime(conflict.currentMtime)
    setBaseHash(conflict.currentHash)
    setSaveError(null)
    setConflict(null)
  }, [conflict])

  const showWorkspaceViewer = !loading && !error && !activeDocument?.isBinaryDocx && Boolean(openUrl)

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-card', className)}>
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

            <button
              type="button"
              onClick={handleOpenGoogleDocs}
              disabled={!canOpenGoogleDocs}
              className={cn(
                'inline-flex items-center gap-1 border border-border font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground',
                isIosPhone ? 'h-7 rounded-md px-2 text-[11px]' : 'rounded-lg px-2.5 py-1 text-xs',
              )}
              title={openUrl
                ? 'Open in Google Docs'
                : canOpenInSystem
                  ? `Open file in ${openInSystemButtonLabel}`
                  : 'Add file ID or open URL in Settings to enable Google Docs open'}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Google Docs</span>
            </button>

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
          <div className={cn(
            'space-y-2 rounded-md border border-border/60 bg-background/65 p-2.5',
            isIosPhone ? 'col-span-1' : 'col-span-2',
          )}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen((value) => !value)}
                disabled={!hasGoogleConnection}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-55"
              >
                {pickerOpen ? 'Hide Drive Docs' : 'Pick from Drive'}
              </button>
              {isGoogleDriveVault && (
                <button
                  type="button"
                  onClick={() => setShowAdvancedFields((value) => !value)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                >
                  {showAdvancedFields ? 'Hide Advanced' : 'Show Advanced'}
                </button>
              )}
            </div>

            {pickerOpen && hasGoogleConnection && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={pickerQuery}
                  onChange={(event) => setPickerQuery(event.target.value)}
                  placeholder="Search Google Docs"
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                />
                <div className="max-h-44 overflow-auto rounded-md border border-border/60 bg-background/70">
                  {pickerLoading && (
                    <div className="px-2.5 py-2 text-xs text-muted-foreground">Loading Google Docs...</div>
                  )}
                  {!pickerLoading && pickerItems.length === 0 && (
                    <div className="px-2.5 py-2 text-xs text-muted-foreground">No matching Google Docs found.</div>
                  )}
                  {!pickerLoading && pickerItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handlePickGoogleDoc(item)}
                      className="flex w-full items-center justify-between gap-3 border-b border-border/40 px-2.5 py-2 text-left text-xs last:border-b-0 hover:bg-muted/60"
                    >
                      <span className="min-w-0 truncate">{item.name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{item.id.slice(0, 8)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pickerError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
                {pickerError}
              </div>
            )}

            {!hasGoogleConnection && (
              <div className="text-[11px] text-muted-foreground">
                Connect Google in Settings {'>'} Google Docs and Sheets only if you want Drive picker. Opening/editing docs does not require OAuth setup here.
              </div>
            )}
          </div>

          {(!isGoogleDriveVault || showAdvancedFields) && (
            <>
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
            </>
          )}

          {isGoogleDriveVault && !showAdvancedFields && (
            <div className={cn(
              'text-xs text-muted-foreground',
              isIosPhone ? 'col-span-1' : 'col-span-2',
            )}>
              Google Drive vault detected. Manual IDs/URLs are hidden by default.
            </div>
          )}
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

      <div className={cn(
        'min-h-0 flex-1',
        showWorkspaceViewer
          ? 'overflow-hidden'
          : (isIosPhone ? 'px-3 pb-3 pt-3' : 'px-6 py-5'),
      )}>
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
            This DOCX file is binary and cannot be embedded directly. Use a `.gdoc` file (or DOCX metadata JSON) to map a Google Drive file ID for Google Docs editing.
          </div>
        )}

        {!loading && !error && !activeDocument?.isBinaryDocx && !openUrl && (
          <div className="rounded-lg border border-border/60 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
            {isGoogleDriveVault
              ? 'No Google Doc URL was found yet. Open Settings and use Pick from Drive, or open this file in Google Docs once to validate the shortcut metadata.'
              : 'Add a Google file ID or URL in Settings to open/edit this file in Google Docs.'}
          </div>
        )}

        {showWorkspaceViewer && (
          <GoogleWorkspaceViewerBlock
            title={`Google document ${filename}`}
            url={openUrl!}
          />
        )}
      </div>
    </div>
  )
}

export default memo(GoogleDocDocumentBlock)
