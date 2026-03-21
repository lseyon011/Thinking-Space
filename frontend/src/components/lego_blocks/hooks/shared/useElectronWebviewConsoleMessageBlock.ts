import { type RefObject, useEffect, useMemo } from 'react'
import { dispatchDebugLogBlock, type DebugLogLevel } from '@/services/lego_blocks/units/debugLogBlock'

interface ElectronWebviewConsoleMessageEventBlock {
  level?: number
  message?: unknown
  line?: number
  sourceId?: unknown
}

interface UseElectronWebviewConsoleMessageBlockParams {
  enabled: boolean
  webviewRef: RefObject<HTMLElement | null>
  resolvedUrl?: string | null
  minLevel?: number
}

function getConsoleLevelBlock(level: number): DebugLogLevel | null {
  if (level >= 3) return 'error'
  if (level >= 2) return 'warn'
  return null
}

function shouldDowngradeWebviewConsoleNoiseBlock(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('permissions-policy header')
    || normalized.includes("unrecognized feature: 'pointer-lock'")
    || normalized.includes('react-i18next:: usetranslation')
    || (normalized.includes('violates the following content security policy directive')
      && (
        normalized.includes('appsflyer')
        || normalized.includes('onelink')
      ))
}

function normalizeWebviewConsoleLevelBlock(level: DebugLogLevel, message: string): DebugLogLevel {
  if ((level === 'warn' || level === 'error') && shouldDowngradeWebviewConsoleNoiseBlock(message)) {
    return 'info'
  }
  return level
}

function buildConsoleDetailsBlock(
  event: ElectronWebviewConsoleMessageEventBlock | null,
  resolvedUrl?: string | null,
): string | undefined {
  const details: string[] = []
  if (resolvedUrl) details.push(`URL: ${resolvedUrl}`)
  if (typeof event?.sourceId === 'string' && event.sourceId.trim()) {
    details.push(`Source: ${event.sourceId}`)
  }
  if (typeof event?.line === 'number' && Number.isFinite(event.line) && event.line > 0) {
    details.push(`Line: ${event.line}`)
  }
  return details.length > 0 ? details.join('\n') : undefined
}

export function useElectronWebviewConsoleMessageBlock({
  enabled,
  webviewRef,
  resolvedUrl,
  minLevel = 2,
}: UseElectronWebviewConsoleMessageBlockParams): void {
  const sourceLabel = useMemo(() => {
    if (!resolvedUrl) return 'webview'
    try {
      return `webview:${new URL(resolvedUrl).hostname}`
    } catch {
      return 'webview'
    }
  }, [resolvedUrl])

  useEffect(() => {
    if (!enabled) return
    const webview = webviewRef.current
    if (!webview) return

    const handleConsoleMessage = (event: unknown) => {
      const consoleEvent = event as ElectronWebviewConsoleMessageEventBlock | null
      const level = consoleEvent?.level ?? 0
      if (level < minLevel) return

      const mappedLevel = getConsoleLevelBlock(level)
      if (!mappedLevel) return

      const message = String(consoleEvent?.message ?? '').trim()
      if (!message) return

      dispatchDebugLogBlock({
        level: normalizeWebviewConsoleLevelBlock(mappedLevel, message),
        message,
        details: buildConsoleDetailsBlock(consoleEvent, resolvedUrl),
        source: sourceLabel,
      })
    }

    webview.addEventListener('console-message', handleConsoleMessage as EventListener)
    return () => {
      webview.removeEventListener('console-message', handleConsoleMessage as EventListener)
    }
  }, [enabled, minLevel, resolvedUrl, sourceLabel, webviewRef])
}
