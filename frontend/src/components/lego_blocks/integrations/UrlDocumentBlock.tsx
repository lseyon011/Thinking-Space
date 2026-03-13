import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Globe, Loader2, X } from 'lucide-react'
import { readUrlShortcutOrch } from '@/services/orchestrators/urlShortcutOrch'
import { isValidHttpUrlBlock } from '@/services/lego_blocks/units/urlShortcutBlock'
import { isCapacitorNative } from '@/services/lego_blocks/integrations/fsBlock'
import {
  openInlineWebViewBlock,
  closeInlineWebViewBlock,
  updateInlineWebViewFrameBlock,
} from '@/services/lego_blocks/units/inlineWebViewBlock'
import { cn } from '@/lib/utils'

const LINK_WEBVIEW_PARTITION = 'persist:thinking-space-links'

interface UrlDocumentBlockProps {
  /** Path to a .url file, OR a direct URL to display. */
  path?: string
  url?: string
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
}

function UrlDocumentBlock({
  path,
  url: directUrl,
  onClose,
  showCloseButton,
  className,
}: UrlDocumentBlockProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(directUrl ?? null)
  const [loading, setLoading] = useState(!directUrl)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const webviewRef = useRef<HTMLElement | null>(null)
  const contentAreaRef = useRef<HTMLDivElement | null>(null)
  const isElectronRuntime = Boolean(window.electronAPI?.isElectron)
  const isCapacitorRuntime = isCapacitorNative()

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

  const displayUrl = resolvedUrl ?? ''
  const displayTitle = useMemo(() => {
    try { return new URL(displayUrl).hostname }
    catch { return 'Website' }
  }, [displayUrl])

  // iOS: overlay a native WKWebView over the content area div, kept in sync
  // via ResizeObserver so it survives panel resizes and layout changes.
  useEffect(() => {
    if (!isCapacitorRuntime || !isTrusted || !resolvedUrl) return
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
  }, [isCapacitorRuntime, isTrusted, resolvedUrl])

  // Webview error handling (Electron only)
  useEffect(() => {
    setLoadError(null)
  }, [resolvedUrl])

  useEffect(() => {
    if (!isElectronRuntime || !isTrusted) return
    const webview = webviewRef.current
    if (!webview) return

    const handleFailLoad = (event: unknown) => {
      const message = typeof event === 'object' && event !== null
        ? String((event as { errorDescription?: unknown }).errorDescription ?? 'Failed to load page.')
        : 'Failed to load page.'
      setLoadError(message)
    }

    webview.addEventListener('did-fail-load', handleFailLoad as EventListener)
    return () => {
      webview.removeEventListener('did-fail-load', handleFailLoad as EventListener)
    }
  }, [isElectronRuntime, isTrusted, resolvedUrl])

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
      <div className="ts-doc-header flex shrink-0 items-center gap-2 border-b border-border/50 px-4 py-2">
        <Globe className="h-3.5 w-3.5 shrink-0 text-blue-500" />
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{displayUrl}</span>
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

      {/* Content area */}
      <div ref={contentAreaRef} className="relative min-h-0 flex-1">
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
            partition={LINK_WEBVIEW_PARTITION}
            allowpopups
            className="h-full min-h-0 w-full bg-background"
          />
        ) : isCapacitorRuntime ? (
          // Native WKWebView is overlaid by the plugin — render a transparent
          // placeholder so the React layout reserves the same space.
          <div className="h-full w-full" />
        ) : (
          <iframe
            title={displayTitle}
            src={resolvedUrl!}
            className="h-full min-h-0 w-full bg-background"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    </div>
  )
}

export default memo(UrlDocumentBlock)
