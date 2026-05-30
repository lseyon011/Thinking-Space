import { Move, Copy, Trash2, Droplet, ArrowUpRight, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import type {
  CanvasTile,
  PostItFontSize,
} from '@/components/lego_blocks/hooks/shared/useCanvasTilesBlock'
import { useCanvasThemeBlock } from '@/components/lego_blocks/hooks/shared/useCanvasThemeBlock'
import {
  POST_IT_COLORS,
  POST_IT_PALETTE,
  type PostItColor,
} from './postItPaletteBlock'

interface Props {
  tile: CanvasTile
  screenX: number
  screenY: number
  /** World-space scale, used to convert screen drag delta → world delta. */
  scale: number
  onMove: (id: string, x: number, y: number) => void
  onSetColor: (id: string, color: PostItColor) => void
  onSetFontSize: (id: string, fontSize: PostItFontSize) => void
  onSetTextColor: (id: string, textColor: PostItColor | undefined) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onOpenInPage?: (filePath: string) => void
  onRefreshWidget?: (id: string) => void
}

const ICON_SIZE = 16

const FONT_SIZES: { key: PostItFontSize; px: number }[] = [
  { key: 's', px: 11 },
  { key: 'm', px: 14 },
  { key: 'l', px: 18 },
]

export default function CanvasTileToolbarBlock({
  tile,
  screenX,
  screenY,
  scale,
  onMove,
  onSetColor,
  onSetFontSize,
  onSetTextColor,
  onDuplicate,
  onRemove,
  onOpenInPage,
  onRefreshWidget,
}: Props) {
  const theme = useCanvasThemeBlock()
  const [colorOpen, setColorOpen] = useState(false)
  const [moveActive, setMoveActive] = useState(false)
  const isPostIt = tile.type === 'post-it'
  const isNote = tile.type === 'note'
  const isWidget = tile.type === 'web-widget'
  const activeFontSize = isPostIt ? tile.fontSize ?? 'm' : 'm'
  const textColor = isPostIt ? tile.textColor : undefined

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 6,
    background: 'transparent',
    border: 'none',
    color: theme.toolbarText,
    cursor: 'pointer',
    transition: 'background 120ms ease, color 120ms ease',
    fontFamily: 'inherit',
  }

  const dividerStyle: React.CSSProperties = {
    width: 1,
    alignSelf: 'stretch',
    background: theme.toolbarBorder,
    marginInline: 4,
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY,
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        padding: 4,
        background: theme.toolbarBg,
        border: `1px solid ${theme.toolbarBorder}`,
        borderRadius: 10,
        boxShadow: theme.isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(20,20,24,0.18)',
        backdropFilter: 'blur(14px)',
        zIndex: 100,
        pointerEvents: 'auto',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <button
        style={{
          ...buttonStyle,
          color: moveActive ? theme.tileText : theme.toolbarText,
          background: moveActive ? theme.toolbarHighlight : 'transparent',
          cursor: moveActive ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        title="Drag to move"
        aria-label="Drag to move tile"
        aria-pressed={moveActive}
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setMoveActive(true)
          const startX = e.clientX
          const startY = e.clientY
          const origX = tile.x
          const origY = tile.y
          const id = tile.id
          const onPointerMove = (ev: PointerEvent) => {
            const dx = (ev.clientX - startX) / scale
            const dy = (ev.clientY - startY) / scale
            onMove(id, origX + dx, origY + dy)
          }
          const onPointerUp = () => {
            document.removeEventListener('pointermove', onPointerMove)
            document.removeEventListener('pointerup', onPointerUp)
            setMoveActive(false)
          }
          document.addEventListener('pointermove', onPointerMove)
          document.addEventListener('pointerup', onPointerUp)
        }}
      >
        <Move size={ICON_SIZE} />
      </button>

      {isPostIt && (
        <>
          <div style={dividerStyle} />
          <div style={{ position: 'relative' }}>
            <button
              style={{
                ...buttonStyle,
                color: colorOpen ? theme.tileText : theme.toolbarText,
              }}
              onClick={() => setColorOpen(v => !v)}
              title="Color"
            >
              <Droplet size={ICON_SIZE} />
            </button>
            {colorOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: 8,
                  padding: 8,
                  background: theme.popoverBg,
                  border: `1px solid ${theme.popoverBorder}`,
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  boxShadow: theme.isDark ? '0 8px 20px rgba(0,0,0,0.4)' : '0 8px 20px rgba(20,20,24,0.15)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      color: theme.popoverTextMuted,
                      width: 32,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Card
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {POST_IT_COLORS.map(c => (
                      <button
                        key={c}
                        aria-label={`Card color ${c}`}
                        onClick={() => onSetColor(tile.id, c)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          background: POST_IT_PALETTE[c].background,
                          border:
                            tile.type === 'post-it' && tile.color === c
                              ? `2px solid ${theme.isDark ? 'rgba(255,255,255,0.9)' : 'rgba(20,20,24,0.85)'}`
                              : `1px solid ${theme.toolbarBorder}`,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    paddingTop: 6,
                    borderTop: `1px solid ${theme.popoverBorder}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: theme.popoverTextMuted,
                      width: 32,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Text
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      aria-label="Default text color"
                      aria-pressed={!textColor}
                      onClick={() => onSetTextColor(tile.id, undefined)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        background: 'transparent',
                        border: !textColor
                          ? `2px solid ${theme.isDark ? 'rgba(255,255,255,0.9)' : 'rgba(20,20,24,0.85)'}`
                          : `1px solid ${theme.toolbarBorder}`,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: theme.toolbarText,
                        fontWeight: 600,
                        fontSize: 12,
                        fontFamily: 'inherit',
                      }}
                    >
                      A
                    </button>
                    {POST_IT_COLORS.map(c => (
                      <button
                        key={c}
                        aria-label={`Text color ${c}`}
                        aria-pressed={textColor === c}
                        onClick={() => onSetTextColor(tile.id, c)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          background: 'transparent',
                          border:
                            textColor === c
                              ? `2px solid ${theme.isDark ? 'rgba(255,255,255,0.9)' : 'rgba(20,20,24,0.85)'}`
                              : `1px solid ${theme.toolbarBorder}`,
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: POST_IT_PALETTE[c].cornerMark,
                          fontWeight: 600,
                          fontSize: 12,
                          fontFamily: 'inherit',
                        }}
                      >
                        A
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={dividerStyle} />
          {FONT_SIZES.map(({ key, px }) => {
            const active = activeFontSize === key
            return (
              <button
                key={key}
                onClick={() => onSetFontSize(tile.id, key)}
                title={`Text ${key.toUpperCase()}`}
                style={{
                  ...buttonStyle,
                  width: 26,
                  color: active ? theme.tileText : theme.toolbarTextMuted,
                  background: active ? theme.toolbarHighlight : 'transparent',
                  fontSize: px,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                }}
              >
                A
              </button>
            )
          })}
        </>
      )}

      <div style={dividerStyle} />
      {isNote && onOpenInPage && (
        <button
          style={buttonStyle}
          onClick={() => onOpenInPage(tile.filePath)}
          title="Open in page"
        >
          <ArrowUpRight size={ICON_SIZE} />
        </button>
      )}
      {isWidget && onRefreshWidget && (
        <button
          style={buttonStyle}
          onClick={() => onRefreshWidget(tile.id)}
          title="Refresh widget"
        >
          <RefreshCw size={ICON_SIZE} />
        </button>
      )}
      <button
        style={buttonStyle}
        onClick={() => onDuplicate(tile.id)}
        title="Duplicate"
      >
        <Copy size={ICON_SIZE} />
      </button>
      <button
        style={{ ...buttonStyle, color: theme.isDark ? 'rgba(255, 120, 120, 0.85)' : 'rgba(200, 40, 40, 0.9)' }}
        onClick={() => onRemove(tile.id)}
        title="Delete"
      >
        <Trash2 size={ICON_SIZE} />
      </button>
    </div>
  )
}
