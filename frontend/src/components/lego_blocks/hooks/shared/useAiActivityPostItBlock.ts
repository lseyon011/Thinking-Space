import { useCallback, useEffect, useMemo, useRef } from 'react'
import type {
  CanvasPostItTile,
  CanvasTile,
} from '@/components/lego_blocks/hooks/shared/useCanvasTilesBlock'
import type { ActivityChain } from '@/services/lego_blocks/units/aiActivityParserBlock'
import { getAiActivityHomePostItEnabled } from '@/services/lego_blocks/units/storageKeyBlock'

/**
 * Auto-drafts the "what I did today" post-it on the home canvas.
 *
 * Behavior:
 *  - Finds an existing post-it with `autoActivityState.date === today` (the
 *    daily marker), or spawns one if none exists.
 *  - Diffs current today-chains against `seenChainKeys` and appends only new
 *    chains to the post-it body. Existing text the user has typed/edited is
 *    left untouched — we only append below.
 *  - Day rollover: previous days' auto post-its are not touched. They stay as
 *    regular post-its (just with the `autoActivityState` marker showing what
 *    day they originally tracked).
 */

const POSTIT_DEFAULT_POS = { x: 980, y: 1200, w: 380, h: 420 }
const HEADER_PREFIX = '☀ AI activity — '

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const suffix = h < 12 ? 'am' : 'pm'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

function fmtSpan(startIso: string, endIso: string): string {
  const a = fmtTime(startIso)
  const b = fmtTime(endIso)
  return a === b ? a : `${a}–${b}`
}

function isoDayLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function chainBullet(c: ActivityChain): string {
  return `${fmtSpan(c.startedIso, c.endedIso)} · ${c.project} · ${c.msgCount} msgs — ${c.topic}`
}

function initialHeader(date: string): string {
  return `${HEADER_PREFIX}${date}\n(auto — edit freely; new chains append below)\n`
}

function nextTileId(): string {
  return `tile-auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

interface UseAiActivityPostItOptions {
  tiles: CanvasTile[]
  todayChains: ActivityChain[]
  /** Skip work until parsed activity has loaded once. */
  ready: boolean
  /** Skip work until canvas tiles have been hydrated from storage. */
  canvasLoaded: boolean
  setAllTiles: (next: CanvasTile[]) => void
}

export function useAiActivityPostItBlock(opts: UseAiActivityPostItOptions): void {
  const { tiles, todayChains, ready, canvasLoaded, setAllTiles } = opts
  const today = useMemo(() => isoDayLocal(new Date()), [])

  // Re-run when the set of chain keys for today changes — not on every tile
  // tick (which would loop with our own setAllTiles call).
  const chainKeySignature = todayChains.map(c => c.key).join('|')

  // Latest tiles via ref so the effect can read fresh state without depending
  // on `tiles` (which would cause it to fire on every tile move).
  const tilesRef = useRef<CanvasTile[]>(tiles)
  tilesRef.current = tiles

  const applyDailyDraft = useCallback(() => {
    if (!ready || !canvasLoaded) return
    // Opt-in: the This Week digest covers the same ground, so the auto post-it
    // only drafts when the user has explicitly enabled it in settings.
    if (!getAiActivityHomePostItEnabled()) return
    const current = tilesRef.current
    const existing = current.find(
      (t): t is CanvasPostItTile =>
        t.type === 'post-it' && t.autoActivityState?.date === today,
    )

    // Stable chronological order (oldest first) so new chains land at the bottom.
    const chronological = [...todayChains].sort(
      (a, b) => Date.parse(a.startedIso) - Date.parse(b.startedIso),
    )

    if (!existing) {
      if (chronological.length === 0) return // nothing to draft yet today
      const body =
        initialHeader(today) +
        '\n' +
        chronological.map(c => `• ${chainBullet(c)}`).join('\n')
      const newTile: CanvasPostItTile = {
        id: nextTileId(),
        type: 'post-it',
        x: POSTIT_DEFAULT_POS.x,
        y: POSTIT_DEFAULT_POS.y,
        w: POSTIT_DEFAULT_POS.w,
        h: POSTIT_DEFAULT_POS.h,
        text: body,
        color: 'blue',
        locked: false,
        autoActivityState: {
          date: today,
          seenChainKeys: chronological.map(c => c.key),
        },
      }
      setAllTiles([...current, newTile])
      return
    }

    const seen = new Set(existing.autoActivityState?.seenChainKeys ?? [])
    const newChains = chronological.filter(c => !seen.has(c.key))
    if (newChains.length === 0) return

    const appended =
      existing.text.replace(/\s+$/, '') +
      '\n' +
      newChains.map(c => `• ${chainBullet(c)}`).join('\n')

    const updated: CanvasPostItTile = {
      ...existing,
      text: appended,
      autoActivityState: {
        date: today,
        seenChainKeys: [...(existing.autoActivityState?.seenChainKeys ?? []), ...newChains.map(c => c.key)],
      },
    }
    setAllTiles(current.map(t => (t.id === existing.id ? updated : t)))
  }, [ready, canvasLoaded, today, todayChains, setAllTiles])

  // Apply on every change to today's chain set.
  useEffect(() => {
    applyDailyDraft()
    // chainKeySignature triggers; applyDailyDraft is stable enough via its own deps.
  }, [applyDailyDraft, chainKeySignature])
}
