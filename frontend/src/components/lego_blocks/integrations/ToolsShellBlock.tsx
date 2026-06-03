import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bot, KeyRound, Terminal as TerminalIcon, Wrench } from 'lucide-react'
import excalidrawLogo from '@/assets/excalidraw-logo.svg'
import { isExcalidrawPlusRoute } from '@/components/lego_blocks/units/ExcalidrawPlusRoutesBlock'
import { isEmbeddedTerminalSupported } from '@/services/orchestrators/runtimeOrch'
import { useSessionStateBlock } from '@/components/lego_blocks/hooks/shared/useSessionStateBlock'
import { useUILayoutBlock } from '@/components/lego_blocks/hooks/shared/useUILayoutBlock'
import { useNativeBackHandlerBlock } from '@/components/lego_blocks/hooks/shared/useNativeBackHandlerBlock'
import { isCapacitorNative } from '@/services/lego_blocks/integrations/fsBlock'
import {
  pushNativeWithForwardBlock,
  setNativeNavigationStackBlock,
} from '@/services/lego_blocks/units/topChromeNativeBridgeBlock'
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
  const navigate = useNavigate()
  const { layout } = useUILayoutBlock()
  const isIPhoneIosSurface = layout.surface === 'capacitor-ios' && layout.mode === 'phone'

  const visibleSubtabs = useMemo(
    () => TOOL_SUBTABS.filter(tab => (tab.visible ? tab.visible() : true)),
    [],
  )
  const [sidebarCollapsed, setSidebarCollapsed] = useSessionStateBlock('tools-sidebar-collapsed', false)

  // iPhone list/detail mode. On entering the Tools rail tab, the user lands
  // on the list page (sidebar full-screen); tapping a tool pushes them to
  // its detail page (content full-screen, no sidebar). Reset to list when
  // we detect "external" navigation (rail tap, deep link), distinguished
  // from our own intentional push via lastPushedPathRef.
  const [phonePickedTool, setPhonePickedTool] = useState(false)
  const lastPushedPathRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isIPhoneIosSurface) return
    if (location.pathname === lastPushedPathRef.current) {
      lastPushedPathRef.current = null  // consume the marker
      return
    }
    // External navigation (rail tap re-entered Tools, etc.) — reset to list.
    setPhonePickedTool(false)
  }, [location.pathname, isIPhoneIosSurface])

  const phoneListMode = isIPhoneIosSurface && !phonePickedTool
  const phoneDetailMode = isIPhoneIosSurface && phonePickedTool

  // Cascade back handler — when user presses native back chevron / edge-swipe,
  // return to the tools list (full-screen sidebar). React renders the same
  // Outlet underneath but it's hidden by the list layout.
  useNativeBackHandlerBlock({
    active: phoneDetailMode,
    onBack: () => {
      setPhonePickedTool(false)
    },
  })

  const handlePhoneToolTap = useCallback((to: string) => (e: React.MouseEvent) => {
    if (!(isCapacitorNative() && isIPhoneIosSurface)) return
    e.preventDefault()
    lastPushedPathRef.current = to
    void (async () => {
      try {
        await setNativeNavigationStackBlock(['/personal-tools'])
        await pushNativeWithForwardBlock('/personal-tools', () => {
          setPhonePickedTool(true)
          navigate(to)
        })
      } catch (err) {
        console.warn('[ToolsShell] phone push failed, falling back to navigate', err)
        setPhonePickedTool(true)
        navigate(to)
      }
    })()
  }, [isIPhoneIosSurface, navigate])

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
      {/* On iPhone, the desktop collapse state is ignored — list/detail mode
          is the sole authority. Sidebar always shows in list mode. */}
      {((phoneListMode || !sidebarCollapsed) && !phoneDetailMode) && (
      <aside className={`ltm-tools-shell-nav border-border/60 bg-background/40 px-3 py-4 ${phoneListMode ? 'flex-1' : 'w-[220px] shrink-0 border-r'}`}>
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
                onClick={handlePhoneToolTap(tab.to)}
                className={`ltm-motion-fast flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  active && !phoneListMode
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
      <div className={`ltm-tools-shell-content min-w-0 overflow-auto ${phoneListMode ? 'hidden' : 'flex-1'}`}>
        <Outlet />
      </div>
    </div>
  )
}
