import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ColorPaletteGridBlock from '@/components/lego_blocks/units/ColorPaletteGridBlock'
import { cn } from '@/lib/utils'
import { normalizeHexColorBlock } from '@/services/lego_blocks/units/tagBlock'

export interface ColorPickerBlockProps {
  value?: string | null
  onChange: (nextColor: string) => void
  onReset?: () => void
  disabled?: boolean
  className?: string
  title?: string
}

const DEFAULT_COLOR = '#0ea5e9'

export default function ColorPickerBlock({
  value,
  onChange,
  onReset,
  disabled = false,
  className,
  title = 'Pick color',
}: ColorPickerBlockProps) {
  const normalized = normalizeHexColorBlock(value)
  const resolvedColor = normalized ?? DEFAULT_COLOR
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        title={title}
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/70 transition-colors hover:bg-muted/70',
          open && 'bg-muted',
          disabled && 'cursor-not-allowed opacity-60',
        )}
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        aria-label={title}
        aria-expanded={open}
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 rounded-full border border-black/15"
          style={{ backgroundColor: resolvedColor }}
        />
      </button>
      {open && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-border/70 bg-background/95 p-2 shadow-sm backdrop-blur">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-foreground">{title}</span>
            {onReset && normalized && (
              <button
                type="button"
                title="Reset color"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => {
                  onReset()
                  setOpen(false)
                }}
                aria-label="Reset color"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
          <ColorPaletteGridBlock
            value={resolvedColor}
            onChange={(nextColor) => {
              onChange(nextColor)
              setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
