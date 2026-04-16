import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useElectronWebviewLoadErrorBlock } from '@/components/lego_blocks/hooks/shared/useElectronWebviewLoadErrorBlock'
import { useRouteActivityBlock } from '@/components/lego_blocks/hooks/shared/useRouteActivityBlock'
import { useWindowActivityBlock } from '@/components/lego_blocks/hooks/shared/useWindowActivityBlock'
import { cn } from '@/lib/utils'
import { openExternalUrlOrch } from '@/services/orchestrators/fileSystemOrch'

const GOOGLE_WEBVIEW_PARTITION_BLOCK = 'persist:thinking-space-google'
const GOOGLE_WEBVIEW_UNLOAD_DELAY_MS = 3 * 60 * 60 * 1000

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
  const routeActive = useRouteActivityBlock()
  const windowActive = useWindowActivityBlock()
  const trustedUrl = useMemo(() => isTrustedGoogleWorkspaceUrlBlock(url), [url])
  const webviewRef = useRef<HTMLElement | null>(null)
  const shouldPauseWebview = isElectronRuntime && (!routeActive || !windowActive)
  const [webviewMounted, setWebviewMounted] = useState(() => !shouldPauseWebview)
  const [webviewInstanceKey, setWebviewInstanceKey] = useState(0)
  const loadError = useElectronWebviewLoadErrorBlock({
    enabled: isElectronRuntime && trustedUrl && webviewMounted,
    webviewRef,
    resolvedUrl: url,
    logSource: 'google-workspace-webview',
  })
  const handleReloadWebview = useCallback(() => {
    setWebviewMounted(true)
    setWebviewInstanceKey(value => value + 1)
  }, [])
  const handleOpenExternal = useCallback(() => {
    void openExternalUrlOrch(url).catch(() => undefined)
  }, [url])

  useEffect(() => {
    if (!isElectronRuntime) return
    if (!shouldPauseWebview) {
      setWebviewMounted(true)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setWebviewMounted(false)
    }, GOOGLE_WEBVIEW_UNLOAD_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isElectronRuntime, shouldPauseWebview])

  if (!trustedUrl) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Only Google Docs/Sheets URLs are supported for in-app workspace view.
      </div>
    )
  }

  if (isElectronRuntime) {
    if (loadError) {
      return (
        <div className={cn('flex h-full min-h-0 items-center justify-center bg-background p-6', className)}>
          <div className="w-full max-w-lg rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
            <div className="text-sm font-medium text-foreground">Google Workspace page could not be shown here</div>
            <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            <button
              type="button"
              onClick={handleOpenExternal}
              className="mt-4 inline-flex rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Open in browser
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="relative h-full min-h-0">
        {webviewMounted ? (
          <webview
            key={webviewInstanceKey}
            ref={webviewRef}
            title={title}
            src={url}
            partition={GOOGLE_WEBVIEW_PARTITION_BLOCK}
            allowpopups
            className={cn('h-full min-h-0 w-full bg-background', className)}
          />
        ) : (
          <div className={cn('flex h-full min-h-0 w-full items-center justify-center bg-background p-6', className)}>
            <div className="w-full max-w-md rounded-2xl border border-border/50 bg-muted/20 p-6 text-center">
              <div className="text-sm font-medium text-foreground">Webview inactive</div>
              <p className="mt-2 text-sm text-muted-foreground">
                This workspace view was suspended after inactivity. Reload to restore it.
              </p>
              <button
                type="button"
                onClick={handleReloadWebview}
                className="mt-4 inline-flex rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Reload webview
              </button>
            </div>
          </div>
        )}
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
