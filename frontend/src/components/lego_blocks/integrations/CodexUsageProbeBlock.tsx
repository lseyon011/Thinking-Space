import { memo, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import type { WebSiteBlock } from '@/services/lego_blocks/units/webSiteBlock'
import {
  buildCodexUsageProbeErrorResultBlock,
  buildCodexUsageProbeLoadingResultBlock,
  codexUsageProbeScriptBlock,
  detectCodexUsageProbeResultBlock,
  parseCodexUsageProbeSnapshotBlock,
  type CodexUsageProbeResultBlock,
} from '@/services/lego_blocks/units/codexUsageProbeBlock'

interface ElectronProbeWebviewElementBlock extends HTMLElement {
  executeJavaScript?: (script: string, userGesture?: boolean) => Promise<unknown>
}

interface CodexUsageProbeGuestBlockProps {
  site: WebSiteBlock
  refreshToken: number
  onResult: (result: CodexUsageProbeResultBlock) => void
}

const PROBE_INTERVAL_MS = 30000

const HIDDEN_PROBE_STYLE: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0.01,
  pointerEvents: 'none',
  left: -10000,
  top: -10000,
}

function buildProbeUserAgentBlock(): string {
  return navigator.userAgent
    .replace(/\s*Electron\/[\d.]+/g, '')
    .replace(/\s*Thinking Space\/[\d.]+/g, '')
    .trim()
}

const PROBE_USER_AGENT = typeof navigator === 'undefined' ? undefined : buildProbeUserAgentBlock()

const CodexUsageProbeGuestBlock = memo(function CodexUsageProbeGuestBlock({
  site,
  refreshToken,
  onResult,
}: CodexUsageProbeGuestBlockProps) {
  const webviewRef = useRef<ElectronProbeWebviewElementBlock | null>(null)
  const pollInFlightRef = useRef(false)
  const webviewKey = useMemo(() => `${site.id}:${refreshToken}`, [refreshToken, site.id])

  useEffect(() => {
    onResult(buildCodexUsageProbeLoadingResultBlock(site.id))
  }, [onResult, refreshToken, site.id])

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview?.executeJavaScript) {
      onResult(buildCodexUsageProbeErrorResultBlock(site.id, 'Electron webview probing is unavailable.'))
      return
    }

    let cancelled = false

    const runProbe = async () => {
      if (pollInFlightRef.current || cancelled) return
      pollInFlightRef.current = true
      try {
        const raw = await webview.executeJavaScript?.(codexUsageProbeScriptBlock(), true)
        if (cancelled) return
        const snapshot = parseCodexUsageProbeSnapshotBlock(raw)
        if (!snapshot) {
          onResult(buildCodexUsageProbeErrorResultBlock(site.id, 'Probe script returned an invalid snapshot.'))
          return
        }
        onResult(detectCodexUsageProbeResultBlock(site.id, site.url, snapshot))
      } catch (error) {
        if (!cancelled) {
          onResult(buildCodexUsageProbeErrorResultBlock(site.id, error instanceof Error ? error.message : String(error)))
        }
      } finally {
        pollInFlightRef.current = false
      }
    }

    const handleLoad = () => { void runProbe() }
    const handleFailLoad = (event: Event) => {
      const candidate = event as Event & { errorDescription?: unknown; isMainFrame?: boolean; errorCode?: number }
      if (candidate.isMainFrame === false || candidate.errorCode === -3) return
      onResult(
        buildCodexUsageProbeErrorResultBlock(
          site.id,
          typeof candidate.errorDescription === 'string' ? candidate.errorDescription : 'Failed to load web session.',
        ),
      )
    }

    webview.addEventListener('did-finish-load', handleLoad as EventListener)
    webview.addEventListener('did-navigate-in-page', handleLoad as EventListener)
    webview.addEventListener('did-fail-load', handleFailLoad as EventListener)

    const intervalId = window.setInterval(() => { void runProbe() }, PROBE_INTERVAL_MS)
    void runProbe()

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      webview.removeEventListener('did-finish-load', handleLoad as EventListener)
      webview.removeEventListener('did-navigate-in-page', handleLoad as EventListener)
      webview.removeEventListener('did-fail-load', handleFailLoad as EventListener)
    }
  }, [onResult, refreshToken, site.id, site.url])

  return (
    <webview
      key={webviewKey}
      ref={(element) => { webviewRef.current = element as ElectronProbeWebviewElementBlock | null }}
      src={site.url}
      partition={site.partition}
      useragent={PROBE_USER_AGENT}
      style={HIDDEN_PROBE_STYLE}
    />
  )
})

export interface CodexUsageProbeBlockProps {
  sites: WebSiteBlock[]
  refreshToken: number
  onResult: (result: CodexUsageProbeResultBlock) => void
}

export default function CodexUsageProbeBlock({
  sites,
  refreshToken,
  onResult,
}: CodexUsageProbeBlockProps) {
  if (!window.electronAPI?.isElectron || sites.length === 0) return null

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-0">
      {sites.map((site) => (
        <CodexUsageProbeGuestBlock
          key={`${site.id}:${refreshToken}`}
          site={site}
          refreshToken={refreshToken}
          onResult={onResult}
        />
      ))}
    </div>
  )
}
