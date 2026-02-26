import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InfoPanelToggleButtonBlockProps {
  active: boolean
  onToggle?: () => void
  disabled?: boolean
  title?: string
  className?: string
}

export default function InfoPanelToggleButtonBlock({
  active,
  onToggle,
  disabled = false,
  title = 'Metadata & YAML',
  className,
}: InfoPanelToggleButtonBlockProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'rounded-lg p-1.5 transition-colors',
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      title={title}
    >
      <Info className="h-4 w-4" />
    </button>
  )
}
