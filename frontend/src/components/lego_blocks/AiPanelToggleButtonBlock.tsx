import { cn } from '@/lib/utils'

interface AiPanelToggleButtonBlockProps {
  active: boolean
  onToggle?: () => void
  disabled?: boolean
  title?: string
  label?: string
  className?: string
}

export default function AiPanelToggleButtonBlock({
  active,
  onToggle,
  disabled = false,
  title = 'Toggle AI panel',
  label = 'AI',
  className,
}: AiPanelToggleButtonBlockProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'rounded-lg px-2 py-1 text-xs font-medium transition-colors',
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      title={title}
    >
      {label}
    </button>
  )
}
