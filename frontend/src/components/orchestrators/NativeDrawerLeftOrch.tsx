import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bot,
  Compass,
  FileText,
  FolderKanban,
  Globe,
  Loader2,
  PlusSquare,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  addNativeDrawerContentStateListenerBlock,
  getNativeDrawerContentStateBlock,
  postNativeDrawerContentActionBlock,
  type NativeDrawerContentStateBlock,
} from '@/services/lego_blocks/units/nativeDrawerContentBlock'
import { listFolderEntries } from '@/services/orchestrators/fileSystemOrch'
import VaultExplorerBlock from '@/components/lego_blocks/integrations/VaultExplorerBlock'
import WebSitePanelBlock from '@/components/lego_blocks/integrations/WebSitePanelBlock'
import { readWebSitePreferencesOrch } from '@/services/orchestrators/webSiteOrch'
import type { WebSitePreferencesBlock } from '@/services/lego_blocks/units/webSiteBlock'
import { listProvidersOrch, type AiProviderStatus } from '@/services/orchestrators/chatOrch'
import { readAiWebsitesOrch } from '@/services/orchestrators/aiWebsiteOrch'
import type { AiWebsiteBlock } from '@/services/lego_blocks/units/aiWebsiteBlock'
import SidebarGroupHeaderBlock from '@/components/lego_blocks/units/ui/SidebarGroupHeaderBlock'
import { useExpandedSetBlock } from '@/components/lego_blocks/hooks/shared/useExpandedSetBlock'
import {
  STORAGE_KEYS,
  getJsonStorageItem,
  getStorageItem,
} from '@/services/orchestrators/storageOrch'

// ── Organizer sidebar types ──

interface OrganizerProjectEntry {
  root: string
  name: string
}

const ORGANIZER_TABS = [
  { id: 'backlog', label: 'Create' },
  { id: 'view', label: 'View' },
  { id: 'link', label: 'Link' },
  { id: 'steward', label: 'Steward' },
  { id: 'integrity', label: 'Integrity' },
] as const

// ── Quick destination shortcuts for New Thought ──

const QUICK_DESTINATIONS: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'thoughts', label: 'Thoughts', icon: FileText },
  { id: 'meetings', label: 'Meetings', icon: FolderKanban },
  { id: 'todo', label: 'To Do', icon: PlusSquare },
]

// ── Route → sidebar label ──

function sidebarLabelForPath(path: string, fallback: string): string {
  switch (path) {
    case '/thinking-space': return 'Explorer'
    case '/thinking-organizer': return 'Organizer'
    case '/chat': return 'AI'
    case '/web': return 'Web'
    case '/new-thought': return 'New Note'
    case '/git-insights': return 'Insights'
    case '/password-manager': return 'Passwords'
    default: return fallback
  }
}

// ── Sub-panels ──

function ThinkingSpacePanel({ onAction }: { onAction: (type: string, payload?: Record<string, string>) => void }) {
  const handleOpenFile = useCallback((path: string) => {
    onAction('open-file', { path })
  }, [onAction])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <VaultExplorerBlock
        loadEntries={listFolderEntries}
        onOpenFile={handleOpenFile}
        title=""
      />
    </div>
  )
}

