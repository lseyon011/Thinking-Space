import { memo, useCallback, useMemo, useRef } from 'react'
import { useElectronWebviewLoadErrorBlock } from '@/components/lego_blocks/hooks/shared/useElectronWebviewLoadErrorBlock'
import { cn } from '@/lib/utils'
import { openExternalUrlOrch } from '@/services/orchestrators/fileSystemOrch'

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
  const loadError = useElectronWebviewLoadErrorBlock({
    enabled: isElectronRuntime && trustedUrl,
    webviewRef,
    resolvedUrl: url,
    logSource: 'google-workspace-webview',
  })
  const handleOpenExternal = useCallback(() => {
    void openExternalUrlOrch(url).catch(() => undefined)
  }, [url])

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
