import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Plus, X, FileText, ListChecks, Pencil, Check, GripVertical } from 'lucide-react'
import FileSelectionViewerBlock, { type FileSelectionOptionBlock } from '@/components/lego_blocks/integrations/FileSelectionViewerBlock'
import MarkdownDocumentBlock from '@/components/lego_blocks/integrations/MarkdownDocumentBlock'
import TodoListPanelBlock from '@/components/lego_blocks/integrations/TodoListPanelBlock'
import { ProgramGroupHeaderBlock } from '@/components/lego_blocks/integrations/ProgramGroupHeaderBlock'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { extractSection } from '@/services/lego_blocks/units/vaultConstantsBlock'
import { cn } from '@/lib/utils'
import {
  PIN_BOARD_PANEL_HEIGHT_STEP_BLOCK,
  PIN_BOARD_PANEL_MIN_HEIGHT_BLOCK,
  PIN_BOARD_PANEL_MIN_WIDTH_BLOCK,
  PIN_BOARD_PANEL_PADDING_BLOCK,
  PIN_BOARD_PANEL_POSITION_STEP_BLOCK,
  PIN_BOARD_PANEL_WIDTH_STEP_BLOCK,
  type PinBoardPanelBlock,
} from '@/services/lego_blocks/integrations/organizerUiStateBlock'

export type { PinBoardPanelBlock }
export type PinBoardFileOptionBlock = FileSelectionOptionBlock

const TODO_FILE_NAME_RE = /^\d{4}-\d{2}-\d{2}\.md$/i
const MIN_BOARD_HEIGHT_PX = 520

interface PanelPickerState {
  pickerOpen: boolean
  query: string
  viewerNonce: number
}

interface PinBoardGroupEntryBlock {
  id: string
  name: string
  panelIds: string[]
  collapsed?: boolean
}

type ResizeEdgeBlock = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface PinBoardBlockProps {
  markdownOptions: PinBoardFileOptionBlock[]
  panels: PinBoardPanelBlock[]
  panelGroups?: PinBoardGroupEntryBlock[]
  panelGroupIdByPanel?: Record<string, string>
  onCreatePanelGroup?: (name: string) => void
  onDeletePanelGroup?: (groupId: string) => void
  onTogglePanelGroupCollapsed?: (groupId: string) => void
  onAssignPanelToGroup?: (panel: PinBoardPanelBlock, groupId: string | null) => void
  onUpdatePanel: (id: string, updates: Partial<PinBoardPanelBlock>) => void
  onAddPanel: (type: 'markdown' | 'todos') => void
  onRemovePanel: (id: string) => void
  onOpenFile: (path: string) => void
  disabled?: boolean
  topBarHidden?: boolean
  layoutEditMode?: boolean
  onLayoutEditModeChange?: (next: boolean) => void
  showLayoutModeToggle?: boolean
  className?: string
}

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function labelFromPath(path: string): string {
  const normalized = normalizeRelativePath(path)
  if (!normalized) return ''
  const fileName = normalized.split('/').pop() ?? normalized
  return fileName.toLowerCase().endsWith('.md') ? fileName.slice(0, -3) : fileName
}

function isTodoNotePath(path: string): boolean {
  const normalized = normalizeRelativePath(path)
  if (!normalized) return false
  const segments = normalized.split('/')
  const fileName = segments[segments.length - 1] ?? ''
  return segments.includes('todos') && TODO_FILE_NAME_RE.test(fileName)
}

function todoLabelFromPath(path: string): string {
  const normalized = normalizeRelativePath(path)
  if (!normalized) return ''
  const fileName = normalized.split('/').pop() ?? normalized
  const dateLabel = fileName.toLowerCase().endsWith('.md') ? fileName.slice(0, -3) : fileName
  const section = extractSection(normalized)
  return section && section !== 'Other' ? `${section} · ${dateLabel}` : dateLabel
}

function snapToStep(value: number, step: number): number {
  return Math.round(value / step) * step
}

function resolvePanelWidth(panel: PinBoardPanelBlock): number {
  return Math.max(
    PIN_BOARD_PANEL_MIN_WIDTH_BLOCK,
    typeof panel.width === 'number' ? panel.width : (panel.type === 'todos' ? 640 : 320),
  )
}

function resolvePanelHeight(panel: PinBoardPanelBlock): number {
  return Math.max(
    PIN_BOARD_PANEL_MIN_HEIGHT_BLOCK,
    typeof panel.height === 'number' ? panel.height : (panel.type === 'todos' ? 600 : 480),
  )
}

