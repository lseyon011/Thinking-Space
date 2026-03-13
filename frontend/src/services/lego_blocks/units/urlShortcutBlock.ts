/**
 * Parse and serialize `.url` shortcut files (standard INI-based format).
 *
 *   [InternetShortcut]
 *   URL=https://example.com
 */

export function isUrlShortcutPathBlock(path: string): boolean {
  return /\.url$/i.test(path)
}

export function parseUrlShortcutBlock(content: string): { url: string } | null {
  const match = content.match(/^\s*URL\s*=\s*(.+)/mi)
  if (!match) return null
  const url = match[1].trim()
  if (!isValidHttpUrlBlock(url)) return null
  return { url }
}

export function serializeUrlShortcutBlock(url: string): string {
  return `[InternetShortcut]\nURL=${url}\n`
}

export function isValidHttpUrlBlock(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function domainFromUrlBlock(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'link'
  }
}
