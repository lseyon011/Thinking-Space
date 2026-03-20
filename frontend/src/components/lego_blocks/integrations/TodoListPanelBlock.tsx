import { useCallback, useEffect, useState } from 'react'
import { FileText, ListChecks } from 'lucide-react'
import { getTodoFile, getTodosMonth, getTodosSectionMonth } from '@/services/orchestrators/todosOrch'
import { invokeCapabilityOrThrow } from '@/services/orchestrators/capabilityRouterOrch'
import { useMarkdownViewer } from '@/components/orchestrators/MarkdownViewerOrch'
import type { CapabilityActor } from '@/services/lego_blocks/integrations/capabilityRegistryBlock'

export interface TodoDisplayItem {
  text: string
  checked: boolean
  line: number
  file: string
}

export interface TodoDayGroup {
  date: string
  items: TodoDisplayItem[]
}

const TODOS_ACTOR: CapabilityActor = { kind: 'human', id: 'ui.todos-panel' }

const SECTION_COLORS: Record<string, { accent: string; dot: string }> = {
  Webull: { accent: '#3b82f6', dot: 'bg-blue-500' },
  sfdl: { accent: '#10b981', dot: 'bg-emerald-500' },
  sfw: { accent: '#eab308', dot: 'bg-yellow-500' },
  sfj: { accent: '#f97316', dot: 'bg-orange-500' },
  sfai: { accent: '#a855f7', dot: 'bg-purple-500' },
  sflc: { accent: '#ef4444', dot: 'bg-red-500' },
}
const DEFAULT_COLOR = { accent: '#8b5cf6', dot: 'bg-violet-500' }

