import { useMemo, useState } from 'react'
import MarkdownDocumentBlock from '@/components/lego_blocks/integrations/MarkdownDocumentBlock'
import UniversalSearchBlock from '@/components/lego_blocks/integrations/UniversalSearchBlock'
import { buildPathSearchCandidatesBlock, UNIVERSAL_SEARCH_DROPDOWN_PRESET_BLOCK } from '@/components/lego_blocks/integrations/universalSearchPresetBlock'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { cn } from '@/lib/utils'

export interface ProjectMemoryFileOptionBlock {
  path: string
  label: string
  summary?: string
}

interface ProjectMemoryFilesBlockProps {
  markdownOptions: ProjectMemoryFileOptionBlock[]
  quotesPath: string | null
  rememberPath: string | null
  onSelectQuotesPath: (path: string | null) => void | Promise<void>
  onSelectRememberPath: (path: string | null) => void | Promise<void>
  onOpenFile: (path: string) => void
  disabled?: boolean
  className?: string
  viewerHeightClassName?: string
}

interface ProjectMemorySlotConfigBlock {
  id: 'quotes' | 'remember'
  heading: string
  summary: string
  emptyMessage: string
}

const PROJECT_MEMORY_SLOTS_BLOCK: ProjectMemorySlotConfigBlock[] = [
  {
    id: 'quotes',
    heading: 'Quotes',
    summary: 'Keep the strongest lines, excerpts, and references for this project.',
    emptyMessage: 'No quotes file selected.',
  },
  {
    id: 'remember',
    heading: 'Things To Remember',
    summary: 'Capture durable reminders, rules, and principles for this project.',
    emptyMessage: 'No things-to-remember file selected.',
  },
]

