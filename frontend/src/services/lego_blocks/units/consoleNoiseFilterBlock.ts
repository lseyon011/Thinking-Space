const STORAGE_KEY = 'ltm-show-console-warnings'
const STORAGE_EVENT = 'ltm-show-console-warnings:changed'

type LevelKey = 'log' | 'info' | 'warn' | 'debug'
const FILTERED_LEVELS: LevelKey[] = ['log', 'info', 'warn', 'debug']

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
}
