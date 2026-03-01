import { useMemo, useState } from 'react'
import FileSelectionViewerBlock, { type FileSelectionOptionBlock } from '@/components/lego_blocks/integrations/FileSelectionViewerBlock'
import MarkdownDocumentBlock from '@/components/lego_blocks/integrations/MarkdownDocumentBlock'
import { cn } from '@/lib/utils'

export type ProjectMemoryFileOptionBlock = FileSelectionOptionBlock

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
  const [quotesSelectionControlsHidden, setQuotesSelectionControlsHidden] = useState(false)
  const [rememberSelectionControlsHidden, setRememberSelectionControlsHidden] = useState(false)

  const optionByPath = useMemo(
    () => new Map(markdownOptions.map(option => [normalizeRelativePathBlock(option.path), option] as const)),
    [markdownOptions],
  )

  const selectedQuotesPath = normalizeRelativePathBlock(quotesPath ?? '') || null
  const selectedRememberPath = normalizeRelativePathBlock(rememberPath ?? '') || null

  return (
    <div className={cn('p-0', className)}>
      <div className="grid gap-4">
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
          const controlsHidden = isQuotes ? quotesSelectionControlsHidden : rememberSelectionControlsHidden
          const setControlsHidden = isQuotes ? setQuotesSelectionControlsHidden : setRememberSelectionControlsHidden
          const onSelect = isQuotes ? onSelectQuotesPath : onSelectRememberPath

          return (
            <FileSelectionViewerBlock
              key={`project-memory-slot-${slot.id}`}
              className="rounded-xl border border-border/80 bg-muted/25 p-3"
              heading={slot.heading}
              summary={slot.summary}
              selectedPath={selectedPath}
              selectedLabel={selectedLabel}
              emptySelectionMessage={slot.emptyMessage}
              options={markdownOptions}
              query={query}
              onQueryChange={setQuery}
              pickerOpen={pickerOpen}
              onPickerOpenChange={setPickerOpen}
              controlsHidden={controlsHidden}
              onControlsHiddenChange={setControlsHidden}
              onSelectPath={(path) => {
                void onSelect(normalizeRelativePathBlock(path ?? '') || null)
                if (isQuotes) setQuotesViewerNonce(prev => prev + 1)
                else setRememberViewerNonce(prev => prev + 1)
              }}
              onOpenPath={onOpenFile}
              disabled={disabled}
              searchPlaceholder={`Search ${slot.heading.toLowerCase()} file`}
              searchEmptyMessage="No markdown files found"
              allowCustomValue
              emptyViewerMessage="Select a file to render it here."
              renderSelectedContent={() => (
                <div className={cn('overflow-hidden rounded-lg border', viewerHeightClassName)}>
                  <MarkdownDocumentBlock
                    key={`${slot.id}::${selectedPath}::${viewerNonce}`}
                    path={selectedPath ?? ''}
                    initialMode="view"
                    onOpenPath={(path) => onOpenFile(path)}
                    onOpenPathForEdit={(path) => onOpenFile(path)}
                    className="h-full"
                  />
                </div>
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
