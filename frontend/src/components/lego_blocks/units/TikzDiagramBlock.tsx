import { useEffect, useRef, useState } from 'react'
import { ensureTikzJaxLoadedBlock } from '@/services/lego_blocks/integrations/tikzJaxLoaderBlock'

interface TikzDiagramBlockProps {
  source: string
  className?: string
}

function wrapTikzSource(source: string): string {
  const trimmed = source.trim()
  if (trimmed.includes('\\begin{document}')) return trimmed
  if (trimmed.startsWith('\\begin{tikzpicture}')) return trimmed
  return `\\begin{tikzpicture}\n${trimmed}\n\\end{tikzpicture}`
}

export default function TikzDiagramBlock({ source, className }: TikzDiagramBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setErrorMessage(null)

    ensureTikzJaxLoadedBlock()
      .then(() => {
        if (cancelled) return
        const container = containerRef.current
        if (!container) return
        container.innerHTML = ''
        const script = document.createElement('script')
        script.type = 'text/tikz'
        script.setAttribute('data-show-console', 'true')
        script.text = wrapTikzSource(source)
        container.appendChild(script)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setErrorMessage(err instanceof Error ? err.message : String(err))
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [source])

  return (
    <div className={className ?? 'ltm-tikz-block my-4 flex justify-center overflow-x-auto'}>
      {status === 'loading' && (
        <div className="text-sm text-muted-foreground">Rendering TikZ…</div>
      )}
      {status === 'error' && (
        <pre className="text-sm text-red-600 whitespace-pre-wrap">
{`TikZ render failed: ${errorMessage ?? 'unknown error'}

${source}`}
        </pre>
      )}
      <div ref={containerRef} />
    </div>
  )
}
