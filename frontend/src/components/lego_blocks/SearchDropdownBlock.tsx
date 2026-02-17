import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'

interface SearchDropdownProps {
  items: string[]
  placeholder: string
  selected: string
  onSelect: (value: string) => void
  onInputChange?: (value: string) => void
  limit?: number
  allowCustomValue?: boolean
}

export default function SearchDropdown({
  items,
  placeholder,
  selected,
  onSelect,
  onInputChange,
  limit = 50,
  allowCustomValue = false,
}: SearchDropdownProps) {
  const [query, setQuery] = useState(selected)
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items.slice(0, limit)
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
    return items
      .filter(item => {
        const haystack = item.toLowerCase()
        return tokens.every(token => haystack.includes(token))
      })
      .slice(0, limit)
  }, [items, limit, query])

  const handleSelect = (value: string) => {
    onSelect(value)
    setQuery(value)
    setShowDropdown(false)
    setHighlightIndex(-1)
  }

  useEffect(() => {
    setQuery(selected)
  }, [selected])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const next = e.target.value
            setQuery(next)
            onInputChange?.(next)
            setShowDropdown(true)
            setHighlightIndex(0)
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={(e) => {
            if (!showDropdown) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHighlightIndex((prev) => {
                const next = prev + 1
                return next >= filteredItems.length ? 0 : next
              })
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlightIndex((prev) => {
                const next = prev - 1
                return next < 0 ? filteredItems.length - 1 : next
              })
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              const value = filteredItems[highlightIndex]
              if (value) {
                handleSelect(value)
              } else if (allowCustomValue && query.trim()) {
                handleSelect(query.trim())
              }
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setShowDropdown(false)
            }
          }}
          placeholder={placeholder}
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>

      {showDropdown && filteredItems.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-64 overflow-auto rounded-lg border bg-background shadow-lg">
          {filteredItems.map((item, index) => (
            <button
              key={item}
              onClick={() => handleSelect(item)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${
                item === selected || index === highlightIndex ? 'bg-accent' : ''
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  )
}
