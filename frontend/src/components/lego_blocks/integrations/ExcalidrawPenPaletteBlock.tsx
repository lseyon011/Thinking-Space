import { useCallback, useState } from 'react'
import { Settings2 } from 'lucide-react'
import type { ExcalidrawHighlighterPresetBlock } from '@/services/orchestrators/excalidrawHighlighterOrch'
import type { ExcalidrawPenDefaultsOrch } from '@/services/orchestrators/excalidrawPenDefaultsOrch'
import { Switch } from '@/components/lego_blocks/units/ui/switch'
import { cn } from '@/lib/utils'

const STROKE_WIDTH_OPTIONS = [1, 2, 4, 8, 12] as const
const COLOR_SWATCHES = ['#1f2937', '#dc2626', '#2563eb', '#15803d', '#9333ea', '#ea580c'] as const

function clampOpacity(value: number): number {
  return Math.min(Math.max(Math.round(value), 1), 100)
}

interface ExcalidrawPenPaletteBlockProps {
  presets: readonly ExcalidrawHighlighterPresetBlock[]
  activePresetId: string | null
  onSelectPreset: (presetId: string) => void
  penDefaults: ExcalidrawPenDefaultsOrch
  onPenDefaultsChange: (next: ExcalidrawPenDefaultsOrch) => void
  currentStrokeWidth?: number
  onStrokeWidthChange?: (width: number) => void
}

