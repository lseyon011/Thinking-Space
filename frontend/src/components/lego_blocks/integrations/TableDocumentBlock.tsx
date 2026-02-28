import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { FileSpreadsheet, Pencil, Save, X, RotateCcw, RotateCw, Plus, Trash2, CloudDownload, CloudUpload } from 'lucide-react'
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

interface TableDocumentBlockProps {
  path: string
  initialMode?: ViewerMode
  onSaved?: (result: { output_path: string; revision_path: string | null }) => void
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

interface CellPosBlock {
  row: number
  col: number
}

interface SelectionRangeBlock {
  start: CellPosBlock
  end: CellPosBlock
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
  const [history, setHistory] = useState<TableDocumentModelBlock[]>([])
  const [future, setFuture] = useState<TableDocumentModelBlock[]>([])
  const [selection, setSelection] = useState<SelectionRangeBlock>({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } })
  const containerRef = useRef<HTMLDivElement | null>(null)

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
      setHistory([])
      setFuture([])
      setSelection({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } })
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

  const hasChanges = useMemo(() => {
    if (!draft || !document) return false
    return JSON.stringify(draft) !== JSON.stringify(document)
  }, [draft, document])

  const filename = path.split('/').pop() || path
  const breadcrumb = path.split('/').slice(0, -1).join(' / ')
  const isEditing = mode === 'edit'
  const tableColumns = useMemo(() => {
    if (!activeSheet) return 1
    return Math.max(1, activeSheet.rows.reduce((max, row) => Math.max(max, row.length), 1))
  }, [activeSheet])

  const selectedBounds = normalizeSelectionBlock(selection)
  const currentCell = useMemo(() => {
    if (!activeSheet) return null
    return activeSheet.rows[selectedBounds.start.row]?.[selectedBounds.start.col] ?? null
  }, [activeSheet, selectedBounds.start.col, selectedBounds.start.row])
  const currentFormat = currentCell?.format ?? {}

  const applyDraftChange = useCallback((updater: (current: TableDocumentModelBlock) => TableDocumentModelBlock) => {
    setDraft((current) => {
      if (!current) return current
      const before = cloneDocumentBlock(current)
      const next = updater(cloneDocumentBlock(current))
      if (JSON.stringify(next) === JSON.stringify(current)) return current
      setHistory((prev) => [...prev, before].slice(-80))
      setFuture([])
      setSuccessMessage(null)
      return next
    })
  }, [])

  const setActiveSheetBlock = useCallback((sheetId: string) => {
    applyDraftChange((current) => ({
      ...current,
      activeSheetId: sheetId,
    }))
    setSelection({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } })
  }, [applyDraftChange])

  const updateCellValue = useCallback((row: number, col: number, value: string) => {
    applyDraftChange((current) => mutateActiveSheetBlock(current, (sheet) => {
      const rows = ensureTableRectBlock(sheet.rows, row + 1, col + 1)
      rows[row][col] = {
        ...rows[row][col],
        value,
      }
      return { ...sheet, rows }
    }))
  }, [applyDraftChange])

  const applyFormatToSelection = useCallback((updater: (format: TableCellFormatBlock | undefined) => TableCellFormatBlock | undefined) => {
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
  }, [applyDraftChange, selectedBounds.end.col, selectedBounds.end.row, selectedBounds.start.col, selectedBounds.start.row])

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

  const addRowAfter = useCallback(() => {
    applyDraftChange((current) => mutateActiveSheetBlock(current, (sheet) => {
      const colCount = Math.max(1, sheet.rows.reduce((max, row) => Math.max(max, row.length), 1))
      const nextRows = sheet.rows.map(row => [...row])
      const insertAt = Math.min(nextRows.length, selectedBounds.end.row + 1)
      nextRows.splice(insertAt, 0, Array.from({ length: colCount }, () => ({ value: '' })))
      return { ...sheet, rows: nextRows }
    }))
    setSelection((prev) => ({
      start: { row: prev.end.row + 1, col: prev.end.col },
      end: { row: prev.end.row + 1, col: prev.end.col },
    }))
  }, [applyDraftChange, selectedBounds.end.row])

  const addColumnAfter = useCallback(() => {
    applyDraftChange((current) => mutateActiveSheetBlock(current, (sheet) => {
      const colCount = Math.max(1, sheet.rows.reduce((max, row) => Math.max(max, row.length), 1))
      const nextRows = ensureTableRectBlock(sheet.rows, Math.max(1, sheet.rows.length), colCount)
      const insertAt = Math.min(colCount, selectedBounds.end.col + 1)
      const updated = nextRows.map((row) => {
        const copy = [...row]
        copy.splice(insertAt, 0, { value: '' })
        return copy
      })
      return { ...sheet, rows: updated }
    }))
    setSelection((prev) => ({
      start: { row: prev.end.row, col: prev.end.col + 1 },
      end: { row: prev.end.row, col: prev.end.col + 1 },
    }))
  }, [applyDraftChange, selectedBounds.end.col])

  const deleteSelectedRow = useCallback(() => {
    applyDraftChange((current) => mutateActiveSheetBlock(current, (sheet) => {
      if (sheet.rows.length <= 1) return sheet
      const nextRows = sheet.rows.filter((_, idx) => idx < selectedBounds.start.row || idx > selectedBounds.end.row)
      return { ...sheet, rows: nextRows.length > 0 ? nextRows : [[{ value: '' }]] }
    }))
    setSelection({ start: { row: 0, col: selectedBounds.start.col }, end: { row: 0, col: selectedBounds.start.col } })
  }, [applyDraftChange, selectedBounds.end.row, selectedBounds.start.col, selectedBounds.start.row])

  const deleteSelectedColumn = useCallback(() => {
    applyDraftChange((current) => mutateActiveSheetBlock(current, (sheet) => {
      const colCount = Math.max(1, sheet.rows.reduce((max, row) => Math.max(max, row.length), 1))
      if (colCount <= 1) return sheet
      const nextRows = ensureTableRectBlock(sheet.rows, sheet.rows.length, colCount).map((row) => {
        const copy = [...row]
        copy.splice(selectedBounds.start.col, Math.max(1, selectedBounds.end.col - selectedBounds.start.col + 1))
        return copy.length > 0 ? copy : [{ value: '' }]
      })
      return { ...sheet, rows: nextRows }
    }))
    setSelection((prev) => ({ start: { row: prev.start.row, col: 0 }, end: { row: prev.start.row, col: 0 } }))
  }, [applyDraftChange, selectedBounds.end.col, selectedBounds.start.col])

  const clearSelectionValues = useCallback(() => {
    applyDraftChange((current) => mutateActiveSheetBlock(current, (sheet) => {
      const rows = ensureTableRectBlock(sheet.rows, selectedBounds.end.row + 1, selectedBounds.end.col + 1)
      for (let r = selectedBounds.start.row; r <= selectedBounds.end.row; r++) {
        for (let c = selectedBounds.start.col; c <= selectedBounds.end.col; c++) {
          rows[r][c] = {
            ...rows[r][c],
            value: '',
          }
        }
      }
      return { ...sheet, rows }
    }))
  }, [applyDraftChange, selectedBounds.end.col, selectedBounds.end.row, selectedBounds.start.col, selectedBounds.start.row])

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev
      const nextHistory = [...prev]
      const previousDoc = nextHistory.pop()!
      setDraft((current) => {
        if (current) setFuture((futureDocs) => [...futureDocs, cloneDocumentBlock(current)])
        return previousDoc
      })
      return nextHistory
    })
  }, [])

  const handleRedo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev
      const nextFuture = [...prev]
      const redoDoc = nextFuture.pop()!
      setDraft((current) => {
        if (current) setHistory((historyDocs) => [...historyDocs, cloneDocumentBlock(current)].slice(-80))
        return redoDoc
      })
      return nextFuture
    })
  }, [])

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
      setHistory([])
      setFuture([])
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
    setHistory([])
    setFuture([])
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
    setHistory([])
    setFuture([])
  }, [conflict])

  const handleCopySelection = useCallback(async () => {
    if (!activeSheet) return
    const matrix: string[][] = []
    for (let r = selectedBounds.start.row; r <= selectedBounds.end.row; r++) {
      const row: string[] = []
      for (let c = selectedBounds.start.col; c <= selectedBounds.end.col; c++) {
        row.push(activeSheet.rows[r]?.[c]?.value ?? '')
      }
      matrix.push(row)
    }
    const text = matrix.map(row => row.map(value => value.replace(/\t/g, ' ')).join('\t')).join('\n')
    await writeClipboardTextBlock(text)
    setSuccessMessage('Selection copied.')
  }, [activeSheet, selectedBounds.end.col, selectedBounds.end.row, selectedBounds.start.col, selectedBounds.start.row])

  const handlePasteSelection = useCallback(async () => {
    if (!isEditing) return
    const text = await readClipboardTextBlock()
    if (!text) return
    const matrix = parseClipboardMatrixBlock(text)
    if (matrix.length === 0) return
    applyDraftChange((current) => mutateActiveSheetBlock(current, (sheet) => {
      const requiredRows = selectedBounds.start.row + matrix.length
      const requiredCols = selectedBounds.start.col + matrix.reduce((max, row) => Math.max(max, row.length), 1)
      const rows = ensureTableRectBlock(sheet.rows, requiredRows, requiredCols)
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          rows[selectedBounds.start.row + r][selectedBounds.start.col + c] = {
            ...rows[selectedBounds.start.row + r][selectedBounds.start.col + c],
            value: matrix[r][c],
          }
        }
      }
      return { ...sheet, rows }
    }))
    setSelection({
      start: selection.start,
      end: {
        row: selectedBounds.start.row + matrix.length - 1,
        col: selectedBounds.start.col + Math.max(1, matrix.reduce((max, row) => Math.max(max, row.length), 1)) - 1,
      },
    })
    setSuccessMessage('Pasted.')
  }, [applyDraftChange, isEditing, selectedBounds.start.col, selectedBounds.start.row, selection.start])

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!activeSheet || !isEditing) return
    const command = event.metaKey || event.ctrlKey
    if (command && event.key.toLowerCase() === 'c') {
      event.preventDefault()
      void handleCopySelection()
      return
    }
    if (command && event.key.toLowerCase() === 'v') {
      event.preventDefault()
      void handlePasteSelection()
      return
    }
    if (command && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      handleUndo()
      return
    }
    if (command && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
      event.preventDefault()
      handleRedo()
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      clearSelectionValues()
      return
    }

    if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      const delta = arrowToDeltaBlock(event.key)
      if (!delta) return
      const maxRow = Math.max(0, activeSheet.rows.length - 1)
      const maxCol = Math.max(0, tableColumns - 1)
      const nextRow = clampBlock(selection.end.row + delta.row, 0, maxRow)
      const nextCol = clampBlock(selection.end.col + delta.col, 0, maxCol)
      const next = { row: nextRow, col: nextCol }
      setSelection((prev) => event.shiftKey
        ? { ...prev, end: next }
        : { start: next, end: next })
    }
  }, [
    activeSheet,
    clearSelectionValues,
    handleCopySelection,
    handlePasteSelection,
    handleRedo,
    handleUndo,
    isEditing,
    selection.end.col,
    selection.end.row,
    tableColumns,
  ])

  const addSheet = useCallback(() => {
    applyDraftChange((current) => {
      const nextId = `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const nextSheet: TableSheetBlock = {
        id: nextId,
        name: `Sheet${current.sheets.length + 1}`,
        rows: [[{ value: '' }]],
      }
      return {
        ...current,
        sheets: [...current.sheets, nextSheet],
        activeSheetId: nextId,
      }
    })
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

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-card', className)}>
      <div className="border-b border-border/50 px-5 py-4">
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
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  title="Undo"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={future.length === 0}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  title="Redo"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
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

      <div className="border-b border-border/40 bg-muted/20 px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded border border-border/70 bg-background px-2 py-1 text-muted-foreground">
            {draft?.kind.toUpperCase() || 'TABLE'}
          </span>
          <span className={cn('rounded border px-2 py-1', hasChanges ? 'border-amber-500/40 text-amber-700' : 'border-emerald-500/40 text-emerald-700')}>
            {hasChanges ? 'Unsaved changes' : 'Saved'}
          </span>
          <span className="text-muted-foreground">Copy/Paste: Cmd/Ctrl+C, Cmd/Ctrl+V</span>
        </div>
      </div>

      {isEditing && (
        <div className="border-b border-border/40 bg-background px-5 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={formatButtonClassBlock(!!currentFormat.bold)} onClick={() => toggleBooleanFormat('bold')}>B</button>
            <button type="button" className={formatButtonClassBlock(!!currentFormat.italic)} onClick={() => toggleBooleanFormat('italic')}><i>I</i></button>
            <button type="button" className={formatButtonClassBlock(!!currentFormat.underline)} onClick={() => toggleBooleanFormat('underline')}><u>U</u></button>
            <button type="button" className={formatButtonClassBlock(currentFormat.align === 'left')} onClick={() => setAlignFormat('left')}>Left</button>
            <button type="button" className={formatButtonClassBlock(currentFormat.align === 'center')} onClick={() => setAlignFormat('center')}>Center</button>
            <button type="button" className={formatButtonClassBlock(currentFormat.align === 'right')} onClick={() => setAlignFormat('right')}>Right</button>
            <label className="inline-flex items-center gap-1 rounded border border-border/70 bg-background px-2 py-1 text-xs">
              Text
              <input type="color" value={currentFormat.textColor || '#111111'} onChange={(event) => setColorFormat('textColor', event.target.value)} />
            </label>
            <label className="inline-flex items-center gap-1 rounded border border-border/70 bg-background px-2 py-1 text-xs">
              Fill
              <input type="color" value={currentFormat.backgroundColor || '#ffffff'} onChange={(event) => setColorFormat('backgroundColor', event.target.value)} />
            </label>
            <select
              className="rounded border border-border/70 bg-background px-2 py-1 text-xs"
              value={currentFormat.numberFormat || 'general'}
              onChange={(event) => setNumberFormat(event.target.value as TableCellFormatBlock['numberFormat'])}
            >
              <option value="general">General</option>
              <option value="number">Number</option>
              <option value="currency">Currency</option>
              <option value="percent">Percent</option>
              <option value="date">Date</option>
              <option value="text">Text</option>
            </select>
            <button type="button" className="inline-flex items-center gap-1 rounded border border-border/70 bg-background px-2 py-1 text-xs hover:bg-muted" onClick={addRowAfter}>
              <Plus className="h-3.5 w-3.5" /> Row
            </button>
            <button type="button" className="inline-flex items-center gap-1 rounded border border-border/70 bg-background px-2 py-1 text-xs hover:bg-muted" onClick={addColumnAfter}>
              <Plus className="h-3.5 w-3.5" /> Col
            </button>
            <button type="button" className="inline-flex items-center gap-1 rounded border border-border/70 bg-background px-2 py-1 text-xs hover:bg-muted" onClick={deleteSelectedRow}>
              <Trash2 className="h-3.5 w-3.5" /> Del Row
            </button>
            <button type="button" className="inline-flex items-center gap-1 rounded border border-border/70 bg-background px-2 py-1 text-xs hover:bg-muted" onClick={deleteSelectedColumn}>
              <Trash2 className="h-3.5 w-3.5" /> Del Col
            </button>
          </div>
        </div>
      )}

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
            <span className="text-[11px] text-muted-foreground">Remote sync is explicit manual pull/push.</span>
          </div>
        </div>
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
              className="rounded border border-border/70 bg-background px-2 py-1 text-xs hover:bg-muted"
            >
              + Sheet
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="min-h-0 flex-1 overflow-auto p-4 outline-none"
      >
        {loading && <div className="text-sm text-muted-foreground">Loading table...</div>}
        {error && <div className="text-sm text-destructive">{error}</div>}
        {!loading && !error && activeSheet && (
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 w-12 border border-border/60 bg-muted/60 px-2 py-1 text-right text-xs text-muted-foreground">#</th>
                {Array.from({ length: tableColumns }).map((_, colIdx) => (
                  <th key={`col-${colIdx}`} className="sticky top-0 z-10 min-w-[10rem] border border-border/60 bg-muted/60 px-2 py-1 text-left text-xs text-muted-foreground">
                    {columnLabelBlock(colIdx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSheet.rows.map((row, rowIdx) => (
                <tr key={`row-${rowIdx}`}>
                  <th className="sticky left-0 z-10 border border-border/60 bg-muted/40 px-2 py-1 text-right text-xs text-muted-foreground">{rowIdx + 1}</th>
                  {Array.from({ length: tableColumns }).map((_, colIdx) => {
                    const cell = row[colIdx] ?? { value: '' }
                    const selected = isCellInSelectionBlock(selection, rowIdx, colIdx)
                    const style = cellStyleFromFormatBlock(cell.format)
                    return (
                      <td
                        key={`cell-${rowIdx}-${colIdx}`}
                        className={cn('border border-border/40 p-0 align-top', selected && 'ring-1 ring-inset ring-primary')}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          setSelection((prev) => event.shiftKey
                            ? { ...prev, end: { row: rowIdx, col: colIdx } }
                            : { start: { row: rowIdx, col: colIdx }, end: { row: rowIdx, col: colIdx } })
                        }}
                      >
                        {isEditing ? (
                          <input
                            value={cell.value}
                            onFocus={() => {
                              setSelection({ start: { row: rowIdx, col: colIdx }, end: { row: rowIdx, col: colIdx } })
                            }}
                            onChange={(event) => updateCellValue(rowIdx, colIdx, event.target.value)}
                            className="h-8 w-full min-w-[10rem] border-0 bg-transparent px-2 text-sm outline-none"
                            style={style}
                          />
                        ) : (
                          <div className="min-h-8 min-w-[10rem] px-2 py-1.5 text-sm" style={style}>
                            {cell.value}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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

function normalizeSelectionBlock(selection: SelectionRangeBlock): SelectionRangeBlock {
  const startRow = Math.min(selection.start.row, selection.end.row)
  const endRow = Math.max(selection.start.row, selection.end.row)
  const startCol = Math.min(selection.start.col, selection.end.col)
  const endCol = Math.max(selection.start.col, selection.end.col)
  return {
    start: { row: startRow, col: startCol },
    end: { row: endRow, col: endCol },
  }
}

function isCellInSelectionBlock(selection: SelectionRangeBlock, row: number, col: number): boolean {
  const normalized = normalizeSelectionBlock(selection)
  return row >= normalized.start.row
    && row <= normalized.end.row
    && col >= normalized.start.col
    && col <= normalized.end.col
}

function parseClipboardMatrixBlock(text: string): string[][] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((_, idx, arr) => !(idx === arr.length - 1 && arr[idx] === ''))
    .map(line => line.split('\t'))
}

async function readClipboardTextBlock(): Promise<string> {
  if (!navigator.clipboard?.readText) return ''
  try {
    return await navigator.clipboard.readText()
  } catch {
    return ''
  }
}

async function writeClipboardTextBlock(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // no-op
  }
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

function cellStyleFromFormatBlock(format: TableCellFormatBlock | undefined): CSSProperties {
  return {
    fontWeight: format?.bold ? 700 : undefined,
    fontStyle: format?.italic ? 'italic' : undefined,
    textDecoration: format?.underline ? 'underline' : undefined,
    textAlign: format?.align,
    color: format?.textColor,
    backgroundColor: format?.backgroundColor,
  }
}

function formatButtonClassBlock(active: boolean): string {
  return cn(
    'rounded border px-2 py-1 text-xs font-medium',
    active ? 'border-primary bg-primary/10 text-foreground' : 'border-border/70 bg-background hover:bg-muted',
  )
}

function clampBlock(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function arrowToDeltaBlock(key: string): { row: number; col: number } | null {
  if (key === 'ArrowUp') return { row: -1, col: 0 }
  if (key === 'ArrowDown') return { row: 1, col: 0 }
  if (key === 'ArrowLeft') return { row: 0, col: -1 }
  if (key === 'ArrowRight') return { row: 0, col: 1 }
  return null
}

export default memo(TableDocumentBlock)
