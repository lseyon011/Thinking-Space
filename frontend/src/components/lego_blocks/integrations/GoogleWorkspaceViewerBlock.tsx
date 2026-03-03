import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const GOOGLE_WEBVIEW_PARTITION_BLOCK = 'persist:thinking-space-google'

interface GoogleWorkspaceViewerBlockProps {
  url: string
  title: string
  className?: string
}

function isTrustedGoogleWorkspaceUrlBlock(value: string): boolean {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    return host === 'google.com'
      || host.endsWith('.google.com')
      || host.endsWith('.googleusercontent.com')
  } catch {
    return false
  }
}

function GoogleWorkspaceViewerBlock({
  url,
  title,
  className,
}: GoogleWorkspaceViewerBlockProps) {
  const isElectronRuntime = Boolean(window.electronAPI?.isElectron)
  const trustedUrl = useMemo(() => isTrustedGoogleWorkspaceUrlBlock(url), [url])
  const webviewRef = useRef<HTMLElement | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    setLoadError(null)
  }, [url])

  useEffect(() => {
    if (!isElectronRuntime || !trustedUrl) return
    const webview = webviewRef.current
    if (!webview) return

    const handleFailLoad = (event: unknown) => {
      const message = typeof event === 'object' && event !== null
        ? String((event as { errorDescription?: unknown }).errorDescription ?? 'Failed to load Google workspace content.')
        : 'Failed to load Google workspace content.'
      setLoadError(message)
    }

    webview.addEventListener('did-fail-load', handleFailLoad as EventListener)
    return () => {
      webview.removeEventListener('did-fail-load', handleFailLoad as EventListener)
    }
  }, [isElectronRuntime, trustedUrl])

  if (!trustedUrl) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Only Google Docs/Sheets URLs are supported for in-app workspace view.
      </div>
    )
  }

  if (isElectronRuntime) {
    return (
      <div className="relative h-full min-h-0">
        {loadError && (
          <div className="absolute left-3 right-3 top-3 z-10 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {loadError}
          </div>
        )}
        <webview
          ref={webviewRef}
          title={title}
          src={url}
          partition={GOOGLE_WEBVIEW_PARTITION_BLOCK}
          allowpopups
          className={cn('h-full min-h-0 w-full bg-background', className)}
        />
      </div>
    )
  }

  return (
    <iframe
      title={title}
      src={url}
      className={cn('h-full min-h-0 w-full bg-background', className)}
      allow="clipboard-read; clipboard-write"
    />
  )
}

export default memo(GoogleWorkspaceViewerBlock)
