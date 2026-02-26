import { RotateCcw } from 'lucide-react'
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

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <label
        title={title}
        className={cn(
          'inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-border/70',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 rounded-full border border-black/15"
          style={{ backgroundColor: resolvedColor }}
        />
        <input
          type="color"
          className="sr-only"
          value={resolvedColor}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-label={title}
        />
      </label>
      {onReset && normalized && (
        <button
          type="button"
          title="Reset color"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onReset}
          disabled={disabled}
          aria-label="Reset color"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
