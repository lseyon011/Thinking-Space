import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  Compass,
  FolderKanban,
  GitBranch,
  KeyRound,
  MessageSquare,
  PlusSquare,
  Sparkles,
  Wrench,
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
import {
  STORAGE_KEYS,
  getJsonStorageItem,
  getStorageItem,
} from '@/services/orchestrators/storageOrch'

interface DrawerNavItem {
  to: string
  label: string
  icon: LucideIcon
}

interface OrganizerProjectEntry {
  root: string
  name: string
}

const CORE_ITEMS: DrawerNavItem[] = [
  { to: '/thinking-space', label: 'Thinking Space', icon: Compass },
  { to: '/new-thought', label: 'New Note', icon: PlusSquare },
  { to: '/chat', label: 'AI', icon: MessageSquare },
  { to: '/thinking-organizer', label: 'Thinking Organizer', icon: FolderKanban },
  { to: '/git-insights', label: 'Insights', icon: GitBranch },
  { to: '/password-manager', label: 'Passwords', icon: KeyRound },
]

const WORKSPACE_ITEMS: DrawerNavItem[] = [
  { to: '/ai-settings', label: 'AI Settings', icon: Bot },
  { to: '/capabilities', label: 'Capabilities', icon: Wrench },
  { to: '/extension-builder', label: 'Extension Builder', icon: Sparkles },
]

const ORGANIZER_TABS = [
  { id: 'backlog', label: 'Create' },
  { id: 'view', label: 'View' },
  { id: 'link', label: 'Link' },
  { id: 'steward', label: 'Steward' },
  { id: 'integrity', label: 'Integrity' },
] as const

function pathIsActive(currentPath: string, itemPath: string): boolean {
  return currentPath === itemPath
}

function DrawerSection({
  title,
  items,
  currentPath,
  onNavigate,
}: {
  title: string
  items: DrawerNavItem[]
  currentPath: string
  onNavigate: (to: string) => void
}) {
  return (
    <section className="space-y-1.5">
      <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathIsActive(currentPath, item.to)
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => onNavigate(item.to)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition-colors',
                active
                  ? 'bg-foreground text-background'
                  : 'text-foreground hover:bg-muted/70',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-background' : 'text-muted-foreground')} />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default function NativeDrawerOrch() {
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
      .catch((error) => {
        console.warn('[NativeDrawerOrch] Failed to read initial drawer state:', error)
      })

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
    }).catch((error) => {
      console.warn('[NativeDrawerOrch] Failed to attach drawer state listener:', error)
    })

    return () => {
      mounted = false
      handleRemoved = true
      void listenerHandle?.remove()
    }
  }, [])

  const currentPath = state.currentPath ?? '/thinking-space'
  const currentTitle = state.title?.trim() || 'Thinking Space'

  const visibleWorkspaceItems = useMemo(() => {
    if (state.currentPath === '/extension-builder') return WORKSPACE_ITEMS
    return WORKSPACE_ITEMS.filter((item) => item.to !== '/extension-builder')
  }, [state.currentPath])

  const organizerSidebarState = useMemo(() => {
    if (currentPath !== '/thinking-organizer' && currentPath !== '/file-organizer') return null

    const params = new URLSearchParams(state.currentSearch ?? '')
    const selectedTab = params.get('tab') ?? getStorageItem(STORAGE_KEYS.thinkingOrganizerTab) ?? 'backlog'
    const selectedProjectRoot = params.get('projectRoot') ?? ''
    const projects = getJsonStorageItem<OrganizerProjectEntry[]>(STORAGE_KEYS.thinkingOrganizerProjects, [])

    return {
      selectedTab,
      selectedProjectRoot,
      projects,
    }
  }, [currentPath, state.currentSearch])

  const handleNavigate = (to: string) => {
    void postNativeDrawerContentActionBlock({
      type: 'navigate',
      payloadJson: JSON.stringify({ to }),
    })
  }

  const handleClose = () => {
    void postNativeDrawerContentActionBlock({ type: 'close' })
  }

  return (
    <div className="flex h-dvh min-h-dvh w-full flex-col bg-[linear-gradient(180deg,#f5f3ee_0%,#f1efe8_100%)] text-foreground">
      <div className="flex items-center justify-between px-4 pb-3 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Navigation
          </div>
          <div className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">
            {currentTitle}
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {organizerSidebarState ? (
          <div className="rounded-[28px] border border-black/5 bg-white/80 p-3 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.45)] backdrop-blur">
            <section className="space-y-1.5">
              <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Thinking Organizer
              </div>
              <div className="space-y-1">
                {ORGANIZER_TABS.map((item) => {
                  const active = organizerSidebarState.selectedTab === item.id
                  const params = new URLSearchParams(state.currentSearch ?? '')
                  params.set('tab', item.id)
                  const projectRoot = organizerSidebarState.selectedProjectRoot.trim()
                  if (projectRoot) params.set('projectRoot', projectRoot)
                  else params.delete('projectRoot')
                  const to = `/thinking-organizer?${params.toString()}`
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(to)}
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

            <section className="mt-5 space-y-1.5 border-t border-black/5 pt-4">
              <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Projects
              </div>
              <div className="space-y-1">
                {organizerSidebarState.projects.map((project) => {
                  const active = organizerSidebarState.selectedProjectRoot === project.root
                  const params = new URLSearchParams(state.currentSearch ?? '')
                  params.set('tab', organizerSidebarState.selectedTab)
                  params.set('projectRoot', project.root)
                  const to = `/thinking-organizer?${params.toString()}`
                  return (
                    <button
                      key={project.root}
                      type="button"
                      onClick={() => handleNavigate(to)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition-colors',
                        active ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted/70',
                      )}
                    >
                      <span className="truncate">{project.name}</span>
                    </button>
                  )
                })}
                {organizerSidebarState.projects.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No projects yet.
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams(state.currentSearch ?? '')
                  params.set('tab', organizerSidebarState.selectedTab)
                  params.set('createProject', '1')
                  handleNavigate(`/thinking-organizer?${params.toString()}`)
                }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-3 py-3 text-sm font-medium text-background transition-colors"
              >
                <span className="text-base leading-none">+</span>
                <span>Create Project</span>
              </button>
            </section>
          </div>
        ) : (
          <div className="space-y-6 rounded-[28px] border border-black/5 bg-white/80 p-3 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.45)] backdrop-blur">
            <DrawerSection
              title="Core"
              items={CORE_ITEMS}
              currentPath={currentPath}
              onNavigate={handleNavigate}
            />

            <DrawerSection
              title="Workspace"
              items={visibleWorkspaceItems}
              currentPath={currentPath}
              onNavigate={handleNavigate}
            />
          </div>
        )}
      </div>
    </div>
  )
}