function ChatPanel({ onAction }: { onAction: (type: string, payload?: Record<string, string>) => void }) {
  const [providers, setProviders] = useState<AiProviderStatus[]>([])
  const [aiWebsites, setAiWebsites] = useState<AiWebsiteBlock[]>([])
  const [loading, setLoading] = useState(true)
  const { isExpanded, toggle } = useExpandedSetBlock('ltm-drawer-chat-sections', ['tools', 'api', 'web'])

  useEffect(() => {
    Promise.all([
      listProvidersOrch().then(setProviders),
      readAiWebsitesOrch().then(setAiWebsites),
    ])
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Detecting providers…
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <SidebarGroupHeaderBlock
        name="Tools"
        expanded={isExpanded('tools')}
        onToggle={() => toggle('tools')}
        badge={1}
      />
      {isExpanded('tools') && (
        <button
          type="button"
          onClick={() => onAction('select-ai', { provider: '__usage_dashboard__' })}
          className="flex w-full items-center border-b border-border/40 px-3 py-2.5 text-left text-xs text-foreground transition-colors hover:bg-muted/40"
          style={{ paddingLeft: '24px' }}
        >
          <span className="truncate">Usage Dashboard</span>
        </button>
      )}

      {providers.length > 0 && (
        <>
          <SidebarGroupHeaderBlock
            name="API"
            expanded={isExpanded('api')}
            onToggle={() => toggle('api')}
            badge={providers.length}
          />
          {isExpanded('api') && providers.map((p) => (
            <button
              key={p.provider}
              type="button"
              disabled={!p.available}
              onClick={() => onAction('select-ai', { provider: p.provider })}
              className={cn(
                'flex w-full items-center border-b border-border/40 px-3 py-2.5 text-left text-xs transition-colors',
                p.available ? 'text-foreground hover:bg-muted/40' : 'cursor-not-allowed text-muted-foreground/50',
              )}
              style={{ paddingLeft: '24px' }}
            >
              <span className="truncate">{p.label}</span>
              {!p.available && <span className="ml-1 shrink-0 text-[10px] opacity-60">off</span>}
            </button>
          ))}
        </>
      )}

      {aiWebsites.length > 0 && (
        <>
          <SidebarGroupHeaderBlock
            name="Web"
            expanded={isExpanded('web')}
            onToggle={() => toggle('web')}
            badge={aiWebsites.length}
          />
          {isExpanded('web') && aiWebsites.map((site) => (
            <button
              key={site.id}
              type="button"
              onClick={() => onAction('select-ai-website', { siteId: site.id })}
              className="flex w-full items-center border-b border-border/40 px-3 py-2.5 text-left text-xs text-foreground transition-colors hover:bg-muted/40"
              style={{ paddingLeft: '24px' }}
            >
              <span className="truncate">{site.name}</span>
            </button>
          ))}
        </>
      )}

      {providers.length === 0 && aiWebsites.length === 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          No providers. Check AI Settings.
        </div>
      )}
    </div>
  )
}