function resolvePanelX(panel: PinBoardPanelBlock): number {
  return Math.max(0, Math.round(typeof panel.x === 'number' ? panel.x : PIN_BOARD_PANEL_PADDING_BLOCK))
}

function resolvePanelY(panel: PinBoardPanelBlock): number {
  return Math.max(0, Math.round(typeof panel.y === 'number' ? panel.y : PIN_BOARD_PANEL_PADDING_BLOCK))
}

export default function PinBoardBlock({
  markdownOptions,
  panels,
  panelGroups = [],
  panelGroupIdByPanel = {},
  onCreatePanelGroup,
  onDeletePanelGroup,
  onTogglePanelGroupCollapsed,
  onAssignPanelToGroup,
  onUpdatePanel,
  onAddPanel,
  onRemovePanel,
  onOpenFile,
  disabled = false,
  topBarHidden = false,
  layoutEditMode,
  onLayoutEditModeChange,
  showLayoutModeToggle = true,
  className,
}: PinBoardBlockProps) {
  const [internalLayoutEditMode, setInternalLayoutEditMode] = useState(panels.length === 0)
  const [pickerState, setPickerState] = useState<Record<string, PanelPickerState>>({})
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [panelGroupDraft, setPanelGroupDraft] = useState('')
  const [activePanelId, setActivePanelId] = useState<string | null>(null)
  const boardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const controlledLayoutEditMode = typeof layoutEditMode === 'boolean'
  const editMode = controlledLayoutEditMode ? layoutEditMode : internalLayoutEditMode

  const optionByPath = useMemo(
    () => new Map(markdownOptions.map((opt) => [normalizeRelativePath(opt.path), opt] as const)),
    [markdownOptions],
  )
  const todoOptions = useMemo(
    () => markdownOptions
      .filter((opt) => isTodoNotePath(opt.path))
      .map((opt) => ({
        ...opt,
        label: todoLabelFromPath(opt.path) || opt.label,
      }))
      .sort((a, b) => b.path.localeCompare(a.path)),
    [markdownOptions],
  )
  const todoOptionByPath = useMemo(
    () => new Map(todoOptions.map((opt) => [normalizeRelativePath(opt.path), opt] as const)),
    [todoOptions],
  )
  const validGroupIds = useMemo(
    () => new Set(panelGroups.map((group) => group.id)),
    [panelGroups],
  )
  const resolvedPanelGroupIdByPanel = useMemo(() => {
    const resolved: Record<string, string> = {}
    for (const [panelId, groupId] of Object.entries(panelGroupIdByPanel)) {
      if (!validGroupIds.has(groupId)) continue
      resolved[panelId] = groupId
    }
    return resolved
  }, [panelGroupIdByPanel, validGroupIds])
  const groupedPanelsByGroupId = useMemo(() => {
    const grouped = new Map<string, PinBoardPanelBlock[]>(panelGroups.map((group) => [group.id, []]))
    const ungrouped: PinBoardPanelBlock[] = []

    for (const panel of panels) {
      const groupId = resolvedPanelGroupIdByPanel[panel.id]
      const target = groupId ? grouped.get(groupId) : null
      if (target) target.push(panel)
      else ungrouped.push(panel)
    }

    return {
      grouped,
      ungrouped,
    }
  }, [panelGroups, panels, resolvedPanelGroupIdByPanel])

  function getPicker(id: string): PanelPickerState {
    return pickerState[id] ?? { pickerOpen: false, query: '', viewerNonce: 0 }
  }

  function setLayoutMode(next: boolean) {
    if (!controlledLayoutEditMode) {
      setInternalLayoutEditMode(next)
    }
    onLayoutEditModeChange?.(next)
  }

  function createPanelGroupFromDraft() {
    if (!onCreatePanelGroup) return
    const nextName = panelGroupDraft.trim()
    if (!nextName) return
    onCreatePanelGroup(nextName)
    setPanelGroupDraft('')
  }

  function commitPanelRect(
    panel: PinBoardPanelBlock,
    _boardId: string,
    nextRect: { x?: number; y?: number; width?: number; height?: number },
  ) {
    const nextX = nextRect.x == null ? undefined : Math.max(0, snapToStep(nextRect.x, PIN_BOARD_PANEL_POSITION_STEP_BLOCK))
    const nextY = nextRect.y == null ? undefined : Math.max(0, snapToStep(nextRect.y, PIN_BOARD_PANEL_POSITION_STEP_BLOCK))
    const width = nextRect.width == null
      ? undefined
      : Math.max(PIN_BOARD_PANEL_MIN_WIDTH_BLOCK, snapToStep(nextRect.width, PIN_BOARD_PANEL_WIDTH_STEP_BLOCK))
    const height = nextRect.height == null
      ? undefined
      : Math.max(PIN_BOARD_PANEL_MIN_HEIGHT_BLOCK, snapToStep(nextRect.height, PIN_BOARD_PANEL_HEIGHT_STEP_BLOCK))

    onUpdatePanel(panel.id, {
      ...(typeof nextX === 'number' ? { x: nextX } : {}),
      ...(typeof nextY === 'number' ? { y: nextY } : {}),
      ...(typeof width === 'number' ? { width } : {}),
      ...(typeof height === 'number' ? { height } : {}),
    })
  }

  function handleMoveStart(panel: PinBoardPanelBlock, boardId: string, event: ReactPointerEvent<HTMLDivElement>) {
    if (!editMode || disabled) return
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const boardNode = boardRefs.current[boardId]
    if (!boardNode) return

    const startPointerX = event.clientX
    const startPointerY = event.clientY
    const startX = resolvePanelX(panel)
    const startY = resolvePanelY(panel)
    const panelWidth = resolvePanelWidth(panel)
    const panelHeight = resolvePanelHeight(panel)

    setActivePanelId(panel.id)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextX = Math.max(0, startX + (moveEvent.clientX - startPointerX))
      const nextY = Math.max(0, startY + (moveEvent.clientY - startPointerY))
      commitPanelRect(panel, boardId, { x: nextX, y: nextY, width: panelWidth, height: panelHeight })
    }

    const handlePointerUp = () => {
      setActivePanelId(current => (current === panel.id ? null : current))
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  function handleResizeStart(
    panel: PinBoardPanelBlock,
    boardId: string,
    edge: ResizeEdgeBlock,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (!editMode || disabled) return
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const boardNode = boardRefs.current[boardId]
    if (!boardNode) return

    const startPointerX = event.clientX
    const startPointerY = event.clientY
    const startX = resolvePanelX(panel)
    const startY = resolvePanelY(panel)
    const startWidth = resolvePanelWidth(panel)
    const startHeight = resolvePanelHeight(panel)

    setActivePanelId(panel.id)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const startRight = startX + startWidth
      const startBottom = startY + startHeight
      let nextX = startX
      let nextY = startY
      let nextWidth = startWidth
      let nextHeight = startHeight

      if (edge.includes('e')) {
        nextWidth = Math.max(
          startWidth + (moveEvent.clientX - startPointerX),
          PIN_BOARD_PANEL_MIN_WIDTH_BLOCK,
        )
      }
      if (edge.includes('s')) {
        nextHeight = Math.max(
          startHeight + (moveEvent.clientY - startPointerY),
          PIN_BOARD_PANEL_MIN_HEIGHT_BLOCK,
        )
      }
      if (edge.includes('w')) {
        const snappedWidth = Math.max(
          snapToStep(startWidth - (moveEvent.clientX - startPointerX), PIN_BOARD_PANEL_WIDTH_STEP_BLOCK),
          PIN_BOARD_PANEL_MIN_WIDTH_BLOCK,
        )
        nextWidth = snappedWidth
        nextX = Math.max(0, startRight - snappedWidth)
      }
      if (edge.includes('n')) {
        const snappedHeight = Math.max(
          snapToStep(startHeight - (moveEvent.clientY - startPointerY), PIN_BOARD_PANEL_HEIGHT_STEP_BLOCK),
          PIN_BOARD_PANEL_MIN_HEIGHT_BLOCK,
        )
        nextHeight = snappedHeight
        nextY = Math.max(0, startBottom - snappedHeight)
      }

      commitPanelRect(panel, boardId, {
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      })
    }

    const handlePointerUp = () => {
      setActivePanelId(current => (current === panel.id ? null : current))
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  function renderResizeHandle(
    panel: PinBoardPanelBlock,
    boardId: string,
    edge: ResizeEdgeBlock,
    className: string,
  ) {
    return (
      <button
        key={`${panel.id}-${edge}`}
        type="button"
        aria-label={`Resize panel ${edge}`}
        onPointerDown={(event) => handleResizeStart(panel, boardId, edge, event)}
        className={className}
        style={{ touchAction: 'none' }}
        tabIndex={-1}
      />
    )
  }

  function renderPanelBoard(boardId: string, panelList: PinBoardPanelBlock[]) {
    const boardWidth = Math.max(
      0,
      ...panelList.map(panel => resolvePanelX(panel) + resolvePanelWidth(panel) + PIN_BOARD_PANEL_PADDING_BLOCK),
    )
    const boardHeight = Math.max(
      MIN_BOARD_HEIGHT_PX,
      ...panelList.map(panel => resolvePanelY(panel) + resolvePanelHeight(panel) + PIN_BOARD_PANEL_PADDING_BLOCK),
    )

    return (
      <div className="overflow-x-auto overflow-y-visible pb-2">
        <div
          ref={(node) => {
            boardRefs.current[boardId] = node
          }}
          className={cn(
            'relative',
            editMode && 'rounded-2xl border border-border/70 bg-card/70',
          )}
          style={{
            minWidth: boardWidth > 0 ? `${boardWidth}px` : undefined,
            minHeight: `${boardHeight}px`,
            ...(editMode
              ? {
                  backgroundImage: `
                    linear-gradient(to right, rgba(148, 163, 184, 0.12) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px)
                  `,
                  backgroundSize: `${PIN_BOARD_PANEL_POSITION_STEP_BLOCK}px ${PIN_BOARD_PANEL_POSITION_STEP_BLOCK}px`,
                }
              : {}),
          }}
        >
          {editMode && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-0 flex justify-end px-4 py-3 text-[11px] text-muted-foreground/70">
              Drag the title bar to move panels. Drag an edge to resize.
            </div>
          )}

          {panelList.map((panel) => {
          const picker = getPicker(panel.id)
          const selectedTodoPath = normalizeRelativePath(panel.path ?? '') || null
          const todoOptionsForPanel = panel.section
            ? todoOptions.filter((opt) => extractSection(normalizeRelativePath(opt.path)) === panel.section)
            : todoOptions
          const panelLabel =
            panel.type === 'todos'
              ? (
                selectedTodoPath
                  ? (todoOptionByPath.get(selectedTodoPath)?.label ?? todoLabelFromPath(selectedTodoPath))
                  : (panel.section ? `To-Do: ${panel.section}` : 'To-Do Notes')
              )
              : panel.path
                ? (optionByPath.get(normalizeRelativePath(panel.path ?? ''))?.label ??
                  labelFromPath(panel.path ?? ''))
                : 'Pinned Notes'
          const assignedGroupId = resolvedPanelGroupIdByPanel[panel.id] ?? '__ungrouped__'
          const width = resolvePanelWidth(panel)
          const height = resolvePanelHeight(panel)
          const x = resolvePanelX(panel)
          const y = resolvePanelY(panel)
          const isActive = activePanelId === panel.id

          return (
            <div
              key={panel.id}
              className={cn(
                'absolute flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-shadow',
                isActive && 'z-20 shadow-lg ring-2 ring-primary/25',
                !isActive && 'z-10',
              )}
              style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${width}px`,
                height: `${height}px`,
              }}
            >
              <div
                className={cn(
                  'flex shrink-0 items-center gap-2 border-b border-border/50 px-2.5 py-1.5',
                  editMode ? 'bg-muted/40' : 'bg-muted/20',
                )}
              >
                <div
                  onPointerDown={(event) => handleMoveStart(panel, boardId, event)}
                  className={cn(
                    'min-w-0 flex flex-1 items-center gap-1.5',
                    editMode && !disabled && 'cursor-move',
                  )}
                  style={editMode ? { touchAction: 'none' } : undefined}
                  title={editMode ? 'Drag to move panel' : undefined}
                >
                  {editMode && (
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {panel.type === 'todos' ? (
                    <ListChecks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/70">
                    {panelLabel}
                  </span>
                </div>

                {editMode && (
                  <div className="flex shrink-0 items-center gap-1">
                    {panelGroups.length > 0 && onAssignPanelToGroup && (
                      <select
                        value={assignedGroupId}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          onAssignPanelToGroup(panel, nextValue === '__ungrouped__' ? null : nextValue)
                        }}
                        className="h-5 max-w-[120px] rounded border border-border/50 bg-background/60 px-1 text-[10px] text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        title="Assign group"
                      >
                        <option value="__ungrouped__">Ungrouped</option>
                        {panelGroups.map((group) => (
                          <option key={`${panel.id}-group-opt-${group.id}`} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      aria-label="Remove panel"
                      disabled={disabled}
                      onClick={() => onRemovePanel(panel.id)}
                      className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {panel.type === 'todos' ? (
                  editMode ? (
                    <div className="h-full p-3">
                      <FileSelectionViewerBlock
                        heading=""
                        selectedPath={selectedTodoPath}
                        selectedLabel={
                          selectedTodoPath
                            ? (todoOptionByPath.get(selectedTodoPath)?.label ?? todoLabelFromPath(selectedTodoPath))
                            : ''
                        }
                        emptySelectionMessage="No to-do note selected."
                        options={todoOptionsForPanel}
                        query={picker.query}
                        onQueryChange={(q) => setPickerField(panel.id, 'query', q)}
                        pickerOpen={picker.pickerOpen}
                        onPickerOpenChange={(open) => setPickerField(panel.id, 'pickerOpen', open)}
                        controlsHidden={false}
                        onControlsHiddenChange={() => {}}
                        onSelectPath={(path) => {
                          const normalized = normalizeRelativePath(path ?? '') || undefined
                          onUpdatePanel(panel.id, { path: normalized, section: undefined })
                          setPickerField(panel.id, 'viewerNonce', picker.viewerNonce + 1)
                        }}
                        onOpenPath={onOpenFile}
                        disabled={disabled}
                        searchPlaceholder="Search to-do notes"
                        searchEmptyMessage="No to-do notes found"
                        emptyViewerMessage="Select a to-do note to render it here."
                        renderSelectedContent={() => (
                          <TodoListPanelBlock
                            key={`todo::${panel.id}::${panel.path}::${picker.viewerNonce}`}
                            filePath={normalizeRelativePath(panel.path ?? '')}
                          />
                        )}
                      />
                    </div>
                  ) : panel.path ? (
                    <div className="h-full p-3">
                      <TodoListPanelBlock
                        key={`todo::${panel.id}::${panel.path}::${picker.viewerNonce}`}
                        filePath={normalizeRelativePath(panel.path ?? '')}
                      />
                    </div>
                  ) : panel.section ? (
                    <div className="p-3">
                      <TodoListPanelBlock
                        section={panel.section}
                        onSelectSection={(s) => onUpdatePanel(panel.id, { section: s })}
                        editMode={editMode}
                      />
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground/60">
                      No to-do selected
                    </div>
                  )
                ) : editMode ? (
                  <div className="h-full p-3">
                    <FileSelectionViewerBlock
                      heading=""
                      selectedPath={normalizeRelativePath(panel.path ?? '') || null}
                      selectedLabel={
                        panel.path
                          ? (optionByPath.get(normalizeRelativePath(panel.path))?.label ??
                            labelFromPath(panel.path))
                          : ''
                      }
                      emptySelectionMessage="No file selected."
                      options={markdownOptions}
                      query={picker.query}
                      onQueryChange={(q) => setPickerField(panel.id, 'query', q)}
                      pickerOpen={picker.pickerOpen}
                      onPickerOpenChange={(open) => setPickerField(panel.id, 'pickerOpen', open)}
                      controlsHidden={false}
                      onControlsHiddenChange={() => {}}
                      onSelectPath={(path) => {
                        const normalized = normalizeRelativePath(path ?? '') || undefined
                        onUpdatePanel(panel.id, { path: normalized })
                        setPickerField(panel.id, 'viewerNonce', picker.viewerNonce + 1)
                      }}
                      onOpenPath={onOpenFile}
                      disabled={disabled}
                      searchPlaceholder="Search files"
                      searchEmptyMessage="No markdown files found"
                      allowCustomValue
                      emptyViewerMessage="Select a file to render it here."
                      renderSelectedContent={() => (
                        <MarkdownDocumentBlock
                          key={`pin::${panel.id}::${panel.path}::${picker.viewerNonce}`}
                          path={normalizeRelativePath(panel.path ?? '')}
                          initialMode="view"
                          onOpenPath={onOpenFile}
                          onOpenPathForEdit={onOpenFile}
                          topBarHidden={topBarHidden}
                          className="h-full"
                        />
                      )}
                    />
                  </div>
                ) : panel.path ? (
                  <div className="h-full p-3">
                    <MarkdownDocumentBlock
                      key={`pin::${panel.id}::${panel.path}::${picker.viewerNonce}`}
                      path={normalizeRelativePath(panel.path ?? '')}
                      initialMode="view"
                      onOpenPath={onOpenFile}
                      onOpenPathForEdit={onOpenFile}
                      topBarHidden={topBarHidden}
                      className="h-full"
                    />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground/60">
                    No file selected
                  </div>
                )}
              </div>

              {editMode && (
                <>
                  {renderResizeHandle(panel, boardId, 'n', 'absolute inset-x-3 top-0 h-1 cursor-ns-resize')}
                  {renderResizeHandle(panel, boardId, 's', 'absolute inset-x-3 bottom-0 h-1 cursor-ns-resize')}
                  {renderResizeHandle(panel, boardId, 'e', 'absolute inset-y-3 right-0 w-1 cursor-ew-resize')}
                  {renderResizeHandle(panel, boardId, 'w', 'absolute inset-y-3 left-0 w-1 cursor-ew-resize')}
                  {renderResizeHandle(panel, boardId, 'ne', 'absolute right-0 top-0 h-3 w-3 cursor-nesw-resize')}
                  {renderResizeHandle(panel, boardId, 'nw', 'absolute left-0 top-0 h-3 w-3 cursor-nwse-resize')}
                  {renderResizeHandle(panel, boardId, 'se', 'absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize')}
                  {renderResizeHandle(panel, boardId, 'sw', 'absolute bottom-0 left-0 h-3 w-3 cursor-nesw-resize')}
                </>
              )}
            </div>
          )
          })}
        </div>
      </div>
    )
  }

  function setPickerField<K extends keyof PanelPickerState>(
    id: string,
    field: K,
    value: PanelPickerState[K],
  ) {
    setPickerState((prev) => ({
      ...prev,
      [id]: { ...getPicker(id), ...prev[id], [field]: value },
    }))
  }

  return (
    <div className={cn('space-y-3', className)}>
      {showLayoutModeToggle && (
        <div className="flex items-center justify-end gap-2">
          {editMode ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => setLayoutMode(false)}
            >
              <Check className="h-3.5 w-3.5" />
              Done
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setLayoutMode(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Layout
            </Button>
          )}
        </div>
      )}

      {editMode && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Panels move freely on the board and snap to fixed size steps while resizing.
          </p>
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => setAddMenuOpen((prev) => !prev)}
              disabled={disabled}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Panel
            </Button>
            {addMenuOpen && (
              <div className="absolute bottom-full right-0 z-20 mb-1 flex min-w-[160px] flex-col overflow-hidden rounded-lg border border-border/80 bg-popover shadow-md">
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                  onClick={() => {
                    onAddPanel('markdown')
                    setAddMenuOpen(false)
                  }}
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Markdown File
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                  onClick={() => {
                    onAddPanel('todos')
                    setAddMenuOpen(false)
                  }}
                >
                  <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                  To-Do Notes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {editMode && onCreatePanelGroup && (
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5">
          <input
            value={panelGroupDraft}
            onChange={(event) => setPanelGroupDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              createPanelGroupFromDraft()
            }}
            placeholder="Add panel group"
            className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={createPanelGroupFromDraft}
            disabled={!panelGroupDraft.trim()}
          >
            Add Group
          </Button>
        </div>
      )}

      {panels.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
          No panels yet. Click <strong>Add Panel</strong> to get started.
        </div>
      )}

      {panels.length > 0 && panelGroups.length === 0 && renderPanelBoard('all-panels', panels)}

      {panels.length > 0 && panelGroups.length > 0 && (
        <div className="space-y-3">
          {panelGroups.map((group) => {
            const groupedPanels = groupedPanelsByGroupId.grouped.get(group.id) ?? []
            return (
              <div key={`pin-group-${group.id}`} className="space-y-2">
                <ProgramGroupHeaderBlock
                  name={group.name}
                  collapsed={group.collapsed}
                  count={groupedPanels.length}
                  allowEdit={editMode}
                  onToggle={() => onTogglePanelGroupCollapsed?.(group.id)}
                  onDelete={editMode && onDeletePanelGroup ? () => onDeletePanelGroup(group.id) : undefined}
                />
                {!group.collapsed && (
                  groupedPanels.length > 0 ? (
                    renderPanelBoard(group.id, groupedPanels)
                  ) : (
                    <div className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                      No panels assigned to this group.
                    </div>
                  )
                )}
              </div>
            )
          })}

          {groupedPanelsByGroupId.ungrouped.length > 0 && (
            <div className="space-y-2">
              <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Ungrouped Panels
              </p>
              {renderPanelBoard('ungrouped-panels', groupedPanelsByGroupId.ungrouped)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
