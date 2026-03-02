import type { UniversalSearchBlockProps } from '@/components/lego_blocks/integrations/UniversalSearchBlock'

type UniversalSearchPresetKeysBlock<T> = Pick<
  UniversalSearchBlockProps<T>,
  | 'limit'
  | 'showDropdown'
  | 'dismissOnOutsideClick'
  | 'closeOnSelect'
  | 'inputWrapperClassName'
  | 'inputClassName'
  | 'dropdownClassName'
  | 'listClassName'
  | 'emptyClassName'
  | 'emptyMessage'
>

export const UNIVERSAL_SEARCH_COMMAND_MODAL_PRESET_BLOCK: UniversalSearchPresetKeysBlock<unknown> = {
  limit: 80,
  dismissOnOutsideClick: false,
  closeOnSelect: false,
  inputWrapperClassName: 'ltm-shell-field-surface flex items-center gap-2 rounded-lg px-2.5',
  inputClassName: 'h-10 border-0 bg-transparent text-sm placeholder:text-muted-foreground focus:ring-0 focus:ring-offset-0',
  dropdownClassName: 'static z-auto mt-2 max-h-[min(96vh,1040px)] overflow-y-auto border-0 bg-transparent shadow-none',
  listClassName: '!max-h-none h-[min(84vh,44rem)] overflow-auto space-y-0 p-2',
  emptyClassName: 'rounded-lg px-3 py-4 text-sm text-muted-foreground',
  emptyMessage: 'No matches. Try another keyword.',
}

export const UNIVERSAL_SEARCH_DROPDOWN_PRESET_BLOCK: UniversalSearchPresetKeysBlock<unknown> = {
  limit: 80,
  dismissOnOutsideClick: true,
  closeOnSelect: true,
  inputWrapperClassName: 'ltm-shell-field-surface flex items-center gap-2 rounded-lg px-2.5',
  inputClassName: 'h-10 border-0 bg-transparent text-sm placeholder:text-muted-foreground focus:ring-0 focus:ring-offset-0',
  listClassName: 'max-h-[min(52vh,420px)] overflow-auto space-y-0 p-2',
  emptyClassName: 'rounded-lg px-3 py-4 text-sm text-muted-foreground',
  emptyMessage: 'No matches. Try another keyword.',
}

export const UNIVERSAL_SEARCH_INLINE_FILTER_PRESET_BLOCK: UniversalSearchPresetKeysBlock<unknown> = {
  limit: 80,
  showDropdown: false,
  dismissOnOutsideClick: false,
  closeOnSelect: false,
  inputClassName: 'h-8 rounded-md border border-input bg-background pl-8 pr-2 text-xs text-foreground outline-none ring-0 transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-0 focus:ring-offset-0',
}

export const UNIVERSAL_SEARCH_PILL_FILTER_PRESET_BLOCK: UniversalSearchPresetKeysBlock<unknown> = {
  limit: 80,
  showDropdown: false,
  dismissOnOutsideClick: false,
  closeOnSelect: false,
  inputClassName: 'h-9 w-56 rounded-full border border-input bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
}

function appendUniqueCandidateBlock(target: string[], value: string): void {
  const normalized = value.trim()
  if (!normalized) return
  if (!target.includes(normalized)) target.push(normalized)
}

export function buildPathSearchCandidatesBlock(pathValue: string): string[] {
  const path = pathValue.trim()
  if (!path) return []

  const normalizedPath = path.replace(/\\/g, '/')
  const segments = normalizedPath.split('/').filter(Boolean)
  const filename = segments.length > 0 ? segments[segments.length - 1] : normalizedPath
  const stem = filename.replace(/\.[^/.]+$/, '')
  const folderPath = segments.slice(0, -1).join('/')
  const stemTokens = stem.split(/[\s._-]+/).filter(Boolean)

  const candidates: string[] = []
  appendUniqueCandidateBlock(candidates, normalizedPath)
  appendUniqueCandidateBlock(candidates, filename)
  appendUniqueCandidateBlock(candidates, stem)
  appendUniqueCandidateBlock(candidates, folderPath)

  for (const segment of segments) {
    appendUniqueCandidateBlock(candidates, segment)
  }

  for (const token of stemTokens) {
    appendUniqueCandidateBlock(candidates, token)
  }

  return candidates
}
