import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AppWorkspaceTabBlockModel {
  id: string
  label: string
}

interface AppTabsBlockProps {
  tabs: AppWorkspaceTabBlockModel[]
  activeTabId: string
  onSelectTab: (tabId: string) => void
  onCreateTab: () => void
  onCloseTab: (tabId: string) => void
  className?: string
}

export default function AppTabsBlock({
  tabs,
  activeTabId,
  onSelectTab,
  onCreateTab,
  onCloseTab,
  className,
}: AppTabsBlockProps) {
  return (
    <div className={cn('border-b border-border/60 bg-card/40', className)}>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="inline-flex min-w-full items-center gap-1">
            {tabs.map((tab) => {
              const active = tab.id === activeTabId
              const canClose = tabs.length > 1
              return (
                <div
                  key={tab.id}
                  className={cn(
                    'group inline-flex h-8 max-w-[260px] items-center gap-1 rounded-md border px-2 transition-colors',
                    active
                      ? 'border-border bg-background text-foreground'
                      : 'border-transparent bg-transparent text-muted-foreground hover:border-border/60 hover:bg-background/70 hover:text-foreground',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectTab(tab.id)}
                    className="min-w-0 flex-1 truncate text-left text-xs font-medium"
                    title={tab.label}
                    aria-current={active ? 'page' : undefined}
                  >
                    {tab.label}
                  </button>
                  {canClose && (
                    <button
                      type="button"
                      onClick={() => onCloseTab(tab.id)}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Close ${tab.label} tab`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={onCreateTab}
          className="ltm-motion-fast ltm-touch-target inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground hover:text-foreground"
          aria-label="Create new app tab"
          title="New tab"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
