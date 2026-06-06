import { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft } from 'lucide-react'
import UrlDocumentBlock from '@/components/lego_blocks/integrations/UrlDocumentBlock'
import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'
import type { WebSiteBlock } from '@/services/lego_blocks/units/webSiteBlock'
import { readWebSitePreferencesOrch } from '@/services/orchestrators/webSiteOrch'

const PREVIEW_WIDTH = 1100
const PREVIEW_HEIGHT = 700

interface Props {
  onPick: (spec: {
    siteId: string
    region: { x: number; y: number; w: number; h: number }
    pageWidth: number
  }) => void
  onClose: () => void
}

type Phase = 'pick-site' | 'pick-region'

interface DragRect {
  startX: number
  startY: number
  curX: number
  curY: number
}

export default function CanvasWebWidgetPickerBlock({ onPick, onClose }: Props) {
  const theme = useCanvasThemeBlock()
  const [sites, setSites] = useState<WebSiteBlock[]>([])
  const [phase, setPhase] = useState<Phase>('pick-site')
  const [site, setSite] = useState<WebSiteBlock | null>(null)
  const [drag, setDrag] = useState<DragRect | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    void readWebSitePreferencesOrch().then(prefs => {
      if (cancelled) return
      setSites(prefs.bookmarks)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const onOverlayPointerDown = (e: React.PointerEvent) => {
    if (!overlayRef.current) return
    const rect = overlayRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setDrag({ startX: x, startY: y, curX: x, curY: y })
    overlayRef.current.setPointerCapture(e.pointerId)
  }

  const onOverlayPointerMove = (e: React.PointerEvent) => {
    if (!drag || !overlayRef.current) return
    const rect = overlayRef.current.getBoundingClientRect()
    setDrag({ ...drag, curX: e.clientX - rect.left, curY: e.clientY - rect.top })
  }

  const onOverlayPointerUp = () => {
    if (!drag || !site) {
      setDrag(null)
      return
    }
    const x = Math.min(drag.startX, drag.curX)
    const y = Math.min(drag.startY, drag.curY)
    const w = Math.abs(drag.curX - drag.startX)
    const h = Math.abs(drag.curY - drag.startY)
    if (w < 40 || h < 30) {
      // ignore stray clicks / tiny rects
      setDrag(null)
      return
    }
    onPick({
      siteId: site.id,
      region: { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) },
      pageWidth: PREVIEW_WIDTH,
    })
  }

  const dragRect = drag
    ? {
        left: Math.min(drag.startX, drag.curX),
        top: Math.min(drag.startY, drag.curY),
        width: Math.abs(drag.curX - drag.startX),
        height: Math.abs(drag.curY - drag.startY),
      }
    : null

  return (
    <div
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: PREVIEW_WIDTH + 24,
          maxWidth: '95vw',
          maxHeight: '95vh',
          background: theme.popoverBg,
          border: `1px solid ${theme.popoverBorder}`,
          borderRadius: 12,
          boxShadow: theme.isDark
            ? '0 24px 60px rgba(0,0,0,0.6)'
            : '0 24px 60px rgba(20,20,24,0.2)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: `1px solid ${theme.popoverBorder}`,
            color: theme.popoverText,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {phase === 'pick-region' && (
              <button
                onClick={() => {
                  setSite(null)
                  setDrag(null)
                  setPhase('pick-site')
                }}
                aria-label="Back"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: 'none',
                  background: 'transparent',
                  color: theme.popoverTextMuted,
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <span>
              {phase === 'pick-site'
                ? 'Add widget — pick a site'
                : `Drag to select region · ${site?.name ?? ''}`}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'flex',
              alignItems: 'center',
              border: 'none',
              background: 'transparent',
              color: theme.popoverTextMuted,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {phase === 'pick-site' ? (
          <div style={{ padding: 12, maxHeight: '70vh', overflowY: 'auto' }}>
            {sites.length === 0 ? (
              <div style={{ padding: 16, color: theme.popoverTextMuted, fontSize: 12 }}>
                No Web tab sites yet. Open the Web tab and add a bookmark first.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {sites.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSite(s)
                      setPhase('pick-region')
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'transparent',
                      color: theme.popoverText,
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderRadius: 6,
                    }}
                    onMouseEnter={e =>
                      (e.currentTarget.style.background = theme.popoverHighlight)
                    }
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>
                    <span style={{ fontSize: 11, color: theme.popoverTextMuted }}>{s.url}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : site ? (
          <div style={{ padding: 12 }}>
            <div
              style={{
                position: 'relative',
                width: PREVIEW_WIDTH,
                height: PREVIEW_HEIGHT,
                background: theme.tileBg,
                border: `1px solid ${theme.toolbarBorder}`,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <UrlDocumentBlock
                url={site.url}
                partition={site.partition}
                hideHeader
                className="absolute inset-0"
              />
              <div
                ref={overlayRef}
                onPointerDown={onOverlayPointerDown}
                onPointerMove={onOverlayPointerMove}
                onPointerUp={onOverlayPointerUp}
                style={{
                  position: 'absolute',
                  inset: 0,
                  cursor: 'crosshair',
                  // Transparent overlay sits above the webview to capture mouse
                  // for region selection. Click-through is disabled here on purpose.
                  background: 'transparent',
                  zIndex: 10,
                }}
              />
              {dragRect && (
                <div
                  style={{
                    position: 'absolute',
                    left: dragRect.left,
                    top: dragRect.top,
                    width: dragRect.width,
                    height: dragRect.height,
                    border: `2px solid ${theme.isDark ? 'rgba(255,255,255,0.9)' : 'rgba(20,20,24,0.85)'}`,
                    background: theme.isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(20,20,24,0.08)',
                    pointerEvents: 'none',
                    zIndex: 11,
                  }}
                />
              )}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: theme.popoverTextMuted,
                textAlign: 'center',
              }}
            >
              Drag a rectangle over the area you want to clip onto the board.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