function normalizeRelativePathBlock(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function labelFromPathBlock(path: string): string {
  const normalized = normalizeRelativePathBlock(path)
  if (!normalized) return ''
  const fileName = normalized.split('/').pop() ?? normalized
  return fileName.toLowerCase().endsWith('.md') ? fileName.slice(0, -3) : fileName
}

export default function ProjectMemoryFilesBlock({
  markdownOptions,
  quotesPath,
  rememberPath,
  onSelectQuotesPath,
  onSelectRememberPath,
  onOpenFile,
  disabled = false,
  className,
  viewerHeightClassName = 'h-[700px]',
}: ProjectMemoryFilesBlockProps) {
  const [quotesPickerOpen, setQuotesPickerOpen] = useState(false)
  const [quotesQuery, setQuotesQuery] = useState('')
  const [rememberPickerOpen, setRememberPickerOpen] = useState(false)
  const [rememberQuery, setRememberQuery] = useState('')
  const [quotesViewerNonce, setQuotesViewerNonce] = useState(0)
  const [rememberViewerNonce, setRememberViewerNonce] = useState(0)

  const optionByPath = useMemo(
    () => new Map(markdownOptions.map(option => [normalizeRelativePathBlock(option.path), option] as const)),
    [markdownOptions],
  )

  const selectedQuotesPath = normalizeRelativePathBlock(quotesPath ?? '') || null
  const selectedRememberPath = normalizeRelativePathBlock(rememberPath ?? '') || null

  return (
    <div className={cn('rounded-xl border bg-background p-3', className)}>
      <div className="mb-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Project Memory</p>
        <p className="mt-1 text-xs text-muted-foreground">
          These selections are project-level and persist in organizer UI state.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {PROJECT_MEMORY_SLOTS_BLOCK.map((slot) => {
          const isQuotes = slot.id === 'quotes'
          const selectedPath = isQuotes ? selectedQuotesPath : selectedRememberPath
          const selectedLabel = selectedPath
            ? (optionByPath.get(selectedPath)?.label ?? labelFromPathBlock(selectedPath))
            : ''
          const pickerOpen = isQuotes ? quotesPickerOpen : rememberPickerOpen
          const query = isQuotes ? quotesQuery : rememberQuery
          const viewerNonce = isQuotes ? quotesViewerNonce : rememberViewerNonce
          const setPickerOpen = isQuotes ? setQuotesPickerOpen : setRememberPickerOpen
          const setQuery = isQuotes ? setQuotesQuery : setRememberQuery
          const onSelect = isQuotes ? onSelectQuotesPath : onSelectRememberPath

          return (
            <div key={`project-memory-slot-${slot.id}`} className="rounded-lg border bg-muted/5 p-2.5">
              <div className="mb-2 flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{slot.heading}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{slot.summary}</p>
                  {selectedPath ? (
                    <p className="mt-1 text-xs text-foreground/80">
                      <span className="font-medium">{selectedLabel}</span>
                      {' · '}
                      <button
                        type="button"
                        className="text-left text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          onOpenFile(selectedPath)
                        }}
                        title="Open in Thinking Space explorer"
                      >
                        {selectedPath}
                      </button>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">{slot.emptyMessage}</p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => setPickerOpen(prev => !prev)}
                >
                  {pickerOpen ? 'Close Selection' : 'Select File'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled || !selectedPath}
                  onClick={() => {
                    void onSelect(null)
                    if (isQuotes) setQuotesViewerNonce(prev => prev + 1)
                    else setRememberViewerNonce(prev => prev + 1)
                  }}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedPath}
                  onClick={() => {
                    if (!selectedPath) return
                    onOpenFile(selectedPath)
                  }}
                >
                  Open File
                </Button>
              </div>

              {pickerOpen && (
                <div className="mb-2 rounded-lg border bg-muted/10 p-2">
                  <UniversalSearchBlock<ProjectMemoryFileOptionBlock>
                    {...UNIVERSAL_SEARCH_DROPDOWN_PRESET_BLOCK}
                    items={markdownOptions}
                    query={query}
                    onQueryChange={setQuery}
                    onSelect={(item) => {
                      void onSelect(normalizeRelativePathBlock(item.path) || null)
                      if (isQuotes) setQuotesViewerNonce(prev => prev + 1)
                      else setRememberViewerNonce(prev => prev + 1)
                      setPickerOpen(false)
                      setQuery('')
                    }}
                    getItemKey={(item) => item.path}
                    getItemLabel={(item) => item.label}
                    getItemDescription={(item) => item.path}
                    getItemSearchCandidates={(item) => [
                      item.label,
                      item.path,
                      item.summary ?? '',
                      ...buildPathSearchCandidatesBlock(item.path),
                    ]}
                    selectedItemKey={selectedPath || null}
                    placeholder={`Search ${slot.heading.toLowerCase()} file`}
                    emptyMessage="No markdown files found"
                    allowCustomValue
                    onSelectCustomValue={(value) => {
                      void onSelect(normalizeRelativePathBlock(value) || null)
                      if (isQuotes) setQuotesViewerNonce(prev => prev + 1)
                      else setRememberViewerNonce(prev => prev + 1)
                      setPickerOpen(false)
                      setQuery('')
                    }}
                    open={pickerOpen}
                    onOpenChange={setPickerOpen}
                    dismissOnOutsideClick={false}
                    inputClassName="h-9 border border-input bg-background pl-10 pr-3 text-sm focus:ring-0 focus:ring-offset-0"
                    dropdownClassName="z-50 mt-1"
                    listClassName="max-h-64 overflow-auto p-1"
                  />
                </div>
              )}

              {selectedPath ? (
                <div className={cn('overflow-hidden rounded-lg border', viewerHeightClassName)}>
                  <MarkdownDocumentBlock
                    key={`${slot.id}::${selectedPath}::${viewerNonce}`}
                    path={selectedPath}
                    initialMode="view"
                    onOpenPath={(path) => onOpenFile(path)}
                    onOpenPathForEdit={(path) => onOpenFile(path)}
                    className="h-full"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a file to render it here.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
