const STORAGE_KEY = 'ltm-show-console-warnings'
const STORAGE_EVENT = 'ltm-show-console-warnings:changed'

type LevelKey = 'log' | 'info' | 'warn' | 'debug'
const FILTERED_LEVELS: LevelKey[] = ['log', 'info', 'warn', 'debug']

// recharts (and a few other libs) route library-warnings through the
// `warning` npm package, which lands on `console.error`/`console.warn` even
// though the content is a development warning, not a real error. We don't want
// to blanket-mute those channels — real errors must always show — so we
// targeted-mute only known noisy patterns when the toggle is off.
//
// Note the `-?\d+`: recharts reports the bad size as `width(-1)`/`height(-1)`
// when the container is measured at zero, so the pattern MUST allow a leading
// minus or it silently fails to match the very message it's meant to catch.
const LIBRARY_NOISE_PATTERNS: RegExp[] = [
  /The width\(-?\d+\) and height\(-?\d+\) of chart should be greater than 0/,
]

/** True when a formatted console message is known library dev-noise that should
 *  be hidden while the "show console warnings" toggle is off. Shared by the
 *  native-console filter here and the in-app debug-panel intercept. */
export function isLibraryConsoleNoiseBlock(text: string): boolean {
  return !!text && LIBRARY_NOISE_PATTERNS.some(re => re.test(text))
}

let installed = false

function readFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function isConsoleWarningsVisible(): boolean {
  return readFlag()
}

export function setConsoleWarningsVisible(visible: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, visible ? 'true' : 'false')
  } catch {
    // localStorage unavailable; nothing to persist
  }
  try {
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: visible }))
  } catch {
    // Custom events unsupported; toggle still applies on next read
  }
}

export function subscribeConsoleWarningsVisible(listener: (visible: boolean) => void): () => void {
  const handler = () => listener(readFlag())
  window.addEventListener(STORAGE_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(STORAGE_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

export function installConsoleNoiseFilterBlock(): void {
  if (installed) return
  installed = true
  for (const level of FILTERED_LEVELS) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      if (readFlag()) original(...args)
    }
  }
  // Pattern-targeted console.error filter — only drops known library-warning
  // noise (e.g. recharts width/height), never real errors.
  const originalError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    if (!readFlag()) {
      const first = args[0]
      const text = typeof first === 'string'
        ? first
        : first instanceof Error ? first.message : ''
      if (isLibraryConsoleNoiseBlock(text)) return
    }
    originalError(...args)
  }
}