export default function ExcalidrawPenPaletteBlock({
  presets,
  activePresetId,
  onSelectPreset,
  penDefaults,
  onPenDefaultsChange,
  currentStrokeWidth,
  onStrokeWidthChange,
}: ExcalidrawPenPaletteBlockProps) {
  const [showWidthPicker, setShowWidthPicker] = useState(false)
  const [showDefaultsMenu, setShowDefaultsMenu] = useState(false)

  const updateDefaults = useCallback((patch: Partial<ExcalidrawPenDefaultsOrch>) => {
    onPenDefaultsChange({
      ...penDefaults,
      ...patch,
    })
  }, [onPenDefaultsChange, penDefaults])

  return (
    <div
      className="pointer-events-none absolute z-30 flex -translate-y-1/2 flex-col items-center gap-1 rounded-xl border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur"
      style={{
        top: '50%',
        right: 'calc(var(--ltm-safe-right, 0px) + 0.4rem)',
      }}
    >
      {presets.map((preset, index) => {
        const isActive = activePresetId === preset.id
        const penNumber = index + 1
        const swatchColor = preset.backgroundColor !== 'transparent'
          ? preset.backgroundColor
          : preset.strokeColor

        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(preset.id)}
            className={cn(
              'pointer-events-auto relative flex h-7 w-7 items-center justify-center rounded-full transition-all',
              isActive
                ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                : 'hover:bg-muted/80',
            )}
            title={`Pen ${penNumber}: ${preset.label}`}
            aria-label={`Pen ${penNumber}: ${preset.label}`}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full border border-border/50 text-[8px] font-bold text-white"
              style={{
                backgroundColor: swatchColor,
                color: isLightColor(swatchColor) ? '#374151' : '#ffffff',
              }}
            >
              {penNumber <= 9 ? penNumber : 0}
            </span>
          </button>
        )
      })}

      {/* Stroke width control */}
      {onStrokeWidthChange && (
        <>
          <div className="mx-auto h-px w-4 bg-border/60" />
          <button
            type="button"
            onClick={() => setShowWidthPicker(v => !v)}
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted/80"
            title={`Stroke width: ${currentStrokeWidth ?? '?'}`}
            aria-label="Change stroke width"
          >
            <span
              className="rounded-full bg-foreground"
              style={{
                width: `${Math.min(Math.max((currentStrokeWidth ?? 2) * 1.2, 3), 14)}px`,
                height: `${Math.min(Math.max((currentStrokeWidth ?? 2) * 1.2, 3), 14)}px`,
              }}
            />
          </button>

          {showWidthPicker && (
            <div className="pointer-events-auto flex flex-col items-center gap-0.5 rounded-lg border border-border/70 bg-background/95 p-1 shadow-sm backdrop-blur">
              {STROKE_WIDTH_OPTIONS.map((w) => {
                const isCurrentWidth = currentStrokeWidth !== undefined
                  && Math.abs(currentStrokeWidth - w) < 0.5
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      onStrokeWidthChange(w)
                      setShowWidthPicker(false)
                    }}
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                      isCurrentWidth
                        ? 'bg-primary/15 ring-1 ring-primary/50'
                        : 'hover:bg-muted/80',
                    )}
                    title={`Width ${w}`}
                  >
                    <span
                      className="rounded-full bg-foreground"
                      style={{
                        width: `${Math.min(Math.max(w * 1.2, 3), 14)}px`,
                        height: `${Math.min(Math.max(w * 1.2, 3), 14)}px`,
                      }}
                    />
                  </button>
                )
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowDefaultsMenu(v => !v)}
            className={cn(
              'pointer-events-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full transition-colors',
              showDefaultsMenu ? 'bg-primary/15 text-primary' : 'hover:bg-muted/80',
            )}
            title="Pen defaults"
            aria-label="Pen defaults"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>

          {showDefaultsMenu && (
            <div className="pointer-events-auto mt-1 w-48 rounded-lg border border-border/70 bg-background/95 p-2 text-xs shadow-sm backdrop-blur">
              <div className="mb-1.5 font-medium text-foreground">Pen Defaults</div>

              <div className="mb-2">
                <label className="mb-1 block text-muted-foreground">Color</label>
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateDefaults({ strokeColor: color })}
                      className={cn(
                        'h-5 w-5 rounded border border-border/70',
                        penDefaults.strokeColor.toLowerCase() === color ? 'ring-1 ring-primary ring-offset-1 ring-offset-background' : '',
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={penDefaults.strokeColor}
                  onChange={(event) => updateDefaults({ strokeColor: event.target.value })}
                  className="h-7 w-full rounded border border-border/70 bg-background px-1"
                  title="Choose color"
                />
              </div>

              <div className="mb-2">
                <label className="mb-1 block text-muted-foreground">Pointer width</label>
                <div className="flex items-center gap-1">
                  {STROKE_WIDTH_OPTIONS.map((width) => (
                    <button
                      key={width}
                      type="button"
                      onClick={() => updateDefaults({ strokeWidth: width })}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full border border-border/70 text-[10px]',
                        penDefaults.strokeWidth === width ? 'bg-primary/15 ring-1 ring-primary/50' : 'hover:bg-muted/80',
                      )}
                      title={`Width ${width}`}
                    >
                      <span
                        className="rounded-full bg-foreground"
                        style={{
                          width: `${Math.min(Math.max(width * 1.1, 2), 10)}px`,
                          height: `${Math.min(Math.max(width * 1.1, 2), 10)}px`,
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-2">
                <label className="mb-1 block text-muted-foreground">Opacity</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={penDefaults.opacity}
                    onChange={(event) => updateDefaults({ opacity: clampOpacity(Number(event.target.value) || 100) })}
                    className="h-2 w-full"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={penDefaults.opacity}
                    onChange={(event) => updateDefaults({ opacity: clampOpacity(Number(event.target.value) || 100) })}
                    className="h-6 w-12 rounded border border-border/70 bg-background px-1 text-[11px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5">
                <span className="text-muted-foreground">Pressure sensitivity</span>
                <Switch
                  checked={penDefaults.pressureSensitive}
                  onCheckedChange={(checked) => updateDefaults({ pressureSensitive: checked })}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Quick check if a CSS color is light (for text contrast). */
function isLightColor(color: string): boolean {
  if (color === 'transparent') return true
  // Parse simple hex colors
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
  // Named colors / rgb — assume light for yellow-ish, dark for others
  return color.includes('fff') || color.includes('yellow') || color.includes('db')
}
