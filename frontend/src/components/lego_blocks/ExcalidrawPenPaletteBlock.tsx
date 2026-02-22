import type { ExcalidrawHighlighterPresetBlock } from '@/services/orchestrators/excalidrawHighlighterOrch'
import { cn } from '@/lib/utils'

interface ExcalidrawPenPaletteBlockProps {
  presets: readonly ExcalidrawHighlighterPresetBlock[]
  activePresetId: string | null
  onSelectPreset: (presetId: string) => void
}

export default function ExcalidrawPenPaletteBlock({
  presets,
  activePresetId,
  onSelectPreset,
}: ExcalidrawPenPaletteBlockProps) {
  return (
    <div
      className="pointer-events-none absolute z-30 flex max-h-[72vh] w-[12.5rem] -translate-y-1/2 flex-col gap-0.5 overflow-y-auto rounded-xl border border-border/70 bg-background/90 p-1.5 shadow-sm backdrop-blur"
      style={{
        top: '50%',
        right: 'calc(var(--ltm-safe-right, 0px) + 0.55rem)',
      }}
    >
      <span className="px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Pens
      </span>
      {presets.map((preset, index) => {
        const isActive = activePresetId === preset.id
        const penNumber = index + 1
        const swatchColor = preset.backgroundColor !== 'transparent'
          ? preset.backgroundColor
          : preset.strokeColor
        const isHighlighter = preset.strokeOptions.highlighter
        const widthLabel = preset.strokeWidth > 0
          ? preset.strokeWidth.toString()
          : ''
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(preset.id)}
            className={cn(
              'pointer-events-auto inline-flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-[11px] transition-colors',
              isActive
                ? 'border-primary/70 bg-primary/15 text-foreground'
                : 'border-border/70 bg-background text-muted-foreground hover:bg-muted',
            )}
            title={`Pen ${penNumber}: ${preset.label}${isHighlighter ? ' (highlighter)' : ''}${preset.freedrawOnly ? ' · draw only' : ''}${widthLabel ? ` · width ${widthLabel}` : ''}`}
            aria-label={`Pen ${penNumber}: ${preset.label}`}
          >
            <span className={cn(
              'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[9px] font-bold',
              isActive
                ? 'bg-primary/25 text-primary'
                : 'bg-muted/80 text-muted-foreground',
            )}>
              {penNumber <= 9 ? penNumber : 0}
            </span>
            <span
              className="inline-block h-3 w-3 flex-shrink-0 rounded-sm border border-border/60"
              style={{ backgroundColor: swatchColor }}
            />
            <span className="min-w-0 flex-1 truncate text-left">{preset.label}</span>
            <span className="inline-flex flex-shrink-0 items-center gap-0.5">
              {isHighlighter && (
                <span className="rounded border border-yellow-500/50 bg-yellow-500/15 px-0.5 text-[8px] font-semibold uppercase text-yellow-600 dark:text-yellow-400">
                  H
                </span>
              )}
              {preset.freedrawOnly && !isHighlighter && (
                <span className="rounded border border-border/50 px-0.5 text-[8px] uppercase text-muted-foreground">
                  D
                </span>
              )}
              {widthLabel && (
                <span className="text-[9px] tabular-nums text-muted-foreground/70">
                  {widthLabel}
                </span>
              )}
            </span>
          </button>
        )
      })}
      {activePresetId === 'custom' && (
        <span className="rounded-md border border-dashed border-border/60 bg-background px-1.5 py-1 text-center text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Custom settings
        </span>
      )}
    </div>
  )
}
