import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ExternalLink, Globe, Loader2, RotateCw, X } from 'lucide-react'
import { readUrlShortcutOrch } from '@/services/orchestrators/urlShortcutOrch'
import { isValidHttpUrlBlock } from '@/services/lego_blocks/units/urlShortcutBlock'
import { isCapacitorNative } from '@/services/lego_blocks/integrations/fsBlock'
import {
  openInlineWebViewBlock,
  closeInlineWebViewBlock,
  updateInlineWebViewFrameBlock,
} from '@/services/lego_blocks/units/inlineWebViewBlock'
import { logError } from '@/services/lego_blocks/units/debugLogBlock'
import { cn } from '@/lib/utils'

const LINK_WEBVIEW_PARTITION = 'persist:thinking-space-links'

interface UrlDocumentBlockProps {
  /** Path to a .url file, OR a direct URL to display. */
  path?: string
  url?: string
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
  /** Override the Electron webview partition. Defaults to the shared links partition. */
  partition?: string
  /** Hide the URL bar (e.g. when top chrome provides a header toggle). */
  hideHeader?: boolean
  /** Suspend the native WKWebView (iOS) — use when a native-layer overlay (e.g. drawer) is open. */
  suspended?: boolean
}

function UrlDocumentBlock({
  path,
  url: directUrl,
  onClose,
  showCloseButton,
  className,
  partition,
  hideHeader,
  suspended,
}: UrlDocumentBlockProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(directUrl ?? null)
  const [loading, setLoading] = useState(!directUrl)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [canGoBack, setCanGoBack] = useState(false)
  const webviewRef = useRef<HTMLElement | null>(null)
  const contentAreaRef = useRef<HTMLDivElement | null>(null)
  const isElectronRuntime = Boolean(window.electronAPI?.isElectron)
  // InlineWebView is iOS-only; exclude Electron even though Capacitor reports isNativePlatform() there
  const isCapacitorRuntime = isCapacitorNative() && !isElectronRuntime

  // Resolve URL from .url file
  useEffect(() => {
    if (directUrl) {
      setResolvedUrl(directUrl)
      setLoading(false)
      setError(null)
      return
    }
    if (!path) {
      setError('No file path or URL provided')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    readUrlShortcutOrch(path)
      .then(result => {
        if (!cancelled) {
          setResolvedUrl(result.url)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to read .url file')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [path, directUrl])

  const isTrusted = useMemo(
    () => resolvedUrl !== null && isValidHttpUrlBlock(resolvedUrl),
    [resolvedUrl],
  )

  // Strip Electron/app tokens so webview looks like a plain Chrome browser to sites like Gmail.
  const webviewUserAgent = useMemo(() => {
    if (!isElectronRuntime) return undefined
    return navigator.userAgent
      .replace(/\s*Electron\/[\d.]+/g, '')
      .replace(/\s*Thinking Space\/[\d.]+/g, '')
      .trim()
  }, [isElectronRuntime])

  const displayUrl = resolvedUrl ?? ''
  const displayTitle = useMemo(() => {
    try { return new URL(displayUrl).hostname }
    catch { return 'Website' }
  }, [displayUrl])

  // iOS: close the native WKWebView immediately (before paint) when suspended so
  // it doesn't bleed over overlays/drawers that open on top of the content area.
  useLayoutEffect(() => {
    if (!isCapacitorRuntime || !isTrusted || !resolvedUrl || !suspended) return
    void closeInlineWebViewBlock()
  }, [isCapacitorRuntime, isTrusted, resolvedUrl, suspended])

  // iOS: overlay a native WKWebView over the content area div, kept in sync
  // via ResizeObserver so it survives panel resizes and layout changes.
  useEffect(() => {
    if (!isCapacitorRuntime || !isTrusted || !resolvedUrl || suspended) return
    const el = contentAreaRef.current
    if (!el) return

    const getRect = () => el.getBoundingClientRect()

    void openInlineWebViewBlock(resolvedUrl, getRect())

    const observer = new ResizeObserver(() => {
      void updateInlineWebViewFrameBlock(getRect())
    })
    observer.observe(el)

    return () => {
      observer.disconnect()
      void closeInlineWebViewBlock()
    }
  }, [isCapacitorRuntime, isTrusted, resolvedUrl, suspended])

  // Webview error handling + back-state tracking (Electron only)
  useEffect(() => {
    setLoadError(null)
    setCanGoBack(false)
  }, [resolvedUrl])

  useEffect(() => {
    if (!isElectronRuntime || !isTrusted) return
    const webview = webviewRef.current
    if (!webview) return

    const handleFailLoad = (event: unknown) => {
      const ev = event as { errorCode?: number; errorDescription?: unknown; validatedURL?: string } | null
      const errorCode = ev?.errorCode ?? 0
      // ERR_ABORTED (-3) fires on normal navigation cancellations — not a real error
      if (errorCode === -3) return
      const description = String(ev?.errorDescription ?? 'Failed to load page.')
      const failedUrl = ev?.validatedURL ?? resolvedUrl ?? ''
      setLoadError(description)
      logError(description, failedUrl ? `URL: ${failedUrl}` : undefined, 'webview')
    }

    const updateCanGoBack = () => {
      setCanGoBack(Boolean((webview as unknown as { canGoBack?: () => boolean }).canGoBack?.()))
    }

    webview.addEventListener('did-fail-load', handleFailLoad as EventListener)
    webview.addEventListener('did-navigate', updateCanGoBack)
    webview.addEventListener('did-navigate-in-page', updateCanGoBack)
    return () => {
      webview.removeEventListener('did-fail-load', handleFailLoad as EventListener)
      webview.removeEventListener('did-navigate', updateCanGoBack)
      webview.removeEventListener('did-navigate-in-page', updateCanGoBack)
    }
  }, [isElectronRuntime, isTrusted, resolvedUrl])

  // macOS 2-finger swipe gesture forwarded from BrowserWindow 'swipe' event
  useEffect(() => {
    if (!isElectronRuntime) return
    const cleanup = (window.electronAPI as unknown as {
      onWebviewSwipe?: (cb: (dir: 'left' | 'right') => void) => () => void
    })?.onWebviewSwipe?.((direction) => {
      const wv = webviewRef.current as unknown as { goBack?: () => void; goForward?: () => void } | null
      if (direction === 'left') wv?.goBack?.()
      else wv?.goForward?.()
    })
    return cleanup
  }, [isElectronRuntime])

  const handleGoBack = useCallback(() => {
    ;(webviewRef.current as unknown as { goBack?: () => void } | null)?.goBack?.()
  }, [])

  const handleReload = useCallback(() => {
    if (isElectronRuntime) {
      ;(webviewRef.current as unknown as { reload?: () => void } | null)?.reload?.()
    } else {
      setReloadKey(k => k + 1)
    }
  }, [isElectronRuntime])

  const openExternal = useCallback(() => {
    if (!resolvedUrl) return
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(resolvedUrl)
    } else {
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
    }
  }, [resolvedUrl])

  if (loading) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !isTrusted) {
    return (
      <div className={cn('flex h-full flex-col items-center justify-center gap-3 p-8', className)}>
        <Globe className="h-8 w-8 text-muted-foreground/50" />
        <div className="text-sm text-destructive">{error ?? 'Invalid or unsupported URL.'}</div>
        {showCloseButton && onClose && (
          <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
            Close
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* URL bar */}
      {!hideHeader && (
        <div className="ts-doc-header flex shrink-0 items-center gap-2 border-b border-border/50 px-4 py-2">
          {isElectronRuntime && (
            <button
              type="button"
              onClick={handleGoBack}
              disabled={!canGoBack}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
              title="Go back"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <Globe className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{displayUrl}</span>
          <button
            type="button"
            onClick={handleReload}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            title="Reload"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={openExternal}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            title="Open in external browser"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          {showCloseButton && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Content area */}
      <div ref={contentAreaRef} className="relative min-h-0 flex-1 overflow-hidden">
        {loadError && (
          <div className="absolute left-3 right-3 top-3 z-10 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {loadError}
          </div>
        )}
        {isElectronRuntime ? (
          <webview
            ref={webviewRef}
            title={displayTitle}
            src={resolvedUrl!}
            partition={partition ?? LINK_WEBVIEW_PARTITION}
            useragent={webviewUserAgent}
            allowpopups
            className="absolute inset-0 bg-background"
          />
        ) : isCapacitorRuntime ? (
          // Native WKWebView is overlaid by the plugin — render a transparent
          // placeholder so the React layout reserves the same space.
          <div className="absolute inset-0" />
        ) : (
          <iframe
            key={reloadKey}
            title={displayTitle}
            src={resolvedUrl!}
            className="absolute inset-0 bg-background"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    </div>
  )
}

export default memo(UrlDocumentBlock)
