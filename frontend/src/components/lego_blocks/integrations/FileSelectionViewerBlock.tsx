import type { ReactNode } from 'react'
import UniversalSearchBlock from '@/components/lego_blocks/integrations/UniversalSearchBlock'
import { buildPathSearchCandidatesBlock, UNIVERSAL_SEARCH_DROPDOWN_PRESET_BLOCK } from '@/components/lego_blocks/integrations/universalSearchPresetBlock'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { cn } from '@/lib/utils'

export interface FileSelectionOptionBlock {
  path: string
  label: string
  summary?: string
}

interface FileSelectionViewerBlockProps {
  heading: string
  summary?: string
  selectedPath: string | null
  selectedLabel?: string
  emptySelectionMessage: string
  options: FileSelectionOptionBlock[]
  query: string
  onQueryChange: (query: string) => void
  pickerOpen: boolean
  onPickerOpenChange: (open: boolean) => void
  controlsHidden: boolean
  onControlsHiddenChange: (hidden: boolean) => void
  onSelectPath: (path: string | null) => void | Promise<void>
  onOpenPath: (path: string) => void
  renderSelectedContent: () => ReactNode
  emptyViewerMessage: string
  disabled?: boolean
  className?: string
  hideSelectionLabel?: string
  showSelectionLabel?: string
  showSelectionVisibilityToggle?: boolean
  selectButtonLabel?: string
  searchPlaceholder?: string
  searchEmptyMessage?: string
  searchHelperText?: string
  allowCustomValue?: boolean
  openButtonLabel?: string
  clearButtonLabel?: string
  hideDetailsWithSelectionControls?: boolean
}

function labelFromPathBlock(path: string): string {
  const fileName = path.split('/').pop() ?? path
  return fileName.toLowerCase().endsWith('.md') ? fileName.slice(0, -3) : fileName
}

export default function FileSelectionViewerBlock({
  heading,
  summary,
  selectedPath,
  selectedLabel,
  emptySelectionMessage,
  options,
  query,
  onQueryChange,
  pickerOpen,
  onPickerOpenChange,
  controlsHidden,
  onControlsHiddenChange,
  onSelectPath,
  onOpenPath,
  renderSelectedContent,
  emptyViewerMessage,
  disabled = false,
  className,
  hideSelectionLabel = 'Hide File Selection',
  showSelectionLabel = 'Show File Selection',
  showSelectionVisibilityToggle = true,
  selectButtonLabel = 'Select File',
  searchPlaceholder = 'Search file',
  searchEmptyMessage = 'No files found',
  searchHelperText,
  allowCustomValue = true,
  openButtonLabel = 'Open File',
  clearButtonLabel = 'Clear',
  hideDetailsWithSelectionControls = false,
}: FileSelectionViewerBlockProps) {
  const showDetails = !hideDetailsWithSelectionControls || !controlsHidden
  const resolvedLabel = selectedLabel || (selectedPath ? labelFromPathBlock(selectedPath) : '')

  const applySelection = (value: string | null) => {
    void onSelectPath(value)
    onPickerOpenChange(false)
    onQueryChange('')
  }

  return (
    <div className={cn('rounded-xl border bg-background p-3', className)}>
      <div className="mb-2 flex flex-wrap items-start gap-2">
        <div className="min-w-[220px] flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{heading}</p>
          {showDetails && summary && (
            <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
          )}
          {showDetails && (selectedPath ? (
            <p className="mt-1 text-xs text-foreground/80">
              <span className="font-medium">{resolvedLabel}</span>
              {' · '}
              <button
                type="button"
                className="text-left text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onOpenPath(selectedPath)
                }}
                title="Open in Thinking Space explorer"
              >
                {selectedPath}
              </button>
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{emptySelectionMessage}</p>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {showSelectionVisibilityToggle && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => {
                const next = !controlsHidden
                onControlsHiddenChange(next)
                if (next) onPickerOpenChange(false)
              }}
            >
              {controlsHidden ? showSelectionLabel : hideSelectionLabel}
            </Button>
          )}

          {!controlsHidden && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => onPickerOpenChange(!pickerOpen)}
              >
                {pickerOpen ? 'Close Selection' : selectButtonLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={disabled || !selectedPath}
                onClick={() => applySelection(null)}
              >
                {clearButtonLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!selectedPath}
                onClick={() => {
                  if (!selectedPath) return
                  onOpenPath(selectedPath)
                }}
              >
                {openButtonLabel}
              </Button>
            </>
          )}
        </div>
      </div>

      {pickerOpen && !controlsHidden && (
        <div className="mb-2 rounded-lg border bg-muted/10 p-2">
          <UniversalSearchBlock<FileSelectionOptionBlock>
            {...UNIVERSAL_SEARCH_DROPDOWN_PRESET_BLOCK}
            items={options}
            query={query}
            onQueryChange={onQueryChange}
            onSelect={(item) => applySelection(item.path)}
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
            placeholder={searchPlaceholder}
            emptyMessage={searchEmptyMessage}
            allowCustomValue={allowCustomValue}
            onSelectCustomValue={(value) => applySelection(value)}
            open={pickerOpen}
            onOpenChange={onPickerOpenChange}
            dismissOnOutsideClick={false}
            inputClassName="h-9 border border-input bg-background pl-10 pr-3 text-sm focus:ring-0 focus:ring-offset-0"
            dropdownClassName="z-50 mt-1"
            listClassName="max-h-64 overflow-auto p-1"
          />
          {searchHelperText && (
            <p className="mt-1 text-[11px] text-muted-foreground">{searchHelperText}</p>
          )}
        </div>
      )}

      {selectedPath ? (
        renderSelectedContent()
      ) : (
        <p className="text-sm text-muted-foreground">{emptyViewerMessage}</p>
      )}
    </div>
  )
}