function OrganizerPanel({
  currentSearch,
  onAction,
}: {
  currentSearch: string
  onAction: (type: string, payload?: Record<string, string>) => void
}) {
  const params = useMemo(() => new URLSearchParams(currentSearch), [currentSearch])
  const selectedTab = params.get('tab') ?? getStorageItem(STORAGE_KEYS.thinkingOrganizerTab) ?? 'backlog'
  const selectedProjectRoot = params.get('projectRoot') ?? ''
  const projects = useMemo(
    () => getJsonStorageItem<OrganizerProjectEntry[]>(STORAGE_KEYS.thinkingOrganizerProjects, []),
    [],
  )

  const navigateOrganizer = (tab: string, projectRoot?: string) => {
    const p = new URLSearchParams(currentSearch)
    p.set('tab', tab)
    if (projectRoot !== undefined) {
      if (projectRoot) p.set('projectRoot', projectRoot)
      else p.delete('projectRoot')
    }
    onAction('navigate', { to: `/thinking-organizer?${p.toString()}` })
  }

  return (
    <div className="space-y-5">
      <section className="space-y-1.5">
        <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Tabs
        </div>
        <div className="space-y-1">
          {ORGANIZER_TABS.map((item) => {
            const active = selectedTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateOrganizer(item.id, selectedProjectRoot)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition-colors',
                  active ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted/70',
                )}
              >
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-1.5 border-t border-black/5 pt-4">
        <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Projects
        </div>
        <div className="space-y-1">
          {projects.map((project) => {
            const active = selectedProjectRoot === project.root
            return (
              <button
                key={project.root}
                type="button"
                onClick={() => navigateOrganizer(selectedTab, project.root)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition-colors',
                  active ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted/70',
                )}
              >
                <span className="truncate">{project.name}</span>
              </button>
            )
          })}
          {projects.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No projects yet.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function WebPanel({ onAction }: { onAction: (type: string, payload?: Record<string, string>) => void }) {
  const [prefs, setPrefs] = useState<WebSitePreferencesBlock>({ bookmarks: [], groups: [] })

  useEffect(() => {
    void readWebSitePreferencesOrch().then(setPrefs)
  }, [])

  return (
    <WebSitePanelBlock
      bookmarks={prefs.bookmarks}
      groups={prefs.groups}
      selectedSiteId={null}
      onSelectSite={(site) => onAction('select-web-site', { siteId: site.id })}
      onClose={() => onAction('close')}
    />
  )
}

function NewThoughtPanel({ onAction }: { onAction: (type: string, payload?: Record<string, string>) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Quick Destinations
      </div>
      <div className="space-y-1">
        {QUICK_DESTINATIONS.map((dest) => {
          const Icon = dest.icon
          return (
            <button
              key={dest.id}
              type="button"
              onClick={() => onAction('new-thought-destination', { destination: dest.id })}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted/70"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{dest.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DefaultPanel({ currentPath }: { currentPath: string }) {
  const icon = (() => {
    switch (currentPath) {
      case '/ai-settings': return Bot
      case '/git-insights': return Compass
      default: return Globe
    }
  })()
  const Icon = icon

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-xs text-muted-foreground">
        No sidebar content for this view.
      </p>
    </div>
  )
}

// ── Main left drawer orchestrator ──

export default function NativeDrawerLeftOrch() {
  const [state, setState] = useState<NativeDrawerContentStateBlock>({
    kind: 'app-nav',
    title: 'Thinking Space',
    currentPath: '/thinking-space',
    currentSearch: '',
    isOpen: false,
  })

  useEffect(() => {
    let mounted = true
    void getNativeDrawerContentStateBlock()
      .then((nextState) => {
        if (mounted) setState(nextState)
      })
      .catch(() => {})

    let handleRemoved = false
    let listenerHandle: { remove: () => Promise<void> } | null = null
    void addNativeDrawerContentStateListenerBlock((nextState) => {
      setState((previous) => ({ ...previous, ...nextState }))
    }).then((handle) => {
      if (handleRemoved) {
        void handle.remove()
        return
      }
      listenerHandle = handle
    }).catch(() => {})

    return () => {
      mounted = false
      handleRemoved = true
      void listenerHandle?.remove()
    }
  }, [])

  const currentPath = state.currentPath ?? '/thinking-space'
  const currentSearch = state.currentSearch ?? ''
  const label = sidebarLabelForPath(currentPath, state.title?.trim() || 'Sidebar')

  const handleAction = useCallback((type: string, payload?: Record<string, string>) => {
    void postNativeDrawerContentActionBlock({
      type,
      payloadJson: payload ? JSON.stringify(payload) : undefined,
    })
  }, [])

  const handleClose = () => {
    void postNativeDrawerContentActionBlock({ type: 'close' })
  }

  const isExplorer = currentPath === '/thinking-space'
  const isWeb = currentPath === '/web'

  // When embedded in a native SwiftUI drawer shell, the header is rendered natively.
  // Skip the React header to avoid duplication.
  const isEmbedded = typeof (globalThis as Record<string, unknown>).__LTM_NATIVE_DRAWER_EMBEDDED__ === 'boolean'
    && (globalThis as Record<string, unknown>).__LTM_NATIVE_DRAWER_EMBEDDED__ === true

  return (
    <div className="flex h-dvh min-h-dvh w-full flex-col bg-[linear-gradient(180deg,#f5f3ee_0%,#f1efe8_100%)] text-foreground">
      {!isEmbedded && !isWeb && (
        <div className="flex items-center justify-between px-4 pb-3 pt-[max(env(safe-area-inset-top),1rem)]">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Sidebar
            </div>
            <div className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">
              {label}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {!isEmbedded && isWeb && <div className="pt-[max(env(safe-area-inset-top),0.5rem)]" />}

      {isExplorer ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ThinkingSpacePanel onAction={handleAction} />
        </div>
      ) : isWeb ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <WebPanel onAction={handleAction} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="rounded-[28px] border border-black/5 bg-white/80 p-3 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.45)] backdrop-blur">
            {currentPath === '/chat' && <ChatPanel onAction={handleAction} />}
            {currentPath === '/thinking-organizer' && (
              <OrganizerPanel currentSearch={currentSearch} onAction={handleAction} />
            )}
            {currentPath === '/new-thought' && <NewThoughtPanel onAction={handleAction} />}
            {currentPath !== '/chat' && currentPath !== '/thinking-organizer' && currentPath !== '/new-thought' && (
              <DefaultPanel currentPath={currentPath} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
