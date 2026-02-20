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
    <div className={cn('ltm-shell-tabs ltm-shell-motion-capsule', className)} style={{ containerType: 'inline-size' }}>
      <div className="ltm-tab-center-row inline-flex min-w-0 max-w-full items-center gap-1.5">
        <div className="ltm-tab-scroll-track min-w-0 max-w-full overflow-x-auto">
          <div className="ltm-tab-scroll-inner inline-flex w-max items-center gap-0.5 pr-1">
            {tabs.map((tab) => {
              const active = tab.id === activeTabId
              const canClose = tabs.length > 1
              return (
                <div
                  key={tab.id}
                  className={cn(
                    'ltm-tab-item ltm-tab-fade group inline-flex h-7 max-w-[220px] items-center gap-1 rounded-full border px-2 transition-colors',
                    active
                      ? 'ltm-tab-active border-border/60 bg-background/90 text-foreground'
                      : 'border-transparent bg-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectTab(tab.id)}
                    className="min-w-0 flex-1 truncate text-left text-[11px] font-medium"
                    title={tab.label}
                    aria-current={active ? 'page' : undefined}
                  >
                    {tab.label}
                  </button>
                  {canClose && (
                    <button
                      type="button"
                      onClick={() => onCloseTab(tab.id)}
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      aria-label={`Close ${tab.label} tab`}
                    >
                      <X className="h-3 w-3" />
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
          className="ltm-motion-fast ltm-touch-target inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Create new app tab"
          title="New tab"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
