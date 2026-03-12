import { useCallback, useState } from 'react'
import { Settings2 } from 'lucide-react'
import type { ExcalidrawHighlighterPresetBlock } from '@/services/orchestrators/excalidrawHighlighterOrch'
import type { ExcalidrawPenDefaultsOrch } from '@/services/orchestrators/excalidrawPenDefaultsOrch'
import { Switch } from '@/components/lego_blocks/units/ui/switch'
import { cn } from '@/lib/utils'

const STROKE_WIDTH_OPTIONS = [1, 2, 4, 8, 12] as const

// Excalidraw color palette — open-color values at shade indexes [0, 2, 4, 6, 8]
// Columns: gray | red | pink | grape | violet | indigo | blue | cyan | teal | green | lime | yellow | orange
const EXCALIDRAW_COLOR_PALETTE: readonly (readonly string[])[] = [
  ['#f8f9fa', '#fff5f5', '#fff0f6', '#f8f0fc', '#f3f0ff', '#edf2ff', '#e7f5ff', '#e3fafc', '#e6fcf5', '#ebfbee', '#f4fce3', '#fff9db', '#fff4e6'],
  ['#dee2e6', '#ffc9c9', '#fcc2d7', '#eebefa', '#d0bfff', '#bac8ff', '#a5d8ff', '#99e9f2', '#96f2d7', '#b2f2bb', '#d8f5a2', '#ffec99', '#ffd8a8'],
  ['#adb5bd', '#ff8787', '#f783ac', '#da77f2', '#9775fa', '#748ffc', '#4dabf7', '#3bc9db', '#38d9a9', '#69db7c', '#a9e34b', '#ffd43b', '#ffa94d'],
  ['#495057', '#f03e3e', '#d6336c', '#be4bdb', '#7048e8', '#4263eb', '#1c7ed6', '#1098ad', '#0ca678', '#40c057', '#74b816', '#f59f00', '#f76707'],
  ['#212529', '#c92a2a', '#a61e4d', '#862e9c', '#5f3dc4', '#364fc7', '#1864ab', '#0b7285', '#087f5b', '#2b8a3e', '#5c940d', '#e67700', '#d9480f'],
]
const NEUTRAL_ROW = ['#ffffff', '#1e1e1e'] as const

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
  perPresetSettings?: Record<string, ExcalidrawPenDefaultsOrch>
}

