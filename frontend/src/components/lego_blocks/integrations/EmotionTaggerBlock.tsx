import { useMemo, useState } from 'react'
import { HOW_WE_FEEL, EmotionItem, EmotionColor } from '@/data/howWeFeel'

interface EmotionTaggerProps {
  selected: string[]
  onChange: (next: string[]) => void
}

const GROUPS: (EmotionColor | 'All')[] = ['All', 'Yellow', 'Green', 'Blue', 'Red']

function hashToShape(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) % 9973
  }
  const a = 30 + (h % 35)
  const b = 30 + ((h * 3) % 35)
  const c = 30 + ((h * 5) % 35)
  const d = 30 + ((h * 7) % 35)
  const e = 30 + ((h * 11) % 35)
  const f = 30 + ((h * 13) % 35)
  const g = 30 + ((h * 17) % 35)
  const k = 30 + ((h * 19) % 35)
  return `${a}% ${b}% ${c}% ${d}% / ${e}% ${f}% ${g}% ${k}%`
}

function colorStyles(color: EmotionColor) {
  switch (color) {
    case 'Red':
      return {
        background:
          'radial-gradient(circle at 20% 20%, rgba(255,120,120,0.9), rgba(212,30,30,0.9))',
        border: '1px solid rgba(255,120,120,0.5)',
        text: 'text-white',
      }
    case 'Yellow':
      return {
        background:
          'radial-gradient(circle at 30% 30%, rgba(255,238,150,0.95), rgba(248,193,47,0.95))',
        border: '1px solid rgba(248,193,47,0.5)',
        text: 'text-amber-950',
      }
    case 'Green':
      return {
        background:
          'radial-gradient(circle at 30% 30%, rgba(166,246,206,0.95), rgba(34,197,94,0.9))',
        border: '1px solid rgba(34,197,94,0.4)',
        text: 'text-emerald-950',
      }
    case 'Blue':
      return {
        background:
          'radial-gradient(circle at 30% 30%, rgba(173,216,255,0.9), rgba(59,130,246,0.9))',
        border: '1px solid rgba(59,130,246,0.4)',
        text: 'text-white',
      }
    default:
      return {
        background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
        border: '1px solid rgba(148,163,184,0.4)',
        text: 'text-slate-800',
      }
  }
}

export default function EmotionTagger({ selected, onChange }: EmotionTaggerProps) {
  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState<EmotionColor | 'All'>('All')
  const [activeEmotion, setActiveEmotion] = useState<EmotionItem | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return HOW_WE_FEEL.filter((item) => {
      if (activeGroup !== 'All' && item.colorGroup !== activeGroup) return false
      if (!q) return true
      return (
        item.label.toLowerCase().includes(q) ||
        item.definition.toLowerCase().includes(q)
      )
    })
  }, [activeGroup, query])

  const toggleEmotion = (item: EmotionItem) => {
    const exists = selected.includes(item.label)
    if (exists) {
      onChange(selected.filter((e) => e !== item.label))
      return
    }
    onChange([...selected, item.label])
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {selected.length === 0 && (
            <span className="text-xs text-muted-foreground">No emotions tagged yet.</span>
          )}
          {selected.map((label) => (
            <span
              key={label}
              className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs"
            >
              {label}
            </span>
          ))}
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-full border border-border/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
        >
          Select emotions
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {GROUPS.map((group) => (
                <button
                  key={group}
                  onClick={() => setActiveGroup(group)}
                  className={`rounded-full border px-4 py-1 text-xs uppercase tracking-[0.2em] ${
                    activeGroup === group
                      ? 'border-foreground text-foreground'
                      : 'border-border/70 text-muted-foreground'
                  }`}
                >
                  {group}
                </button>
              ))}
              <div className="ml-auto">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search feelings"
                  className="h-9 w-56 rounded-full border border-input bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-border/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
              >
                Done
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
                <div className="mb-4 text-xs text-muted-foreground">
                  High energy unpleasant (top-left) · High energy pleasant (top-right) ·
                  Low energy unpleasant (bottom-left) · Low energy pleasant (bottom-right)
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {['Red', 'Yellow', 'Blue', 'Green'].map((group) => {
                    const groupItems = filtered.filter((item) => item.colorGroup === group)
                    return (
                      <div key={group} className="rounded-2xl border border-border/50 bg-white/80 p-4">
                        <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {group}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {groupItems.map((item) => {
                            const styles = colorStyles(item.colorGroup)
                            const isSelected = selected.includes(item.label)
                            return (
                              <button
                                key={item.label}
                                onClick={() => {
                                  toggleEmotion(item)
                                  setActiveEmotion(item)
                                  setIsOpen(false)
                                }}
                                onMouseEnter={() => setActiveEmotion(item)}
                                className={`flex items-center gap-2 rounded-[22px] px-3 py-2 text-xs font-semibold shadow-sm transition-transform ${
                                  isSelected ? 'ring-2 ring-foreground' : ''
                                } ${styles.text}`}
                                style={{
                                  background: styles.background,
                                  border: styles.border,
                                  borderRadius: hashToShape(item.shapeId),
                                }}
                              >
                                {item.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-border/60 bg-muted/30 p-6">
                <div className="text-sm font-semibold">Definition</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {activeEmotion ? activeEmotion.definition : 'Hover a bubble to see details.'}
                </div>
                <div className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Selected
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.length === 0 && (
                    <span className="text-xs text-muted-foreground">None yet</span>
                  )}
                  {selected.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-border/70 px-3 py-1 text-xs"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <button
            className="absolute inset-0 -z-10"
            onClick={() => setIsOpen(false)}
            aria-label="Close emotions overlay"
          />
        </div>
      )}
    </div>
  )
}
