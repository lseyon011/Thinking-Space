/**
 * Lightweight client-side performance tracing.
 *
 * Disabled by default. Enable by either:
 *   - setting `localStorage.setItem('thinkspc.perfTrace', '1')` (persists),
 *   - or appending `?perfTrace=1` to the URL (one session),
 *   - or in DevTools console: `window.__thinkspc_perfTrace = true`.
 *
 * Logs nothing while disabled — safe to leave call sites in production paths.
 *
 * Three primitives:
 *   - perfMark(label): start a timer.
 *   - perfReport(label, lines): pretty-print a measurement block.
 *   - measureSettleMs(start): resolves when the DOM + Web Animations API
 *     have been quiet for `quietFrames` consecutive rAF frames, so callers
 *     can measure time-to-visually-stable, not just time-to-first-paint.
 */

const STORAGE_KEY = 'thinkspc.perfTrace'
const URL_PARAM = 'perfTrace'
const WINDOW_FLAG = '__thinkspc_perfTrace'

declare global {
  interface Window {
    __thinkspc_perfTrace?: boolean
  }
}

function readEnabled(): boolean {
  if (typeof window === 'undefined') return false
  if (window.__thinkspc_perfTrace === true) return true
  try {
    if (new URLSearchParams(window.location.search).has(URL_PARAM)) return true
  } catch {
    /* ignore */
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// Cached at module load so call sites don't pay for every check, but allow
// runtime opt-in via the window flag (re-checked each call so DevTools toggle
// works without a reload).
let cachedEnabled = readEnabled()

export function perfTraceEnabled(): boolean {
  if (typeof window !== 'undefined' && window.__thinkspc_perfTrace === true) return true
  return cachedEnabled
}

/** Force-refresh the cached flag — call after toggling localStorage at runtime. */
export function refreshPerfTraceEnabled(): void {
  cachedEnabled = readEnabled()
}

export interface PerfMark {
  label: string
  startedAt: number
}

export function perfMark(label: string): PerfMark {
  return { label, startedAt: performance.now() }
}

/** Pretty-print a labeled block of measurements. Right-aligns the durations. */
export function perfReport(label: string, lines: Record<string, number | string>): void {
  if (!perfTraceEnabled()) return
  const entries = Object.entries(lines)
  const keyWidth = Math.max(0, ...entries.map(([k]) => k.length))
  const body = entries
    .map(([k, v]) => {
      const right = typeof v === 'number' ? `${v.toFixed(1)}ms` : v
      return `  ${k.padEnd(keyWidth)}  ${right}`
    })
    .join('\n')
  // eslint-disable-next-line no-console
  console.log(`[perf] ${label}\n${body}`)
}

export interface MeasureSettleOptions {
  /** Element to watch for mutations. Defaults to document.body. */
  root?: Element
  /** Cap so a runaway animation doesn't hold the trace open. */
  maxWaitMs?: number
  /** Consecutive quiet rAF frames before declaring "settled". */
  quietFrames?: number
}

export interface SettleResult {
  elapsedMs: number
  /** True if maxWaitMs was hit — the page never went quiet. */
  cappedOut: boolean
  /** Total mutation records observed. */
  mutationCount: number
  /** Top mutation targets by count: short descriptor → count. */
  topMutators: Array<{ target: string; count: number; kinds: string }>
  /** Mutation count grouped by surface ancestor (helps spot background
   * persistent surfaces still doing work). */
  byAncestor: Array<{ ancestor: string; count: number }>
}

/** Compact, human-readable identifier for a mutated node — enough to find it
 * in the React tree without dumping the whole DOM path. */
function describeNode(node: Node | null): string {
  if (!node) return '#null'
  if (node.nodeType === Node.TEXT_NODE) {
    return describeNode(node.parentNode) + '·text'
  }
  if (!(node instanceof Element)) return `#${node.nodeName.toLowerCase()}`
  const id = node.id ? `#${node.id}` : ''
  const cls = node.className && typeof node.className === 'string'
    ? '.' + node.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')
    : ''
  const data = Array.from(node.attributes)
    .find(a => a.name.startsWith('data-') && a.value)
  const tag = node.tagName.toLowerCase()
  const dataTag = data ? `[${data.name}="${data.value.slice(0, 20)}"]` : ''
  return `${tag}${id}${cls}${dataTag}`
}

/** Walk up ancestors looking for a `[key="…surface:…"]` React key — those are
 * the persistent-surface wrappers in App.tsx. Helps attribute mutations to
 * the *surface* responsible, even when that surface is hidden in the
 * background. Returns a short descriptor or `null`. */
function describeSurfaceAncestor(node: Node | null): string | null {
  let el: Node | null = node
  while (el && !(el instanceof Element)) el = el.parentNode
  while (el instanceof Element) {
    const cls = el.className && typeof el.className === 'string' ? el.className : ''
    if (cls.includes('ltm-shell-content-stage')) return 'route:non-persistent'
    const dataKeys = Array.from(el.attributes ?? []).filter(a =>
      a.name.startsWith('data-') && /surface|route|tab/i.test(a.name),
    )
    if (dataKeys.length > 0) {
      return dataKeys.map(a => `${a.name}=${a.value.slice(0, 24)}`).join(' ')
    }
    el = el.parentElement
  }
  return null
}

/**
 * Resolves with elapsed ms since `start` once the DOM + active Web Animations
 * have been quiet for `quietFrames` frames. Useful to capture time-to-stable
 * after CSS animations on a route transition finish playing.
 */
export function measureSettleMs(
  start: number,
  opts: MeasureSettleOptions = {},
): Promise<SettleResult> {
  const root = opts.root ?? (typeof document !== 'undefined' ? document.body : null)
  const maxWait = opts.maxWaitMs ?? 2000
  const quietFrames = opts.quietFrames ?? 4

  if (!root || typeof requestAnimationFrame === 'undefined') {
    return Promise.resolve({
      elapsedMs: performance.now() - start,
      cappedOut: false,
      mutationCount: 0,
      topMutators: [],
      byAncestor: [],
    })
  }

  return new Promise<SettleResult>(resolve => {
    let lastMutationAt = performance.now()
    let mutationCount = 0
    const mutationsByTarget = new Map<string, { count: number; kinds: Set<string> }>()
    const mutationsByAncestor = new Map<string, number>()
    const observer = new MutationObserver(records => {
      lastMutationAt = performance.now()
      for (const r of records) {
        mutationCount += 1
        const key = describeNode(r.target)
        const entry = mutationsByTarget.get(key) ?? { count: 0, kinds: new Set<string>() }
        entry.count += 1
        // Include the attribute name for attribute changes — most useful clue.
        const kind = r.type === 'attributes' ? `attr:${r.attributeName ?? '?'}` : r.type
        entry.kinds.add(kind)
        mutationsByTarget.set(key, entry)
        const ancestor = describeSurfaceAncestor(r.target) ?? 'unknown'
        mutationsByAncestor.set(ancestor, (mutationsByAncestor.get(ancestor) ?? 0) + 1)
      }
    })
    observer.observe(root, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    })

    const FRAME_MS = 1000 / 60
    let quietStreak = 0

    const finishWith = (elapsedMs: number, cappedOut: boolean) => {
      const topMutators = Array.from(mutationsByTarget.entries())
        .map(([target, v]) => ({ target, count: v.count, kinds: Array.from(v.kinds).join(',') }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
      const byAncestor = Array.from(mutationsByAncestor.entries())
        .map(([ancestor, count]) => ({ ancestor, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
      observer.disconnect()
      resolve({ elapsedMs, cappedOut, mutationCount, topMutators, byAncestor })
    }

    const tick = () => {
      const now = performance.now()
      const elapsed = now - start
      if (elapsed >= maxWait) {
        finishWith(elapsed, true)
        return
      }

      const sinceMutation = now - lastMutationAt
      const getAnimations = (document as Document & { getAnimations?: () => Animation[] })
        .getAnimations
      // Ignore infinite animations (e.g. Tailwind animate-spin loading
      // spinners). They never "finish" so they'd pin settle time at the
      // maxWait cap forever and obscure the real transition cost.
      const runningAnimations =
        typeof getAnimations === 'function'
          ? getAnimations.call(document).filter(a => {
              if (a.playState !== 'running') return false
              const effect = a.effect
              if (!effect || typeof effect.getComputedTiming !== 'function') return true
              const timing = effect.getComputedTiming()
              return timing.iterations !== Infinity
            }).length
          : 0

      if (runningAnimations === 0 && sinceMutation >= FRAME_MS) {
        quietStreak += 1
        if (quietStreak >= quietFrames) {
          finishWith(elapsed, false)
          return
        }
      } else {
        quietStreak = 0
      }

      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  })
}

/**
 * Pair this with measureSettleMs after a state change to get a paint-and-settle
 * measurement in one call. Returns { paintMs, settleMs } where paintMs is the
 * first post-commit rAF and settleMs is when the DOM/animations went quiet.
 */
export function measureFrameAndSettle(
  commitAt: number,
  opts: MeasureSettleOptions = {},
): Promise<{
  paintMs: number
  settleMs: number
  settleCapped: boolean
  mutationCount: number
  topMutators: SettleResult['topMutators']
  byAncestor: SettleResult['byAncestor']
}> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const paintMs = performance.now() - commitAt
        void measureSettleMs(commitAt, opts).then(result => {
          resolve({
            paintMs,
            settleMs: result.elapsedMs,
            settleCapped: result.cappedOut,
            mutationCount: result.mutationCount,
            topMutators: result.topMutators,
            byAncestor: result.byAncestor,
          })
        })
      })
    })
  })
}

/** Log on boot if tracing is on, so it's obvious the build has it wired. */
export function logPerfTraceBootBanner(): void {
  if (!perfTraceEnabled()) return
  // eslint-disable-next-line no-console
  console.log(
    `[perf] tracing enabled — toggle off with: localStorage.removeItem('${STORAGE_KEY}'); location.reload()`,
  )
}
