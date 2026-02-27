import { useEffect, useState } from 'react'
import UniversalSearchBlock from '@/components/lego_blocks/integrations/UniversalSearchBlock'
import {
  UNIVERSAL_SEARCH_DROPDOWN_PRESET_BLOCK,
  buildPathSearchCandidatesBlock,
} from '@/components/lego_blocks/integrations/universalSearchPresetBlock'

interface SearchDropdownProps {
  items: string[]
  placeholder: string
  selected: string
  onSelect: (value: string) => void
  onInputChange?: (value: string) => void
  getSearchCandidates?: (value: string) => string[]
  limit?: number
  allowCustomValue?: boolean
  emptyMessage?: string
}

export default function SearchDropdown({
  items,
  placeholder,
  selected,
  onSelect,
  onInputChange,
  getSearchCandidates,
  limit = UNIVERSAL_SEARCH_DROPDOWN_PRESET_BLOCK.limit ?? 80,
  allowCustomValue = false,
  emptyMessage = UNIVERSAL_SEARCH_DROPDOWN_PRESET_BLOCK.emptyMessage ?? 'No matches found.',
}: SearchDropdownProps) {
  const [query, setQuery] = useState(selected)

  useEffect(() => {
    setQuery(selected)
  }, [selected])

  return (
    <UniversalSearchBlock
      {...UNIVERSAL_SEARCH_DROPDOWN_PRESET_BLOCK}
      items={items}
      query={query}
      onQueryChange={(value) => {
        setQuery(value)
        onInputChange?.(value)
      }}
      onSelect={(value) => {
        onSelect(value)
        setQuery(value)
      }}
      getItemKey={(value) => value}
      getItemLabel={(value) => value}
      getItemSearchCandidates={(value) => getSearchCandidates?.(value) ?? buildPathSearchCandidatesBlock(value)}
      placeholder={placeholder}
      selectedItemKey={selected || null}
      limit={limit}
      allowCustomValue={allowCustomValue}
      onSelectCustomValue={(value) => {
        onSelect(value)
        setQuery(value)
      }}
      emptyMessage={emptyMessage}
    />
  )
}