export function getSectionColorBlock(section: string) {
  return SECTION_COLORS[section] ?? DEFAULT_COLOR
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function toggleInDays(days: TodoDayGroup[], target: TodoDisplayItem): TodoDayGroup[] {
  return days.map((day) => ({
    ...day,
    items: day.items.map((item) =>
      item.file === target.file && item.line === target.line
        ? { ...item, checked: !item.checked }
        : item,
    ),
  }))
}

interface TodoListPanelBlockProps {
  section?: string
  filePath?: string
  /**
   * Pre-fetched days. When provided the block is a pure display — no internal fetch.
   * The caller is responsible for optimistic toggle state (via onToggle).
   * When omitted, the block fetches the current month internally.
   */
  days?: TodoDayGroup[]
  loading?: boolean
  availableSections?: string[]
  onSelectSection?: (section: string) => void
  /**
   * Called when a checkbox is toggled.
   * - External data mode (days provided): caller handles optimistic update; this persists.
   * - Internal fetch mode (days omitted): block handles optimistic update; this persists.
   */
  onToggle?: (item: TodoDisplayItem) => Promise<void>
  editMode?: boolean
  showStats?: boolean
  fileStats?: Record<string, { lines: number; words: number }>
}

export default function TodoListPanelBlock({
  section,
  filePath,
  days: propDays,
  loading: propLoading,
  availableSections: propAvailableSections,
  onSelectSection,
  onToggle,
  editMode,
  showStats,
  fileStats,
}: TodoListPanelBlockProps) {
  const { openFile } = useMarkdownViewer()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // Internal state — only used when propDays is not provided
  const [internalAvailableSections, setInternalAvailableSections] = useState<string[]>([])
  const [internalDays, setInternalDays] = useState<TodoDayGroup[]>([])
  const [internalSection, setInternalSection] = useState<string | null>(null)
  const [internalLoading, setInternalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isExternalData = propDays !== undefined

  useEffect(() => {
    if (isExternalData) return
    let cancelled = false
    setInternalLoading(true)
    setError(null)
    setInternalDays([])
    setInternalAvailableSections([])
    setInternalSection(null)

    if (filePath) {
      getTodoFile(filePath)
        .then((fileData) => {
          if (cancelled) return
          setInternalSection(fileData.section)
          setInternalAvailableSections(fileData.section ? [fileData.section] : [])
          setInternalDays(fileData.items.length > 0 ? [{ date: fileData.date, items: fileData.items }] : [])
        })
        .catch((err) => {
          if (!cancelled) setError((err as Error).message || 'Failed to load todo note')
        })
        .finally(() => {
          if (!cancelled) setInternalLoading(false)
        })
      return () => { cancelled = true }
    }

    getTodosMonth(year, month)
      .then((monthData) => {
        if (cancelled) return
        const names = monthData.sections.map((s) => s.name)
        setInternalAvailableSections(names)
        const sectionsToLoad = section ? [section] : names
        if (sectionsToLoad.length === 0) {
          setInternalLoading(false)
          return null
        }
        return getTodosSectionMonth(year, month, sectionsToLoad)
      })
      .then((data) => {
        if (cancelled || !data) return
        const days = data.days
          .map((day) => ({
            date: day.date,
            items: day.items.filter(
              (item) => !section || (item as { section?: string }).section === section,
            ),
          }))
          .filter((day) => day.items.length > 0)
        setInternalDays(days)
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message || 'Failed to load todos')
      })
      .finally(() => {
        if (!cancelled) setInternalLoading(false)
      })

    return () => { cancelled = true }
  }, [filePath, isExternalData, year, month, section])

  const days = isExternalData ? propDays : internalDays
  const loading = propLoading ?? internalLoading
  const availableSections = propAvailableSections ?? internalAvailableSections
  const resolvedSection = section?.trim() || internalSection || undefined

  const handleToggle = useCallback(
    async (item: TodoDisplayItem) => {
      if (!isExternalData) {
        // Internal mode: optimistic update on our own state
        setInternalDays((prev) => toggleInDays(prev, item))
      }
      try {
        if (onToggle) {
          await onToggle(item)
        } else {
          await invokeCapabilityOrThrow({
            capability: 'todos.toggle',
            input: { filePath: item.file, lineNumber: item.line },
            actor: TODOS_ACTOR,
          })
        }
      } catch {
        if (!isExternalData) {
          // Revert optimistic update
          setInternalDays((prev) => toggleInDays(prev, item))
        }
      }
    },
    [isExternalData, onToggle],
  )

  if (loading) {
    return (
      <div className="space-y-3 p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-muted/40" />
        ))}
      </div>
    )
  }

  if (error) {
    return <div className="p-1 text-xs text-destructive">{error}</div>
  }

  if (!resolvedSection && !filePath) {
    if (availableSections.length === 0) {
      return (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No todo sections found for this month.
        </div>
      )
    }
    return (
      <div className="p-1 space-y-1">
        <p className="text-xs text-muted-foreground mb-2">Choose a to-do list:</p>
        {availableSections.map((s) => {
          const color = getSectionColorBlock(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => onSelectSection?.(s)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
            >
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${color.dot}`} />
              <span className="font-medium text-foreground/80">{s}</span>
              <ListChecks className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
            </button>
          )
        })}
      </div>
    )
  }

  const color = getSectionColorBlock(resolvedSection ?? 'Other')

  return (
    <div className="space-y-2">
      {/* Section switcher in edit mode */}
      {editMode && !filePath && availableSections.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-xs text-muted-foreground mb-1">Switch section:</p>
          {availableSections.map((s) => {
            const c = getSectionColorBlock(s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSelectSection?.(s)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                  s === section ? 'bg-muted font-semibold' : 'hover:bg-muted/60'
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
                <span className="text-foreground/80">{s}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${color.dot}`} />
        <span className="text-sm font-semibold text-foreground/80">{resolvedSection ?? 'To-Dos'}</span>
      </div>

      {days.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground pl-4">
          No todos for <span className="font-medium">{resolvedSection ?? 'this list'}</span>.
        </div>
      ) : (
        <div className="space-y-3 pl-4">
          {days.map(({ date, items }) => {
            const stat = showStats && items[0] ? fileStats?.[items[0].file] : null
            return (
              <div key={date}>
                <div className="text-xs text-muted-foreground mb-1">{formatDate(date)}</div>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <div
                      key={`${item.file}:${item.line}`}
                      className="flex items-start gap-2 py-0.5 group"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => void handleToggle(item)}
                        className="mt-0.5 h-4 w-4 rounded border-border shrink-0 cursor-pointer"
                        style={{ accentColor: color.accent }}
                      />
                      <button
                        onClick={() => openFile(item.file)}
                        className="flex items-center gap-1.5 flex-1 min-w-0 text-left cursor-pointer"
                        title="View file"
                      >
                        <span
                          className={`text-sm leading-snug transition-all ${
                            item.checked
                              ? 'line-through text-muted-foreground/50'
                              : 'text-foreground/90 group-hover:text-foreground'
                          }`}
                        >
                          {item.text}
                        </span>
                        <FileText className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                      </button>
                    </div>
                  ))}
                </div>
                {stat && (
                  <div className="mt-1 text-[10px] text-muted-foreground/50 tabular-nums pl-6">
                    {stat.lines} lines · {stat.words} words
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
