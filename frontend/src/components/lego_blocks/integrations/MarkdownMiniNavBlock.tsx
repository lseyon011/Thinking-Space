import { useCallback, useEffect, useMemo, useState } from 'react'

interface MarkdownMiniNavBlockProps {
  content: string
  container: HTMLDivElement | null
  className?: string
  useRenderedHeadings?: boolean
  renderRootSelector?: string
}

interface HeadingMark {
  level: number
  ratio: number
}

type ScrollTargetMode = 'container' | 'page'

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
  useRenderedHeadings = true,
  renderRootSelector,
}: MarkdownMiniNavBlockProps) {
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollHeight, setScrollHeight] = useState(1)
  const [clientHeight, setClientHeight] = useState(1)
  const fallbackHeadingMarks = useMemo(() => extractHeadingMarks(content), [content])
  const [headingMarks, setHeadingMarks] = useState<HeadingMark[]>(fallbackHeadingMarks)

  const readPageMetrics = useCallback((): { top: number; height: number; viewportHeight: number } => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return { top: 0, height: 1, viewportHeight: 1 }
    }
    const scrollingElement = document.scrollingElement ?? document.documentElement
    const top = Number.isFinite(window.scrollY) ? window.scrollY : scrollingElement.scrollTop
    const height = Math.max(scrollingElement.scrollHeight, 1)
    const viewportHeight = Math.max(window.innerHeight || scrollingElement.clientHeight, 1)
    return { top: Math.max(top, 0), height, viewportHeight }
  }, [])

  const readScrollTargetMode = useCallback((): ScrollTargetMode => {
    if (!container) return 'page'
    return container.scrollHeight - container.clientHeight > 1 ? 'container' : 'page'
  }, [container])

  const resolveRenderedHeadingMarks = useCallback((): HeadingMark[] => {
    if (!useRenderedHeadings) return fallbackHeadingMarks
    const mode = readScrollTargetMode()

    const roots = renderRootSelector
      ? (container
          ? Array.from(container.querySelectorAll<HTMLElement>(renderRootSelector))
          : Array.from(document.querySelectorAll<HTMLElement>(renderRootSelector)))
      : (container ? [container] : [])
    const headings: HTMLHeadingElement[] = roots.flatMap((root) =>
      Array.from(root.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6')),
    )
    if (headings.length === 0) return fallbackHeadingMarks

    const containerRect = container?.getBoundingClientRect() ?? null
    const pageMetrics = readPageMetrics()
    const maxScroll = mode === 'container'
      ? Math.max((container?.scrollHeight ?? 1) - (container?.clientHeight ?? 1), 1)
      : Math.max(pageMetrics.height - pageMetrics.viewportHeight, 1)
    const marks: HeadingMark[] = []

    for (const heading of headings) {
      const level = Number(heading.tagName.slice(1))
      if (!Number.isFinite(level)) continue
      const headingRect = heading.getBoundingClientRect()
      const offsetTop = mode === 'container' && containerRect && container
        ? headingRect.top - containerRect.top + container.scrollTop
        : headingRect.top + pageMetrics.top
      const ratio = Math.max(0, Math.min(1, offsetTop / maxScroll))
      marks.push({ level, ratio })
    }

    return marks.length > 0 ? marks : fallbackHeadingMarks
  }, [container, fallbackHeadingMarks, readPageMetrics, readScrollTargetMode, renderRootSelector, useRenderedHeadings])

  useEffect(() => {
    setHeadingMarks(fallbackHeadingMarks)
  }, [fallbackHeadingMarks])

  useEffect(() => {
    let headingFrame: number | null = null
    const scheduleHeadingUpdate = () => {
      if (headingFrame !== null) return
      headingFrame = window.requestAnimationFrame(() => {
        headingFrame = null
        setHeadingMarks(resolveRenderedHeadingMarks())
      })
    }

    const updateMetrics = () => {
      const mode = readScrollTargetMode()
      if (mode === 'container' && container) {
        setScrollTop(container.scrollTop)
        setScrollHeight(Math.max(container.scrollHeight, 1))
        setClientHeight(Math.max(container.clientHeight, 1))
        return
      }

      const page = readPageMetrics()
      setScrollTop(page.top)
      setScrollHeight(page.height)
      setClientHeight(page.viewportHeight)
    }

    updateMetrics()
    scheduleHeadingUpdate()

    const handleContainerScroll = () => {
      if (readScrollTargetMode() !== 'container' || !container) return
      setScrollTop(container.scrollTop)
    }
    container?.addEventListener('scroll', handleContainerScroll, { passive: true })

    const handleWindowScroll = () => {
      if (readScrollTargetMode() !== 'page') return
      const page = readPageMetrics()
      setScrollTop(page.top)
    }
    window.addEventListener('scroll', handleWindowScroll, { passive: true })

    const ro = new ResizeObserver(() => {
      updateMetrics()
      scheduleHeadingUpdate()
    })
    if (container) ro.observe(container)

    const mo = new MutationObserver(() => {
      updateMetrics()
      scheduleHeadingUpdate()
    })
    if (container) {
      mo.observe(container, { subtree: true, childList: true, attributes: true })
    }

    const handleWindowResize = () => {
      updateMetrics()
      scheduleHeadingUpdate()
    }
    window.addEventListener('resize', handleWindowResize)

    return () => {
      if (headingFrame !== null) {
        window.cancelAnimationFrame(headingFrame)
        headingFrame = null
      }
      container?.removeEventListener('scroll', handleContainerScroll)
      window.removeEventListener('scroll', handleWindowScroll)
      window.removeEventListener('resize', handleWindowResize)
      ro.disconnect()
      mo.disconnect()
    }
  }, [container, fallbackHeadingMarks, readPageMetrics, readScrollTargetMode, resolveRenderedHeadingMarks])

  const trackHeight = 112
  const maxScroll = Math.max(scrollHeight - clientHeight, 1)
  const viewportRatio = Math.min(clientHeight / scrollHeight, 1)
  const viewportHeight = Math.max(viewportRatio * trackHeight, 16)
  const viewportTop = (scrollTop / maxScroll) * (trackHeight - viewportHeight)

  const scrollToRatio = (ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio))
    const mode = readScrollTargetMode()
    if (mode === 'container' && container) {
      container.scrollTo({
        top: clamped * maxScroll,
        behavior: 'smooth',
      })
      return
    }

    const page = readPageMetrics()
    const pageMaxScroll = Math.max(page.height - page.viewportHeight, 1)
    window.scrollTo({
      top: clamped * pageMaxScroll,
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
