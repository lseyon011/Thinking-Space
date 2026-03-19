import { useState, useMemo } from 'react'
import { Plus, X, FileText, ListChecks } from 'lucide-react'
import FileSelectionViewerBlock, { type FileSelectionOptionBlock } from '@/components/lego_blocks/integrations/FileSelectionViewerBlock'
import MarkdownDocumentBlock from '@/components/lego_blocks/integrations/MarkdownDocumentBlock'
import TodoCalendarOrch from '@/components/orchestrators/TodoCalendarOrch'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { cn } from '@/lib/utils'
import type { PinBoardPanelBlock } from '@/services/lego_blocks/integrations/organizerUiStateBlock'

export type { PinBoardPanelBlock }
export type PinBoardFileOptionBlock = FileSelectionOptionBlock

interface PanelUiState {
  pickerOpen: boolean
  query: string
  viewerNonce: number
  controlsHidden: boolean
}

interface PinBoardBlockProps {
  markdownOptions: PinBoardFileOptionBlock[]
  panels: PinBoardPanelBlock[]
  onUpdatePanel: (id: string, updates: Partial<PinBoardPanelBlock>) => void
  onAddPanel: (type: 'markdown' | 'todos') => void
  onRemovePanel: (id: string) => void
  onOpenFile: (path: string) => void
  disabled?: boolean
  className?: string
}

const COL_SPAN_CLASS: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
}

const HEIGHT_CLASS: Record<string, string> = {
  sm: 'h-[420px]',
  md: 'h-[660px]',
  lg: 'h-[880px]',
  xl: 'h-[1120px]',
}

const HEIGHT_LABELS: Array<{ key: 'sm' | 'md' | 'lg' | 'xl'; label: string }> = [
  { key: 'sm', label: 'S' },
  { key: 'md', label: 'M' },
  { key: 'lg', label: 'L' },
  { key: 'xl', label: 'XL' },
]

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function labelFromPath(path: string): string {
  const normalized = normalizeRelativePath(path)
  if (!normalized) return ''
  const fileName = normalized.split('/').pop() ?? normalized
  return fileName.toLowerCase().endsWith('.md') ? fileName.slice(0, -3) : fileName
}