export default function ExcalidrawPenPaletteBlock({
  presets,
  activePresetId,
  onSelectPreset,
  penDefaults,
  onPenDefaultsChange,
  currentStrokeWidth,
  onStrokeWidthChange,
  perPresetSettings,
}: ExcalidrawPenPaletteBlockProps) {
  const [showWidthPicker, setShowWidthPicker] = useState(false)
  const [showDefaultsMenu, setShowDefaultsMenu] = useState(false)

  const updateDefaults = useCallback((patch: Partial<ExcalidrawPenDefaultsOrch>) => {
    onPenDefaultsChange({ ...penDefaults, ...patch })
  }, [onPenDefaultsChange, penDefaults])

  const penColor = penDefaults.strokeColor

  return (
    <div
      className="absolute z-30"
      style={{
        top: '50%',
        right: 'calc(var(--ltm-safe-right, 0px) + 0.4rem)',
        transform: 'translateY(-50%)',
      }}
    >
      {/* Main palette card — relative so popups can anchor to it */}
      <div className="relative flex flex-col items-center gap-1 rounded-xl border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur">
        {presets.map((preset, index) => {
          const isActive = activePresetId === preset.id
          const penNumber = index + 1
          const customColor = perPresetSettings?.[preset.id]?.strokeColor
          const swatchColor = customColor ?? (
            preset.backgroundColor !== 'transparent' ? preset.backgroundColor : preset.strokeColor
          )
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset.id)}
              className={cn(
                'relative flex h-7 w-7 items-center justify-center rounded-full transition-all',
                isActive
                  ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                  : 'hover:bg-muted/80',
              )}
              title={`Pen ${penNumber}: ${preset.label}`}
              aria-label={`Pen ${penNumber}: ${preset.label}`}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full border border-border/50 text-[8px] font-bold"
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

        {onStrokeWidthChange && (
          <>
            <div className="mx-auto h-px w-4 bg-border/60" />

            {/* Width + color indicator button */}
            <button
              type="button"
              onClick={() => { setShowWidthPicker(v => !v); setShowDefaultsMenu(false) }}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted/80"
              title={`Stroke width: ${currentStrokeWidth ?? '?'} · Color: ${penColor}`}
              aria-label="Change stroke width"
            >
              <span
                className="rounded-full border border-border/40"
                style={{
                  width: `${Math.min(Math.max((currentStrokeWidth ?? 2) * 1.2, 3), 14)}px`,
                  height: `${Math.min(Math.max((currentStrokeWidth ?? 2) * 1.2, 3), 14)}px`,
                  backgroundColor: penColor,
                }}
              />
            </button>

            {/* Settings gear button */}
            <button
              type="button"
              onClick={() => { setShowDefaultsMenu(v => !v); setShowWidthPicker(false) }}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                showDefaultsMenu ? 'bg-primary/15 text-primary' : 'hover:bg-muted/80',
              )}
              title="Pen settings"
              aria-label="Pen settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>

            {/* Width picker — opens to the left of the card */}
            {showWidthPicker && (
              <div className="absolute right-full top-1/2 mr-2 flex -translate-y-1/2 flex-col items-center gap-0.5 rounded-lg border border-border/70 bg-background/95 p-1 shadow-sm backdrop-blur">
                {STROKE_WIDTH_OPTIONS.map((w) => {
                  const isCurrentWidth = currentStrokeWidth !== undefined && Math.abs(currentStrokeWidth - w) < 0.5
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => { onStrokeWidthChange(w); setShowWidthPicker(false) }}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                        isCurrentWidth ? 'bg-primary/15 ring-1 ring-primary/50' : 'hover:bg-muted/80',
                      )}
                      title={`Width ${w}`}
                    >
                      <span
                        className="rounded-full border border-border/40"
                        style={{
                          width: `${Math.min(Math.max(w * 1.2, 3), 14)}px`,
                          height: `${Math.min(Math.max(w * 1.2, 3), 14)}px`,
                          backgroundColor: penColor,
                        }}
                      />
                    </button>
                  )
                })}
              </div>
            )}

            {/* Settings panel — opens to the left of the card, anchored at bottom */}
            {showDefaultsMenu && (
              <div className="absolute bottom-0 right-full mr-2 w-48 rounded-lg border border-border/70 bg-background/95 p-2 text-xs shadow-sm backdrop-blur">
                <div className="mb-1.5 font-medium text-foreground">Pen Settings</div>

                <div className="mb-2">
                  <label className="mb-1 block text-muted-foreground">Color</label>
                  {/* Black / white extras */}
                  <div className="mb-0.5 flex gap-[3px]">
                    {NEUTRAL_ROW.map((color) => (
                      <ColorSwatch
                        key={color}
                        color={color}
                        selected={penDefaults.strokeColor.toLowerCase() === color.toLowerCase()}
                        onClick={() => updateDefaults({ strokeColor: color })}
                      />
                    ))}
                  </div>
                  {/* Excalidraw color grid: 13 cols × 12px + 1px gap = 168px < 176px inner width */}
                  <div className="flex flex-col gap-[1px]">
                    {EXCALIDRAW_COLOR_PALETTE.map((row, rowIndex) => (
                      <div key={rowIndex} className="flex gap-[1px]">
                        {row.map((color) => (
                          <ColorSwatch
                            key={color}
                            color={color}
                            selected={penDefaults.strokeColor.toLowerCase() === color.toLowerCase()}
                            onClick={() => updateDefaults({ strokeColor: color })}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <input
                    type="color"
                    value={penDefaults.strokeColor}
                    onChange={(event) => updateDefaults({ strokeColor: event.target.value })}
                    className="mt-1.5 h-6 w-full rounded border border-border/70 bg-background px-1"
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
                          className="rounded-full border border-border/40"
                          style={{
                            width: `${Math.min(Math.max(width * 1.1, 2), 10)}px`,
                            height: `${Math.min(Math.max(width * 1.1, 2), 10)}px`,
                            backgroundColor: penColor,
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
    </div>
  )
}

function ColorSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-3 w-3 shrink-0 rounded-sm border',
        selected
          ? 'border-primary ring-1 ring-primary ring-offset-1 ring-offset-background'
          : 'border-border/50 hover:border-border',
      )}
      style={{ backgroundColor: color }}
      title={color}
    />
  )
}

function isLightColor(color: string): boolean {
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
