import { cn } from '@/lib/utils'
import type { ExcalidrawHighlighterPresetBlock } from '@/services/orchestrators/excalidrawHighlighterOrch'

interface AnnotationModeSidePickerBlockProps {
  presets: readonly ExcalidrawHighlighterPresetBlock[]
  activePresetId: string | null
  onSelectPreset: (presetId: string) => void
  className?: string
}

export default function AnnotationModeSidePickerBlock({
  presets,
  activePresetId,
  onSelectPreset,
  className,
}: AnnotationModeSidePickerBlockProps) {
  return (
    <div
      className={cn(
        'absolute right-2 top-1/2 z-[71] -translate-y-1/2',
        'flex flex-col items-center gap-1.5 rounded-2xl border border-border/50 bg-background/90 p-1.5 shadow-lg backdrop-blur',
        className,
      )}
    >
      {presets.map((preset, index) => {
        const isActive = activePresetId === preset.id
        const penNumber = index + 1
        const swatchColor = preset.backgroundColor !== 'transparent' ? preset.backgroundColor : preset.strokeColor
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(preset.id)}
            className={cn(
              'relative flex h-8 w-8 items-center justify-center rounded-full transition-all',
              isActive
                ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110'
                : 'opacity-70 hover:opacity-100 hover:bg-muted/80',
            )}
            title={`Pen ${penNumber}: ${preset.label}`}
            aria-label={`Pen ${penNumber}: ${preset.label}`}
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border/40 text-[9px] font-bold shadow-sm"
              style={{
                backgroundColor: swatchColor,
                color: isLightColorBlock(swatchColor) ? '#374151' : '#ffffff',
              }}
            >
              {penNumber <= 9 ? penNumber : 0}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function isLightColorBlock(color: string): boolean {
  if (color === 'transparent') return true
  const hex = color.replace('#', '')
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 150
  }
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16)
    const g = parseInt(hex[1] + hex[1], 16)
    const b = parseInt(hex[2] + hex[2], 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 150
  }
  return color.includes('fff') || color.includes('yellow') || color.includes('db')
}
