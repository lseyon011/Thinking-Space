import { memo, useCallback, useEffect, useId, useMemo, useState } from 'react'
import * as Toolbar from '@radix-ui/react-toolbar'
import {
  DataSheetGrid,
  keyColumn,
  textColumn,
} from 'react-datasheet-grid'
import 'react-datasheet-grid/dist/style.css'
import { CloudDownload, CloudUpload, FileSpreadsheet, Pencil, Plus, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  pullGoogleSheetDocumentBlock,
  pushGoogleSheetDocumentBlock,
} from '@/services/lego_blocks/integrations/tableDocumentCodecBlock'
import type {
  TableCellAlign,
  TableCellFormatBlock,
  TableDocumentBlock as TableDocumentModelBlock,
  TableSheetBlock,
} from '@/services/lego_blocks/units/tableDocumentSchemaBlock'
import {
  TableDocumentConflictError,
  readTableDocument,
  saveTableDocument,
} from '@/services/orchestrators/tableDocumentsOrch'

type ViewerMode = 'view' | 'edit'
type GridRowBlock = Record<string, string | null>

interface TableDocumentBlockProps {
  path: string
  initialMode?: ViewerMode
  onSaved?: (result: { output_path: string; revision_path: string | null }) => void
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

interface GridCellWithIdBlock {
  col: number
  row: number
}

interface GridSelectionWithIdBlock {
  min: GridCellWithIdBlock
  max: GridCellWithIdBlock
}

interface SelectionRangeBlock {
  start: GridCellWithIdBlock
  end: GridCellWithIdBlock
}

function TableDocumentBlock({
  path,
  initialMode = 'view',
  onSaved,
  onClose,
  showCloseButton = false,
  className,
}: TableDocumentBlockProps) {
  const [mode, setMode] = useState<ViewerMode>(initialMode)
  const [document, setDocument] = useState<TableDocumentModelBlock | null>(null)
  const [draft, setDraft] = useState<TableDocumentModelBlock | null>(null)
  const [baseMtime, setBaseMtime] = useState<number | null>(null)
  const [baseHash, setBaseHash] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncingPull, setSyncingPull] = useState(false)
  const [syncingPush, setSyncingPush] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [conflict, setConflict] = useState<TableDocumentConflictError | null>(null)
  const [activeCell, setActiveCell] = useState<GridCellWithIdBlock | null>(null)
  const [selection, setSelection] = useState<GridSelectionWithIdBlock | null>(null)
  const scopeId = useId()

  const gridScopeClass = useMemo(() => {
    const suffix = scopeId.replace(/[^a-zA-Z0-9_-]/g, '')
    return `table-document-grid-${suffix}`
  }, [scopeId])

