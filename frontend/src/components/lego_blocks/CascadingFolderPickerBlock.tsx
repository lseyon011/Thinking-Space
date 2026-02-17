import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/lego_blocks/ui/select'
import { listChildFolders } from '@/services/orchestrators/fileSystemOrch'

// ── Simple in-memory cache for folder children ──

const CACHE_TTL_MS = 5 * 60 * 1000
const SESSION_PREFIX = 'ltm-folder-children:'
const childrenCache = new Map<string, { ts: number; data: string[] }>()
const inFlight = new Map<string, Promise<string[]>>()

function getCachedChildren(path: string): string[] | null {
  const entry = childrenCache.get(path)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    childrenCache.delete(path)
    return null
  }
  return entry.data
}

function getSessionChildren(path: string): string[] | null {
  try {
    const raw = sessionStorage.getItem(`${SESSION_PREFIX}${path}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { ts: number; data: string[] }
    if (!parsed || !Array.isArray(parsed.data)) return null
    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(`${SESSION_PREFIX}${path}`)
      return null
    }
    // Warm in-memory cache for faster future access
    childrenCache.set(path, { ts: parsed.ts, data: parsed.data })
    return parsed.data
  } catch {
    return null
  }
}

function setSessionChildren(path: string, data: string[]) {
  try {
    sessionStorage.setItem(
      `${SESSION_PREFIX}${path}`,
      JSON.stringify({ ts: Date.now(), data }),
    )
  } catch {
    // ignore storage failures
  }
}

// ── Recents helper (exported so pages can call it on save) ──

export function addRecent(
  storageKey: string,
  segments: string[],
  max: number = 10,
) {
  const raw = localStorage.getItem(storageKey)
  let recents: string[][] = raw ? JSON.parse(raw) : []
  const path = segments.join('/')
  recents = recents.filter(r => r.join('/') !== path)
  recents.unshift(segments)
  if (recents.length > max) recents = recents.slice(0, max)
  localStorage.setItem(storageKey, JSON.stringify(recents))
  // StorageEvent doesn't fire in the same tab, so dispatch a custom one
  window.dispatchEvent(new CustomEvent('folder-recents-updated', { detail: storageKey }))
}

// ── Types ──

interface Level {
  options: string[]
  selected: string | null
  loading: boolean
}

interface CascadingFolderPickerProps {
  defaultPath?: string[]
  onChange: (segments: string[], fullPath: string) => void
  storageKey?: string
  maxRecents?: number
}

// ── Component ──

export default function CascadingFolderPicker({
  defaultPath,
  onChange,
  storageKey = 'ltm-folder-recents',
  maxRecents = 10,
}: CascadingFolderPickerProps) {
  const [levels, setLevels] = useState<Level[]>([])
  const [recents, setRecents] = useState<string[][]>([])
  // Whether the last selected level has children (for "go deeper" button)
  const [hasChildren, setHasChildren] = useState(false)
  // Whether the user has clicked "go deeper" to expand the next level
  const [expanded, setExpanded] = useState(false)

  // Load recents from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      try {
        setRecents(JSON.parse(raw))
      } catch {
        // ignore bad data
      }
    }
  }, [storageKey])

  const refreshRecents = useCallback(() => {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      try {
        setRecents(JSON.parse(raw))
      } catch {
        // ignore
      }
    }
  }, [storageKey])

  const fetchChildren = useCallback(async (path: string): Promise<string[]> => {
    const cached = getCachedChildren(path)
    if (cached) return cached
    const sessionCached = getSessionChildren(path)
    if (sessionCached) return sessionCached
    const inFlightReq = inFlight.get(path)
    if (inFlightReq) return inFlightReq

    const req = listChildFolders(path)
      .then(files => {
        childrenCache.set(path, { ts: Date.now(), data: files })
        setSessionChildren(path, files)
        return files
      })
      .catch(() => [] as string[])
      .finally(() => {
        inFlight.delete(path)
      })

    inFlight.set(path, req)
    return req
  }, [])

  const getSegments = useCallback(
    (lvls: Level[]) => lvls.filter(l => l.selected).map(l => l.selected!),
    [],
  )

  const notifyChange = useCallback(
    (lvls: Level[]) => {
      const segs = lvls.filter(l => l.selected).map(l => l.selected!)
      onChange(segs, segs.join('/'))
    },
    [onChange],
  )

  // Initialize: fetch root + auto-select defaultPath
  useEffect(() => {
    let cancelled = false

    async function init() {
      const cachedRoot = getCachedChildren('')
      if (cachedRoot) {
        setLevels([{ options: cachedRoot, selected: null, loading: false }])
      }

      const rootChildren = await fetchChildren('')
      if (cancelled) return

      const newLevels: Level[] = [
        { options: rootChildren, selected: null, loading: false },
      ]

      if (defaultPath && defaultPath.length > 0) {
        for (let i = 0; i < defaultPath.length; i++) {
          const seg = defaultPath[i]
          if (!newLevels[i].options.includes(seg)) break
          newLevels[i].selected = seg

          const pathSoFar = defaultPath.slice(0, i + 1).join('/')
          const children = await fetchChildren(pathSoFar)
          if (cancelled) return

          if (children.length > 0 && i < defaultPath.length - 1) {
            // Only auto-expand if there are more segments to follow
            newLevels.push({ options: children, selected: null, loading: false })
          } else {
            // At the last segment, just track whether children exist
            setHasChildren(children.length > 0)
          }
        }
      }

      setLevels(newLevels)
      setExpanded(false)
      const segs = newLevels.filter(l => l.selected).map(l => l.selected!)
      if (segs.length > 0) {
        onChange(segs, segs.join('/'))
      }
    }

    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle selecting a value at a given level
  const handleSelect = useCallback(
    async (levelIndex: number, value: string) => {
      let pathSegments: string[] = []
      setLevels(prev => {
        // Keep only levels up to this one, set selection
        const updated = prev.slice(0, levelIndex + 1).map((l, i) => {
          if (i === levelIndex) return { ...l, selected: value }
          return l
        })
        pathSegments = updated.filter(l => l.selected).map(l => l.selected!)
        return updated
      })
      setExpanded(false)
      setHasChildren(false)

      // Check if this folder has children
      const children = await fetchChildren(pathSegments.join('/'))
      setHasChildren(children.length > 0)

      // Notify parent immediately - the selected path is valid now
      setLevels(prev => {
        const updated = prev.slice(0, levelIndex + 1).map((l, i) => {
          if (i === levelIndex) return { ...l, selected: value }
          return l
        })
        notifyChange(updated)
        return updated
      })
    },
    [fetchChildren, notifyChange],
  )

  // User clicked "go deeper" - load and show the next dropdown
  const handleExpand = useCallback(async () => {
    const segs = getSegments(levels)
    if (segs.length === 0) return

    setExpanded(true)
    const children = await fetchChildren(segs.join('/'))
    if (children.length > 0) {
      setLevels(prev => [
        ...prev,
        { options: children, selected: null, loading: false },
      ])
    }
  }, [levels, getSegments, fetchChildren])

  // Apply a recent path
  const applyRecent = useCallback(
    async (segments: string[]) => {
      const rootChildren = await fetchChildren('')
      const newLevels: Level[] = [
        { options: rootChildren, selected: null, loading: false },
      ]

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        if (!newLevels[i] || !newLevels[i].options.includes(seg)) break
        newLevels[i].selected = seg

        const pathSoFar = segments.slice(0, i + 1).join('/')
        const children = await fetchChildren(pathSoFar)
        if (children.length > 0 && i < segments.length - 1) {
          newLevels.push({ options: children, selected: null, loading: false })
        } else {
          setHasChildren(children.length > 0)
        }
      }

      setLevels(newLevels)
      setExpanded(false)
      const segs = newLevels.filter(l => l.selected).map(l => l.selected!)
      onChange(segs, segs.join('/'))
    },
    [fetchChildren, onChange],
  )

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) refreshRecents()
    }
    const onCustom = (e: Event) => {
      if ((e as CustomEvent).detail === storageKey) refreshRecents()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('folder-recents-updated', onCustom)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('folder-recents-updated', onCustom)
    }
  }, [storageKey, refreshRecents])

  const selectedSegments = getSegments(levels)
  const fullPath = selectedSegments.join('/')
  // Show "go deeper" when the last selected level has children and user hasn't expanded yet
  const lastLevelHasSelection = levels.length > 0 && levels[levels.length - 1].selected !== null
  const showGoDeeper = hasChildren && lastLevelHasSelection && !expanded

  return (
    <div className="space-y-3">
      {/* Cascading dropdowns - stacked vertically for sidebar */}
      <div className="space-y-2">
        {levels.map((level, index) => {
          if (!level.loading && level.options.length === 0) return null
          return (
            <div key={index}>
              {level.loading ? (
                <div className="flex h-10 w-full items-center justify-center rounded-lg border border-input">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Select
                  value={level.selected || ''}
                  onValueChange={(val) => handleSelect(index, val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={index === 0 ? 'Select folder...' : 'Select subfolder...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {level.options.map(opt => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )
        })}

        {/* Go deeper button */}
        {showGoDeeper && (
          <button
            onClick={handleExpand}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-3 w-3" />
            Go deeper
          </button>
        )}
      </div>

      {/* Resolved path */}
      {fullPath && (
        <p className="text-xs text-muted-foreground/70 break-all">
          {fullPath}
        </p>
      )}

      {/* Recent destinations - below dropdowns */}
      {recents.length > 0 && (
        <div className="space-y-1.5 border-t border-border/40 pt-3">
          <label className="text-xs text-muted-foreground">Recent</label>
          <div className="flex flex-col gap-1.5">
            {recents.slice(0, maxRecents).map((segs, i) => (
              <button
                key={i}
                onClick={() => applyRecent(segs)}
                className="text-left rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors break-words"
              >
                {segs.join(' / ')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
