import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HtmlDocumentBlockProps {
  html: string
  className?: string
}

export default function HtmlDocumentBlock({
  html,
  className,
}: HtmlDocumentBlockProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    setPreviewUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [html])

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm">
        {previewUrl ? (
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
