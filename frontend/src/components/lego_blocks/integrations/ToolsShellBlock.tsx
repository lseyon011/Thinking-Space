import { useEffect, useMemo, type ComponentType } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Bot, KeyRound, Terminal as TerminalIcon, Wrench } from 'lucide-react'
import excalidrawLogo from '@/assets/excalidraw-logo.svg'
import { isExcalidrawPlusRoute } from '@/components/lego_blocks/units/ExcalidrawPlusRoutesBlock'
import { isEmbeddedTerminalSupported } from '@/services/orchestrators/runtimeOrch'
import { useSessionStateBlock } from '@/components/lego_blocks/hooks/shared/useSessionStateBlock'
import {
  dispatchToolsSidebarChromeStateBlock,
  TOOLS_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK,
} from '@/services/lego_blocks/units/toolsSidebarChromeBlock'

interface ToolsSubtab {
  id: string
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
  isActive: (pathname: string) => boolean
  visible?: () => boolean
}

function ExcalidrawPlusIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-block`}
      style={{
        backgroundColor: 'currentColor',
        maskImage: `url(${excalidrawLogo})`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskImage: `url(${excalidrawLogo})`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
      }}
    />
  )
}

const TOOL_SUBTABS: readonly ToolsSubtab[] = [
  {
    id: 'excalidraw-plus',
    label: 'Excalidraw++',
    to: '/excalidraw-plus',
    icon: ExcalidrawPlusIcon,
    isActive: isExcalidrawPlusRoute,
  },
  {
    id: 'capabilities',
    label: 'AI Capabilities',
    to: '/capabilities',
    icon: Bot,
    isActive: (pathname) => pathname === '/capabilities' || pathname === '/extension-builder',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    to: '/terminal',
    icon: TerminalIcon,
    isActive: (pathname) => pathname === '/terminal',
    visible: () => isEmbeddedTerminalSupported(),
  },
  {
    id: 'password-manager',
    label: 'Passwords',
    to: '/password-manager',
    icon: KeyRound,
    isActive: (pathname) => pathname === '/password-manager',
  },
  {
    id: 'personal-tools',
    label: 'Heading Assignments',
    to: '/personal-tools',
    icon: Wrench,
    isActive: (pathname) => pathname === '/personal-tools' || pathname === '/personal-extension',
  },
]

export function isToolsShellRoute(pathname: string): boolean {
  return TOOL_SUBTABS.some(tab => tab.isActive(pathname))
}

export default function ToolsShellBlock() {
  const location = useLocation()
  const visibleSubtabs = useMemo(
    () => TOOL_SUBTABS.filter(tab => (tab.visible ? tab.visible() : true)),
    [],
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useSessionStateBlock('tools-sidebar-collapsed', false)

  useEffect(() => {
    dispatchToolsSidebarChromeStateBlock({ enabled: true, collapsed: sidebarCollapsed, label: 'Tools' })
    return () => {
      dispatchToolsSidebarChromeStateBlock({ enabled: false, collapsed: false, label: 'Tools' })
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    const handler = () => setSidebarCollapsed(prev => !prev)
    window.addEventListener(TOOLS_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK, handler)
    return () => window.removeEventListener(TOOLS_SIDEBAR_CHROME_TOGGLE_EVENT_BLOCK, handler)
  }, [setSidebarCollapsed])

  return (
    <div className="ltm-tools-shell flex h-full min-h-0 w-full">
      {!sidebarCollapsed && (
      <aside className="ltm-tools-shell-nav w-[220px] shrink-0 border-r border-border/60 bg-background/40 px-3 py-4">
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Tools
        </p>
        <nav className="space-y-1">
          {visibleSubtabs.map((tab) => {
            const Icon = tab.icon
            const active = tab.isActive(location.pathname)
            return (
              <Link
                key={tab.id}
                to={tab.to}
                className={`ltm-motion-fast flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{tab.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
      )}
      <div className="ltm-tools-shell-content min-w-0 flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
