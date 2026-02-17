import { useEffect, useMemo, useState } from 'react'

interface MarkdownMiniNavBlockProps {
  content: string
  container: HTMLDivElement | null
  className?: string
}

interface HeadingMark {
  level: number
  ratio: number
}

function extractHeadingMarks(markdown: string): HeadingMark[] {
  const lines = markdown.split('\n')
  const total = Math.max(lines.length - 1, 1)
  const marks: HeadingMark[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const m = line.match(/^(#{1,6})\s+/)
    if (!m) continue
    marks.push({
      level: m[1].length,
      ratio: i / total,
    })
  }
  return marks
}

export default function MarkdownMiniNavBlock({
  content,
  container,
  className,
}: MarkdownMiniNavBlockProps) {
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollHeight, setScrollHeight] = useState(1)
  const [clientHeight, setClientHeight] = useState(1)
  const headingMarks = useMemo(() => extractHeadingMarks(content), [content])

  useEffect(() => {
    if (!container) return undefined

    const update = () => {
      setScrollTop(container.scrollTop)
      setScrollHeight(Math.max(container.scrollHeight, 1))
      setClientHeight(Math.max(container.clientHeight, 1))
    }

    update()
    container.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(container)

    return () => {
      container.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [container])

  const trackHeight = 112
  const maxScroll = Math.max(scrollHeight - clientHeight, 1)
  const viewportRatio = Math.min(clientHeight / scrollHeight, 1)
  const viewportHeight = Math.max(viewportRatio * trackHeight, 16)
  const viewportTop = (scrollTop / maxScroll) * (trackHeight - viewportHeight)

  const scrollToRatio = (ratio: number) => {
    if (!container) return
    const clamped = Math.max(0, Math.min(1, ratio))
    container.scrollTo({
      top: clamped * maxScroll,
      behavior: 'smooth',
    })
  }

  return (
    <div
      className={className ?? 'absolute right-3 top-3 z-20 select-none rounded-lg border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur'}
      title="Mini map"
    >
      <div
        className="relative h-28 w-8 cursor-pointer rounded bg-muted/40"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
          const ratio = (e.clientY - rect.top) / Math.max(rect.height, 1)
          scrollToRatio(ratio)
        }}
      >
        {headingMarks.map((mark, i) => (
          <div
            key={`${mark.level}-${mark.ratio}-${i}`}
            className="absolute left-0.5 rounded bg-primary/50"
            style={{
              top: `${mark.ratio * 100}%`,
              height: 2,
              width: `${Math.max(20 - mark.level * 2, 8)}px`,
            }}
          />
        ))}

        <div
          className="absolute left-0 right-0 rounded border border-primary/70 bg-primary/20"
          style={{
            top: `${viewportTop}px`,
            height: `${viewportHeight}px`,
          }}
        />
      </div>
    </div>
  )
}

