import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isElectron } from '@/services/lego_blocks/integrations/fsBlock'

interface HtmlDocumentBlockProps {
  html: string
  className?: string
}

function encodeHtmlAsDataUrl(html: string): string {
  const utf8 = new TextEncoder().encode(html)
  let binary = ''
  for (let i = 0; i < utf8.length; i += 1) {
    binary += String.fromCharCode(utf8[i])
  }
  return `data:text/html;charset=utf-8;base64,${btoa(binary)}`
}

export default function HtmlDocumentBlock({
  html,
  className,
}: HtmlDocumentBlockProps) {
  const electron = isElectron()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const dataUrl = useMemo(() => (electron ? encodeHtmlAsDataUrl(html) : null), [electron, html])

  useEffect(() => {
    if (electron) {
      setPreviewUrl(null)
      return
    }
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    setPreviewUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [electron, html])

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm">
        {electron && dataUrl ? (
          // <webview> runs in a separate WebContents with its own session, so
          // the renderer CSP isn't inherited. Required for HTML docs that pull
          // scripts from CDNs (three.js, etc.).
          <webview
            key={dataUrl}
            src={dataUrl}
            allowpopups
            className="h-full w-full bg-white"
          />
        ) : previewUrl ? (
          <iframe
            title="HTML preview"
            src={previewUrl}
            className="h-full w-full bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="flex h-full min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading HTML preview...
          </div>
        )}
      </div>
    </div>
  )
}
