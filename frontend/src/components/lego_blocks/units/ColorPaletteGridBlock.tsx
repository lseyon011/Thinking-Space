import { cn } from '@/lib/utils'
import { normalizeHexColorBlock } from '@/services/lego_blocks/units/tagBlock'

// Excalidraw color palette — open-color values at shade indexes [0, 2, 4, 6, 8]
// Columns: gray | red | pink | grape | violet | indigo | blue | cyan | teal | green | lime | yellow | orange
const EXCALIDRAW_COLOR_PALETTE_BLOCK: readonly (readonly string[])[] = [
  ['#f8f9fa', '#fff5f5', '#fff0f6', '#f8f0fc', '#f3f0ff', '#edf2ff', '#e7f5ff', '#e3fafc', '#e6fcf5', '#ebfbee', '#f4fce3', '#fff9db', '#fff4e6'],
  ['#dee2e6', '#ffc9c9', '#fcc2d7', '#eebefa', '#d0bfff', '#bac8ff', '#a5d8ff', '#99e9f2', '#96f2d7', '#b2f2bb', '#d8f5a2', '#ffec99', '#ffd8a8'],
  ['#adb5bd', '#ff8787', '#f783ac', '#da77f2', '#9775fa', '#748ffc', '#4dabf7', '#3bc9db', '#38d9a9', '#69db7c', '#a9e34b', '#ffd43b', '#ffa94d'],
  ['#495057', '#f03e3e', '#d6336c', '#be4bdb', '#7048e8', '#4263eb', '#1c7ed6', '#1098ad', '#0ca678', '#40c057', '#74b816', '#f59f00', '#f76707'],
  ['#212529', '#c92a2a', '#a61e4d', '#862e9c', '#5f3dc4', '#364fc7', '#1864ab', '#0b7285', '#087f5b', '#2b8a3e', '#5c940d', '#e67700', '#d9480f'],
] as const

const NEUTRAL_ROW_BLOCK = ['#ffffff', '#1e1e1e'] as const

interface ColorPaletteGridBlockProps {
  value: string
  onChange: (nextColor: string) => void
  className?: string
  showNativeInput?: boolean
  inputClassName?: string
}

export default function ColorPaletteGridBlock({
  value,
  onChange,
  className,
  showNativeInput = true,
  inputClassName,
}: ColorPaletteGridBlockProps) {
  const selectedColor = (normalizeHexColorBlock(value) ?? value).toLowerCase()

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex gap-[3px]">
        {NEUTRAL_ROW_BLOCK.map((color) => (
          <ColorSwatchButtonBlock
            key={color}
            color={color}
            selected={selectedColor === color.toLowerCase()}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-[1px]">
        {EXCALIDRAW_COLOR_PALETTE_BLOCK.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-[1px]">
            {row.map((color) => (
              <ColorSwatchButtonBlock
                key={color}
                color={color}
                selected={selectedColor === color.toLowerCase()}
                onClick={() => onChange(color)}
              />
            ))}
          </div>
        ))}
      </div>
      {showNativeInput && (
        <input
          type="color"
          value={normalizeHexColorBlock(value) ?? '#0ea5e9'}
          onChange={(event) => onChange(event.target.value)}
          className={cn('h-6 w-full rounded border border-border/70 bg-background px-1', inputClassName)}
          title="Choose color"
        />
      )}
    </div>
  )
}

function ColorSwatchButtonBlock({
  color,
  selected,
  onClick,
}: {
  color: string
  selected: boolean
  onClick: () => void
}) {
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
