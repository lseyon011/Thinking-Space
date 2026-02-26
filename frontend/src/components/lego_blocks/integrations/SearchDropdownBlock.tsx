import { useEffect, useState } from 'react'
import UniversalSearchBlock from '@/components/lego_blocks/integrations/UniversalSearchBlock'

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
  limit = 50,
  allowCustomValue = false,
  emptyMessage = 'No matches found.',
}: SearchDropdownProps) {
  const [query, setQuery] = useState(selected)

  useEffect(() => {
    setQuery(selected)
  }, [selected])

  return (
    <UniversalSearchBlock
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
      getItemSearchCandidates={(value) => getSearchCandidates?.(value) ?? [value]}
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
