import type { ReactNode } from 'react'
import { useMarkdownViewer } from '@/components/orchestrators/MarkdownViewerOrch'

interface ClickablePathProps {
  path: string
  children: ReactNode
  className?: string
}

export default function ClickablePath({ path, children, className }: ClickablePathProps) {
  const { openFile } = useMarkdownViewer()

  const lower = path.toLowerCase()
  const isClickable = lower.endsWith('.md') || lower.endsWith('.excalidraw')

  if (!isClickable) {
    return <span className={className}>{children}</span>
  }

  return (
    <button
      onClick={e => {
        e.stopPropagation()
        openFile(path)
      }}
      className={`text-left hover:text-primary hover:underline cursor-pointer ${className ?? ''}`}
      title={path}
    >
      {children}
    </button>
  )
}