  const loadDocument = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSaveError(null)
    setConflict(null)
    setSuccessMessage(null)
    try {
      const result = await readTableDocument(path)
      setDocument(result.document)
      setDraft(result.document)
      setBaseMtime(result.mtime)
      setBaseHash(result.hash)
      setActiveCell({ row: 0, col: 0 })
      setSelection({ min: { row: 0, col: 0 }, max: { row: 0, col: 0 } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table')
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

  const activeSheet = useMemo(() => {
    if (!draft) return null
    return draft.sheets.find(sheet => sheet.id === draft.activeSheetId) ?? draft.sheets[0] ?? null
  }, [draft])

  const isEditing = mode === 'edit'

  const hasChanges = useMemo(() => {
    if (!draft || !document) return false
    return JSON.stringify(draft) !== JSON.stringify(document)
  }, [draft, document])

  const filename = path.split('/').pop() || path
  const breadcrumb = path.split('/').slice(0, -1).join(' / ')

  const columnCount = useMemo(() => {
    if (!activeSheet) return 1
    return Math.max(1, activeSheet.rows.reduce((max, row) => Math.max(max, row.length), 1))
  }, [activeSheet])

  const activeSheetRows = useMemo(() => {
    if (!activeSheet) return [[{ value: '', format: undefined }]]
    return ensureTableRectBlock(activeSheet.rows, Math.max(1, activeSheet.rows.length), columnCount)
  }, [activeSheet, columnCount])

  const canPersistCellFormatting = draft?.kind === 'xlsx'

  const rowCount = activeSheetRows.length

  const selectedBounds = useMemo(() => {
    return resolveSelectionBoundsBlock(selection, activeCell, rowCount, columnCount)
  }, [activeCell, columnCount, rowCount, selection])

  const currentCell = useMemo(() => {
    return activeSheetRows[selectedBounds.start.row]?.[selectedBounds.start.col] ?? null
  }, [activeSheetRows, selectedBounds.start.col, selectedBounds.start.row])

  const currentFormat = currentCell?.format ?? {}

  const formattedCellCssText = useMemo(() => {
    const rules: string[] = []
    for (let rowIndex = 0; rowIndex < activeSheetRows.length; rowIndex++) {
      const row = activeSheetRows[rowIndex]
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const format = sanitizeFormatBlock(row[colIndex]?.format)
        if (!format) continue
        const declarations: string[] = []
        if (format.bold) declarations.push('font-weight: 700')
        if (format.italic) declarations.push('font-style: italic')
        if (format.underline) declarations.push('text-decoration: underline')
        if (format.align) declarations.push(`text-align: ${format.align}`)
        if (format.textColor) {
          const color = sanitizeCssColorBlock(format.textColor)
          if (color) declarations.push(`color: ${color}`)
        }
        if (format.backgroundColor) {
          const color = sanitizeCssColorBlock(format.backgroundColor)
          if (color) declarations.push(`background-color: ${color}`)
        }
        if (declarations.length === 0) continue
        rules.push(
          `.${gridScopeClass} .${formattedCellClassNameBlock(rowIndex, colIndex)} .dsg-input { ${declarations.join('; ')}; }`,
        )
      }
    }
    return rules.join('\n')
  }, [activeSheetRows, gridScopeClass])

  const gridRows = useMemo<GridRowBlock[]>(() => {
    return activeSheetRows.map((row) => {
      const out: GridRowBlock = {}
      for (let col = 0; col < columnCount; col++) {
        out[columnKeyBlock(col)] = row[col]?.value ?? ''
      }
      return out
    })
  }, [activeSheetRows, columnCount])

  const applyDraftChange = useCallback((updater: (current: TableDocumentModelBlock) => TableDocumentModelBlock) => {
    setDraft((current) => {
      if (!current) return current
      const next = updater(cloneDocumentBlock(current))
      setSuccessMessage(null)
      return next
    })
  }, [])

  const gridColumns = useMemo(() => {
    return Array.from({ length: columnCount }, (_, colIndex) => {
      const key = columnKeyBlock(colIndex)
      return {
        ...keyColumn(
          key,
          {
            ...textColumn,
            disabled: !isEditing,
          },
        ),
        id: key,
        title: columnLabelBlock(colIndex),
        minWidth: 120,
      }
    })
  }, [columnCount, isEditing])

  const gridCellClassName = useCallback((opts: { rowIndex: number; columnId?: string }) => {
    const colIndex = columnIndexFromKeyBlock(opts.columnId)
    if (colIndex === null) return undefined
    const format = activeSheetRows[opts.rowIndex]?.[colIndex]?.format
    if (!sanitizeFormatBlock(format)) return undefined
    return formattedCellClassNameBlock(opts.rowIndex, colIndex)
  }, [activeSheetRows])

  const handleGridRowsChange = useCallback((rows: GridRowBlock[]) => {
    applyDraftChange((current) => mutateActiveSheetBlock(current, (sheet) => {
      const previousRows = ensureTableRectBlock(sheet.rows, Math.max(1, sheet.rows.length), columnCount)
      const normalizedRows = (rows.length > 0 ? rows : [createEmptyGridRowBlock(columnCount)]).map((gridRow, rowIndex) => {
        return Array.from({ length: columnCount }, (_, colIndex) => {
          const key = columnKeyBlock(colIndex)
          const previous = previousRows[rowIndex]?.[colIndex]
          return {
            value: String(gridRow[key] ?? ''),
            format: previous?.format ? { ...previous.format } : undefined,
          }
        })
      })
      return {
        ...sheet,
        rows: normalizedRows,
      }
    }))
  }, [applyDraftChange, columnCount])

  const applyFormatToSelection = useCallback((updater: (format: TableCellFormatBlock | undefined) => TableCellFormatBlock | undefined) => {
    if (!canPersistCellFormatting) return
    applyDraftChange((current) => mutateActiveSheetBlock(current, (sheet) => {
      const rows = ensureTableRectBlock(sheet.rows, selectedBounds.end.row + 1, selectedBounds.end.col + 1)
      for (let r = selectedBounds.start.row; r <= selectedBounds.end.row; r++) {
        for (let c = selectedBounds.start.col; c <= selectedBounds.end.col; c++) {
          const cell = rows[r][c]
          rows[r][c] = {
            ...cell,
            format: sanitizeFormatBlock(updater(cell.format)),
          }
        }
      }
      return { ...sheet, rows }
    }))
  }, [applyDraftChange, canPersistCellFormatting, selectedBounds.end.col, selectedBounds.end.row, selectedBounds.start.col, selectedBounds.start.row])

  const toggleBooleanFormat = useCallback((key: 'bold' | 'italic' | 'underline') => {
    applyFormatToSelection((format) => ({ ...format, [key]: !format?.[key] }))
  }, [applyFormatToSelection])

  const setAlignFormat = useCallback((align: TableCellAlign) => {
    applyFormatToSelection((format) => ({ ...format, align }))
  }, [applyFormatToSelection])

  const setColorFormat = useCallback((key: 'textColor' | 'backgroundColor', value: string) => {
    applyFormatToSelection((format) => ({ ...format, [key]: value }))
  }, [applyFormatToSelection])

  const setNumberFormat = useCallback((value: TableCellFormatBlock['numberFormat']) => {
    applyFormatToSelection((format) => ({ ...format, numberFormat: value }))
  }, [applyFormatToSelection])

  const setActiveSheetBlock = useCallback((sheetId: string) => {
    applyDraftChange((current) => ({
      ...current,
      activeSheetId: sheetId,
    }))
    setActiveCell({ row: 0, col: 0 })
    setSelection({ min: { row: 0, col: 0 }, max: { row: 0, col: 0 } })
  }, [applyDraftChange])

  const addSheet = useCallback(() => {
    applyDraftChange((current) => {
      const nextId = `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const nextSheet: TableSheetBlock = {
        id: nextId,
        name: `Sheet${current.sheets.length + 1}`,
        rows: [[{ value: '', format: undefined }]],
      }
      return {
        ...current,
        sheets: [...current.sheets, nextSheet],
        activeSheetId: nextId,
      }
    })
    setActiveCell({ row: 0, col: 0 })
    setSelection({ min: { row: 0, col: 0 }, max: { row: 0, col: 0 } })
  }, [applyDraftChange])

  const updateGoogleMetadata = useCallback((key: 'spreadsheetId' | 'sheetName' | 'range' | 'accessToken', value: string) => {
    applyDraftChange((current) => ({
      ...current,
      google: {
        kind: 'google_sheet',
        ...current.google,
        [key]: value,
      },
    }))
  }, [applyDraftChange])

  const handleGooglePull = useCallback(async () => {
    if (!draft || draft.kind !== 'gsheet') return
    setSyncingPull(true)
    setSaveError(null)
    try {
      const updated = await pullGoogleSheetDocumentBlock(draft)
      setDraft(updated)
      setSuccessMessage('Pulled latest values from Google Sheets.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Google pull failed')
    } finally {
      setSyncingPull(false)
    }
  }, [draft])

  const handleGooglePush = useCallback(async () => {
    if (!draft || draft.kind !== 'gsheet') return
    setSyncingPush(true)
    setSaveError(null)
    try {
      await pushGoogleSheetDocumentBlock(draft)
      setSuccessMessage('Pushed values to Google Sheets.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Google push failed')
    } finally {
      setSyncingPush(false)
    }
  }, [draft])

  const handleSave = useCallback(async () => {
    if (!draft || baseMtime === null) return
    setSaving(true)
    setSaveError(null)
    setConflict(null)
    setSuccessMessage(null)
    try {
      const result = await saveTableDocument({
        path,
        document: draft,
        baseMtime,
        baseHash,
      })
      setDocument(cloneDocumentBlock(draft))
      setBaseMtime(result.mtime)
      setBaseHash(result.hash)
      setMode('view')
      setSuccessMessage('Saved.')
      onSaved?.(result)
    } catch (err) {
      if (err instanceof TableDocumentConflictError) {
        setConflict(err)
        setSaveError(err.message)
      } else {
        setSaveError(err instanceof Error ? err.message : 'Failed to save table')
      }
    } finally {
      setSaving(false)
    }
  }, [baseHash, baseMtime, draft, onSaved, path])

  const startEditing = useCallback(() => {
    if (!document) return
    setDraft(cloneDocumentBlock(document))
    setMode('edit')
    setSaveError(null)
    setSuccessMessage(null)
    setConflict(null)
  }, [document])

  const cancelEditing = useCallback(() => {
    setDraft(document ? cloneDocumentBlock(document) : null)
    setMode('view')
    setSaveError(null)
    setConflict(null)
    setSuccessMessage(null)
  }, [document])

  const loadLatestConflictVersion = useCallback(() => {
    if (!conflict) return
    const latest = cloneDocumentBlock(conflict.currentDocument)
    setDocument(latest)
    setDraft(latest)
    setBaseMtime(conflict.currentMtime)
    setBaseHash(conflict.currentHash)
    setSaveError(null)
    setConflict(null)
    setMode('edit')
  }, [conflict])

  const handleActiveCellChange = useCallback((cell: GridCellWithIdBlock | null) => {
    if (!cell) return
    const nextCell = {
      row: clampBlock(cell.row, 0, Math.max(0, rowCount - 1)),
      col: clampBlock(cell.col, 0, Math.max(0, columnCount - 1)),
    }
    setActiveCell(nextCell)
    if (!selection) {
      setSelection({ min: nextCell, max: nextCell })
    }
  }, [columnCount, rowCount, selection])

  const handleSelectionChange = useCallback((nextSelection: GridSelectionWithIdBlock | null) => {
    if (!nextSelection) return
    setSelection({
      min: {
        row: clampBlock(nextSelection.min.row, 0, Math.max(0, rowCount - 1)),
        col: clampBlock(nextSelection.min.col, 0, Math.max(0, columnCount - 1)),
      },
      max: {
        row: clampBlock(nextSelection.max.row, 0, Math.max(0, rowCount - 1)),
        col: clampBlock(nextSelection.max.col, 0, Math.max(0, columnCount - 1)),
      },
    })
  }, [columnCount, rowCount])

  const gridHeight = useMemo(() => {
    return Math.min(780, Math.max(320, gridRows.length * 36 + 84))
  }, [gridRows.length])

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-card p-2', className)}>
      <div className="ts-doc-header border-b border-border/50 px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{filename}</span>
            </div>
            {breadcrumb && <div className="mt-0.5 truncate text-xs text-muted-foreground">{breadcrumb}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!isEditing && (
              <button
                onClick={startEditing}
                disabled={loading || !!error || !document}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                title="Edit table"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSave() }}
                  disabled={!hasChanges || saving || baseMtime === null}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
            {showCloseButton && onClose && (
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 transition-colors hover:bg-muted"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {isEditing && (
        <Toolbar.Root
          aria-label="Table formatting toolbar"
          className="border-b border-border/40 bg-background px-5 py-2.5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Toolbar.Button
              type="button"
              className={formatButtonClassBlock(!!currentFormat.bold)}
              onClick={() => toggleBooleanFormat('bold')}
              disabled={!canPersistCellFormatting}
            >
              B
            </Toolbar.Button>
            <Toolbar.Button
              type="button"
              className={formatButtonClassBlock(!!currentFormat.italic)}
              onClick={() => toggleBooleanFormat('italic')}
              disabled={!canPersistCellFormatting}
            >
              <i>I</i>
            </Toolbar.Button>
            <Toolbar.Button
              type="button"
              className={formatButtonClassBlock(!!currentFormat.underline)}
              onClick={() => toggleBooleanFormat('underline')}
              disabled={!canPersistCellFormatting}
            >
              <u>U</u>
            </Toolbar.Button>
            <Toolbar.Separator className="h-6 w-px bg-border/70" />
            <Toolbar.Button
              type="button"
              className={formatButtonClassBlock(currentFormat.align === 'left')}
              onClick={() => setAlignFormat('left')}
              disabled={!canPersistCellFormatting}
            >
              Left
            </Toolbar.Button>
            <Toolbar.Button
              type="button"
              className={formatButtonClassBlock(currentFormat.align === 'center')}
              onClick={() => setAlignFormat('center')}
              disabled={!canPersistCellFormatting}
            >
              Center
            </Toolbar.Button>
            <Toolbar.Button
              type="button"
              className={formatButtonClassBlock(currentFormat.align === 'right')}
              onClick={() => setAlignFormat('right')}
              disabled={!canPersistCellFormatting}
            >
              Right
            </Toolbar.Button>
            <Toolbar.Separator className="h-6 w-px bg-border/70" />
            <label className="inline-flex items-center gap-1 rounded border border-border/70 bg-background px-2 py-1 text-xs">
              Text
              <input
                type="color"
                value={normalizeColorForPickerBlock(currentFormat.textColor)}
                onChange={(event) => setColorFormat('textColor', event.target.value)}
                disabled={!canPersistCellFormatting}
              />
            </label>
            <label className="inline-flex items-center gap-1 rounded border border-border/70 bg-background px-2 py-1 text-xs">
              Fill
              <input
                type="color"
                value={normalizeColorForPickerBlock(currentFormat.backgroundColor, '#ffffff')}
                onChange={(event) => setColorFormat('backgroundColor', event.target.value)}
                disabled={!canPersistCellFormatting}
              />
            </label>
            <select
              className="rounded border border-border/70 bg-background px-2 py-1 text-xs disabled:opacity-50"
              value={currentFormat.numberFormat || 'general'}
              onChange={(event) => setNumberFormat(event.target.value as TableCellFormatBlock['numberFormat'])}
              disabled={!canPersistCellFormatting}
            >
              <option value="general">General</option>
              <option value="number">Number</option>
              <option value="currency">Currency</option>
              <option value="percent">Percent</option>
              <option value="date">Date</option>
              <option value="text">Text</option>
            </select>
          </div>
          {!canPersistCellFormatting && (
            <div className="mt-2 text-xs text-muted-foreground">
              Cell formatting is saved to XLSX files. CSV/TSV do not support persistent cell styles in Excel.
            </div>
          )}
        </Toolbar.Root>
      )}

      <div className="border-b border-border/30 bg-background px-5 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {draft?.sheets.map((sheet) => (
            <button
              key={sheet.id}
              type="button"
              onClick={() => setActiveSheetBlock(sheet.id)}
              className={cn(
                'rounded px-2 py-1 text-xs',
                draft.activeSheetId === sheet.id ? 'bg-primary text-primary-foreground' : 'border border-border/70 bg-background hover:bg-muted',
              )}
            >
              {sheet.name}
            </button>
          ))}
          {isEditing && (
            <button
              type="button"
              onClick={addSheet}
              className="inline-flex items-center gap-1 rounded border border-border/70 bg-background px-2 py-1 text-xs hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> Sheet
            </button>
          )}
        </div>
      </div>

      {isEditing && draft?.kind === 'gsheet' && (
        <div className="border-b border-border/40 bg-muted/10 px-5 py-2.5">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              className="rounded border border-border/70 bg-background px-2 py-1.5 text-xs"
              placeholder="Spreadsheet ID"
              value={draft.google?.spreadsheetId || ''}
              onChange={(event) => updateGoogleMetadata('spreadsheetId', event.target.value)}
            />
            <input
              className="rounded border border-border/70 bg-background px-2 py-1.5 text-xs"
              placeholder="Sheet Name"
              value={draft.google?.sheetName || ''}
              onChange={(event) => updateGoogleMetadata('sheetName', event.target.value)}
            />
            <input
              className="rounded border border-border/70 bg-background px-2 py-1.5 text-xs"
              placeholder="Range (optional, e.g. Sheet1!A1:Z200)"
              value={draft.google?.range || ''}
              onChange={(event) => updateGoogleMetadata('range', event.target.value)}
            />
            <input
              className="rounded border border-border/70 bg-background px-2 py-1.5 text-xs"
              placeholder="Access Token"
              value={draft.google?.accessToken || ''}
              onChange={(event) => updateGoogleMetadata('accessToken', event.target.value)}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { void handleGooglePull() }}
              disabled={syncingPull}
              className="inline-flex items-center gap-1 rounded border border-border/70 bg-background px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloudDownload className="h-3.5 w-3.5" />
              {syncingPull ? 'Pulling...' : 'Pull from Google'}
            </button>
            <button
              type="button"
              onClick={() => { void handleGooglePush() }}
              disabled={syncingPush}
              className="inline-flex items-center gap-1 rounded border border-border/70 bg-background px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              {syncingPush ? 'Pushing...' : 'Push to Google'}
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {formattedCellCssText && <style>{formattedCellCssText}</style>}
        {loading && <div className="text-sm text-muted-foreground">Loading table...</div>}
        {error && <div className="text-sm text-destructive">{error}</div>}
        {!loading && !error && activeSheet && (
          <DataSheetGrid<GridRowBlock>
            className={gridScopeClass}
            value={gridRows}
            onChange={handleGridRowsChange}
            columns={gridColumns}
            cellClassName={({ rowIndex, columnId }) => gridCellClassName({ rowIndex, columnId })}
            height={gridHeight}
            autoAddRow={isEditing}
            lockRows={!isEditing}
            disableContextMenu={!isEditing}
            addRowsComponent={isEditing ? undefined : false}
            onActiveCellChange={({ cell }) => handleActiveCellChange(cell)}
            onSelectionChange={({ selection: nextSelection }) => handleSelectionChange(nextSelection)}
          />
        )}
      </div>

      {(saveError || successMessage || conflict) && (
        <div className="border-t border-border/50 px-5 py-2.5 text-sm">
          {saveError && <div className="text-destructive">{saveError}</div>}
          {successMessage && <div className="text-emerald-700">{successMessage}</div>}
          {conflict && (
            <button
              type="button"
              onClick={loadLatestConflictVersion}
              className="mt-2 rounded border border-border px-2.5 py-1 text-xs hover:bg-muted"
            >
              Load latest file version
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function cloneDocumentBlock(document: TableDocumentModelBlock): TableDocumentModelBlock {
  return JSON.parse(JSON.stringify(document)) as TableDocumentModelBlock
}

function mutateActiveSheetBlock(document: TableDocumentModelBlock, updater: (sheet: TableSheetBlock) => TableSheetBlock): TableDocumentModelBlock {
  const sheetIndex = document.sheets.findIndex(sheet => sheet.id === document.activeSheetId)
  if (sheetIndex < 0) return document
  const nextSheets = [...document.sheets]
  nextSheets[sheetIndex] = updater(nextSheets[sheetIndex])
  return { ...document, sheets: nextSheets }
}

function ensureTableRectBlock(rows: TableSheetBlock['rows'], minRows: number, minCols: number): TableSheetBlock['rows'] {
  const next: TableSheetBlock['rows'] = rows.map(row => row.map(cell => ({
    value: cell.value,
    format: cell.format ? { ...cell.format } : undefined,
  })))
  while (next.length < minRows) next.push([])
  for (const row of next) {
    while (row.length < minCols) row.push({ value: '', format: undefined })
  }
  return next
}

function sanitizeFormatBlock(format: TableCellFormatBlock | undefined): TableCellFormatBlock | undefined {
  if (!format) return undefined
  const next: TableCellFormatBlock = {}
  if (format.bold) next.bold = true
  if (format.italic) next.italic = true
  if (format.underline) next.underline = true
  if (format.align === 'left' || format.align === 'center' || format.align === 'right') next.align = format.align
  if (format.textColor) next.textColor = format.textColor
  if (format.backgroundColor) next.backgroundColor = format.backgroundColor
  if (format.numberFormat) next.numberFormat = format.numberFormat
  return Object.keys(next).length > 0 ? next : undefined
}

function resolveSelectionBoundsBlock(
  selection: GridSelectionWithIdBlock | null,
  activeCell: GridCellWithIdBlock | null,
  rowCount: number,
  columnCount: number,
): SelectionRangeBlock {
  const fallbackCell = activeCell ?? { row: 0, col: 0 }
  const start = selection?.min ?? fallbackCell
  const end = selection?.max ?? fallbackCell
  return {
    start: {
      row: clampBlock(Math.min(start.row, end.row), 0, Math.max(0, rowCount - 1)),
      col: clampBlock(Math.min(start.col, end.col), 0, Math.max(0, columnCount - 1)),
    },
    end: {
      row: clampBlock(Math.max(start.row, end.row), 0, Math.max(0, rowCount - 1)),
      col: clampBlock(Math.max(start.col, end.col), 0, Math.max(0, columnCount - 1)),
    },
  }
}

function formatButtonClassBlock(active: boolean): string {
  return cn(
    'rounded border px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50',
    active ? 'border-primary bg-primary/10 text-foreground' : 'border-border/70 bg-background hover:bg-muted',
  )
}

function columnKeyBlock(index: number): string {
  return `c${index}`
}

function columnIndexFromKeyBlock(columnId: string | undefined): number | null {
  if (!columnId) return null
  const match = /^c(\d+)$/.exec(columnId)
  if (!match) return null
  const out = Number.parseInt(match[1] || '', 10)
  return Number.isFinite(out) ? out : null
}

function formattedCellClassNameBlock(rowIndex: number, colIndex: number): string {
  return `table-cell-fmt-r${rowIndex}-c${colIndex}`
}

function sanitizeCssColorBlock(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value
  if (/^#[0-9a-fA-F]{8}$/.test(value)) return `#${value.slice(1, 7)}`
  return null
}

function normalizeColorForPickerBlock(input: string | undefined, fallback = '#111111'): string {
  return sanitizeCssColorBlock(input || '') ?? fallback
}

function createEmptyGridRowBlock(columnCount: number): GridRowBlock {
  const row: GridRowBlock = {}
  for (let i = 0; i < columnCount; i++) {
    row[columnKeyBlock(i)] = ''
  }
  return row
}

function columnLabelBlock(index: number): string {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function clampBlock(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export default memo(TableDocumentBlock)
