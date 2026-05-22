import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface SubNavTabItem {
  to: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

interface SubNavTabsBlockProps {
  tabs: SubNavTabItem[]
  className?: string
  ariaLabel?: string
}

export default function SubNavTabsBlock({ tabs, className, ariaLabel }: SubNavTabsBlockProps) {
  const location = useLocation()
  const pathname = location.pathname

  return (
    <nav
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 text-sm',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.to || pathname.startsWith(`${tab.to}/`)
        const Icon = tab.icon
        return (
          <Link
            key={tab.to}
            to={tab.to}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'ltm-motion-fast inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
