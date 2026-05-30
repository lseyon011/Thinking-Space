import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useUniversalSearchBlock } from '@/components/lego_blocks/hooks/shared/useUniversalSearchBlock'
import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'
import { listMarkdownPaths } from '@/services/orchestrators/fileSystemOrch'

interface NoteSearchItem {
  filePath: string
  label: string
}

interface Props {
  screenX: number
  screenY: number
  onClose: () => void
  onPick: (filePath: string) => void
}

const POPOVER_WIDTH = 360
const RESULT_LIMIT = 8

function pathToLabel(path: string): string {
  const name = path.split('/').pop() ?? path
  return name.replace(/\.md$/i, '')
}

export default function CanvasSearchBarBlock({
  screenX,
  screenY,
  onClose,
  onPick,
}: Props) {
  const theme = useCanvasThemeBlock()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<NoteSearchItem[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    let cancelled = false
    void listMarkdownPaths().then(paths => {
      if (cancelled) return
      const seen = new Set<string>()
      const next: NoteSearchItem[] = []
      for (const raw of paths) {
        const p = raw.trim()
        if (!p || seen.has(p)) continue
        seen.add(p)
        next.push({ filePath: p, label: pathToLabel(p) })
      }
      setItems(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  const {
    filteredItems,
    highlightIndex,
    setHighlightIndex,
    selectItem,
    handleKeyboardNav,
  } = useUniversalSearchBlock<NoteSearchItem>({
    items,
    query,
    limit: RESULT_LIMIT,
    getCandidates: it => [it.label, it.filePath],
    onSelect: it => onPick(it.filePath),
  })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    handleKeyboardNav(e)
  }

  return (
    <div
      ref={rootRef}
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY,
        width: POPOVER_WIDTH,
        background: theme.popoverBg,
        border: `1px solid ${theme.popoverBorder}`,
        borderRadius: 10,
        boxShadow: theme.isDark ? '0 16px 40px rgba(0,0,0,0.55)' : '0 16px 40px rgba(20,20,24,0.18)',
        backdropFilter: 'blur(12px)',
        zIndex: 200,
        overflow: 'hidden',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderBottom: filteredItems.length > 0 ? `1px solid ${theme.popoverBorder}` : 'none',
        }}
      >
        <Search size={14} style={{ color: theme.popoverTextMuted }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search Thinking Space…"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: theme.popoverText,
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        />
      </div>
      {filteredItems.length > 0 && (
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          {filteredItems.map((r, i) => (
            <button
              key={r.filePath}
              onClick={() => selectItem(r)}
              onMouseEnter={() => setHighlightIndex(i)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: i === highlightIndex ? theme.popoverHighlight : 'transparent',
                color: theme.popoverText,
                cursor: 'pointer',
                textAlign: 'left',
                gap: 1,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 500 }}>{r.label}</div>
              <div
                style={{
                  fontSize: 10,
                  color: theme.popoverTextMuted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                {r.filePath}
              </div>
            </button>
          ))}
        </div>
      )}
      {query && filteredItems.length === 0 && (
        <div style={{ padding: '8px 12px', color: theme.popoverTextMuted, fontSize: 12 }}>
          no matches
        </div>
      )}
    </div>
  )
}