export default function PinBoardBlock({
  markdownOptions,
  panels,
  onUpdatePanel,
  onAddPanel,
  onRemovePanel,
  onOpenFile,
  disabled = false,
  className,
}: PinBoardBlockProps) {
  const [panelUiState, setPanelUiState] = useState<Record<string, PanelUiState>>({})
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  const optionByPath = useMemo(
    () => new Map(markdownOptions.map(opt => [normalizeRelativePath(opt.path), opt] as const)),
    [markdownOptions],
  )

  function getPanelUi(id: string): PanelUiState {
    return panelUiState[id] ?? { pickerOpen: false, query: '', viewerNonce: 0, controlsHidden: false }
  }

  function setPanelUiField<K extends keyof PanelUiState>(id: string, field: K, value: PanelUiState[K]) {
    setPanelUiState(prev => ({
      ...prev,
      [id]: { ...getPanelUi(id), ...prev[id], [field]: value },
    }))
  }

  const displayPanels = panels.length > 0 ? panels : []

  return (
    <div className={cn('space-y-4', className)}>
      {displayPanels.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
          No panels yet. Add a markdown file or to-do notes panel below.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {displayPanels.map((panel) => {
          const colSpan = panel.colSpan ?? 1
          const heightPreset = panel.heightPreset ?? 'md'
          const ui = getPanelUi(panel.id)

          return (
            <div
              key={panel.id}
              className={cn(
                'flex flex-col rounded-xl border border-border/80 bg-muted/25 overflow-hidden',
                COL_SPAN_CLASS[colSpan],
              )}
            >
              {/* Panel header */}
              <div className="flex shrink-0 items-center gap-1.5 border-b border-border/50 bg-muted/30 px-2.5 py-1.5">
                {panel.type === 'todos'
                  ? <ListChecks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  : <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}

                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/70">
                  {panel.type === 'todos' ? 'To-Do Notes' : (
                    panel.path
                      ? (optionByPath.get(normalizeRelativePath(panel.path ?? ''))?.label ?? labelFromPath(panel.path ?? ''))
                      : 'Pinned Notes'
                  )}
                </span>

                {/* Resize controls */}
                <div className="flex shrink-0 items-center gap-0.5">
                  {/* Column span */}
                  <div className="flex items-center rounded border border-border/50 bg-background/50">
                    {([1, 2, 3] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        title={`${n} column${n > 1 ? 's' : ''} wide`}
                        disabled={disabled}
                        onClick={() => onUpdatePanel(panel.id, { colSpan: n })}
                        className={cn(
                          'flex h-5 w-5 items-center justify-center text-[10px] font-medium transition-colors',
                          colSpan === n
                            ? 'bg-foreground text-background'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>

                  {/* Height preset */}
                  <div className="ml-1 flex items-center rounded border border-border/50 bg-background/50">
                    {HEIGHT_LABELS.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        title={`Height: ${key.toUpperCase()}`}
                        disabled={disabled}
                        onClick={() => onUpdatePanel(panel.id, { heightPreset: key })}
                        className={cn(
                          'flex h-5 min-w-[1.25rem] items-center justify-center px-1 text-[10px] font-medium transition-colors',
                          heightPreset === key
                            ? 'bg-foreground text-background'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Remove panel */}
                  <button
                    type="button"
                    aria-label="Remove panel"
                    disabled={disabled}
                    onClick={() => onRemovePanel(panel.id)}
                    className="ml-1 flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Panel body */}
              <div className={cn('min-h-0 flex-1 overflow-y-auto', HEIGHT_CLASS[heightPreset])}>
                {panel.type === 'todos' ? (
                  <div className="p-3">
                    <TodoCalendarOrch />
                  </div>
                ) : (
                  <div className="p-3">
                    <FileSelectionViewerBlock
                      heading=""
                      selectedPath={normalizeRelativePath(panel.path ?? '') || null}
                      selectedLabel={
                        panel.path
                          ? (optionByPath.get(normalizeRelativePath(panel.path))?.label ?? labelFromPath(panel.path))
                          : ''
                      }
                      emptySelectionMessage="No file selected."
                      options={markdownOptions}
                      query={ui.query}
                      onQueryChange={(q) => setPanelUiField(panel.id, 'query', q)}
                      pickerOpen={ui.pickerOpen}
                      onPickerOpenChange={(open) => setPanelUiField(panel.id, 'pickerOpen', open)}
                      controlsHidden={ui.controlsHidden}
                      onControlsHiddenChange={(hidden) => setPanelUiField(panel.id, 'controlsHidden', hidden)}
                      onSelectPath={(path) => {
                        const normalized = normalizeRelativePath(path ?? '') || undefined
                        onUpdatePanel(panel.id, { path: normalized })
                        setPanelUiField(panel.id, 'viewerNonce', ui.viewerNonce + 1)
                      }}
                      onOpenPath={onOpenFile}
                      disabled={disabled}
                      searchPlaceholder="Search files"
                      searchEmptyMessage="No markdown files found"
                      allowCustomValue
                      emptyViewerMessage="Select a file to render it here."
                      renderSelectedContent={() => (
                        <MarkdownDocumentBlock
                          key={`pin::${panel.id}::${panel.path}::${ui.viewerNonce}`}
                          path={normalizeRelativePath(panel.path ?? '')}
                          initialMode="view"
                          onOpenPath={onOpenFile}
                          onOpenPathForEdit={onOpenFile}
                          className="h-full"
                        />
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add panel controls */}
      <div className="relative flex items-center gap-2">
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={() => setAddMenuOpen(prev => !prev)}
            disabled={disabled}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Panel
          </Button>

          {addMenuOpen && (
            <div className="absolute bottom-full left-0 z-20 mb-1 flex flex-col overflow-hidden rounded-lg border border-border/80 bg-popover shadow-md">
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                onClick={() => { onAddPanel('markdown'); setAddMenuOpen(false) }}
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Markdown File
              </button>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                onClick={() => { onAddPanel('todos'); setAddMenuOpen(false) }}
              >
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                To-Do Notes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
