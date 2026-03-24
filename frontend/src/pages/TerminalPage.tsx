import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import TerminalBlock, { releaseTerminalSession } from '@/components/lego_blocks/integrations/TerminalBlock'
import { isElectron } from '@/services/orchestrators/runtimeOrch'
import { useLocation, useNavigate } from 'react-router-dom'

interface TerminalTab {
  id: string
  label: string
  exitCode: number | null
  envPatch?: Record<string, string>
  initialCommand?: string
}

interface TerminalPageSessionState {
  tabs: TerminalTab[]
  activeTabId: string
}

let tabCounter = 1
let terminalPageSessionState: TerminalPageSessionState | null = null

function createTab(): TerminalTab {
  return createNamedTab()
}

function createNamedTab(label?: string, envPatch?: Record<string, string>, initialCommand?: string): TerminalTab {
  return {
    id: `tab-${Date.now()}-${tabCounter++}`,
    label: label?.trim() || `Terminal ${tabCounter - 1}`,
    exitCode: null,
    envPatch,
    initialCommand,
  }
}

function getInitialTerminalPageSessionState(): TerminalPageSessionState {
  if (terminalPageSessionState && terminalPageSessionState.tabs.length > 0) {
    const sessionState = terminalPageSessionState
    const activeTabStillExists = sessionState.tabs.some(tab => tab.id === sessionState.activeTabId)
    const fallbackTab = sessionState.tabs[0]
    return {
      tabs: sessionState.tabs,
      activeTabId: activeTabStillExists ? sessionState.activeTabId : fallbackTab.id,
    }
  }

  const firstTab = createTab()
  return {
    tabs: [firstTab],
    activeTabId: firstTab.id,
  }
}

type EditModeStatus = 'unknown' | 'not-set-up' | 'off' | 'active'

export default function TerminalPage() {
  const initialSessionStateRef = useRef<TerminalPageSessionState>(getInitialTerminalPageSessionState())
  const [tabs, setTabs] = useState<TerminalTab[]>(() => initialSessionStateRef.current.tabs)
  const [activeTabId, setActiveTabId] = useState<string>(() => initialSessionStateRef.current.activeTabId)
  const [defaultCwd, setDefaultCwd] = useState<string | undefined>()
  const [editModeStatus, setEditModeStatus] = useState<EditModeStatus>('unknown')
  const initialized = useRef(false)
  const handledLaunchNonceRef = useRef<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (tabs.length === 0) return
    const nextActiveTabId = tabs.some(tab => tab.id === activeTabId) ? activeTabId : tabs[0].id
    if (nextActiveTabId !== activeTabId) {
      setActiveTabId(nextActiveTabId)
      return
    }
    terminalPageSessionState = { tabs, activeTabId: nextActiveTabId }
  }, [activeTabId, tabs])

  // Resolve default cwd and edit mode status from source config on first render
  useEffect(() => {
    if (initialized.current || !isElectron()) return
    initialized.current = true
    void window.electronAPI?.sourceConfigGet?.().then((config) => {
      if (config.sourcePath) setDefaultCwd(config.sourcePath)
      if (!config.sourcePath) setEditModeStatus('not-set-up')
      else if (config.mode === 'live-source' && config.viteRunning) setEditModeStatus('active')
      else setEditModeStatus('off')
    })
  }, [])

  const addTab = () => {
    const tab = createNamedTab()
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const nonce = params.get('nonce')
    const requestedProfile = params.get('codexProfile')
    if (!nonce || !requestedProfile || handledLaunchNonceRef.current === nonce) return

    handledLaunchNonceRef.current = nonce
    const requestedLabel = params.get('label')?.trim()
    const requestedHome = params.get('codexHome')?.trim()
    const initialCommand = params.get('initialCommand')?.trim()
    const tab = createNamedTab(
      requestedLabel ? `Codex · ${requestedLabel}` : 'Codex Terminal',
      requestedHome ? { CODEX_HOME: requestedHome } : undefined,
      initialCommand || undefined,
    )
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
    navigate('/terminal', { replace: true })
  }, [location.search, navigate])

  const closeTab = (id: string) => {
    // Kill the PTY for this tab before removing it
    releaseTerminalSession(id)
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (next.length === 0) {
        // Always keep at least one tab
        const fresh = createTab()
        setActiveTabId(fresh.id)
        return [fresh]
      }
      if (activeTabId === id) {
        setActiveTabId(next[next.length - 1].id)
      }
      return next
    })
  }

  const markExited = (id: string, exitCode: number) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, exitCode } : t))
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#1e1e1e]">
      {/* Edit mode banner */}
      {editModeStatus === 'active' && (
        <div className="shrink-0 flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-950/40 px-4 py-2 text-xs text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span>Edit Mode is active — run <code className="rounded bg-white/10 px-1">claude</code> to modify this app live</span>
        </div>
      )}
      {editModeStatus === 'off' && (
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-white/5 bg-white/3 px-4 py-2 text-xs text-white/40">
          <span>Tip: You can modify this app with Claude Code. Set up Edit Mode to see changes live.</span>
          <button
            type="button"
            onClick={() => navigate('/settings?tab=developer')}
            className="shrink-0 text-white/60 underline hover:text-white/80 transition-colors"
          >
            Set up →
          </button>
        </div>
      )}
      {editModeStatus === 'not-set-up' && (
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-white/5 bg-white/3 px-4 py-2 text-xs text-white/40">
          <span>Tip: This app ships with its own source code. Use Claude Code here to change anything.</span>
          <button
            type="button"
            onClick={() => navigate('/settings?tab=developer')}
            className="shrink-0 text-white/60 underline hover:text-white/80 transition-colors"
          >
            Learn more →
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex shrink-0 items-center border-b border-white/10 bg-[#252526]">
        <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTabId(tab.id)}
              className={[
                'group flex shrink-0 items-center gap-1.5 border-r border-white/10 px-3 py-1.5 text-xs transition-colors',
                tab.id === activeTabId
                  ? 'bg-[#1e1e1e] text-white'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80',
                tab.exitCode !== null ? 'opacity-60' : '',
              ].join(' ')}
            >
              <span className="max-w-32 truncate">{tab.label}</span>
              {tab.exitCode !== null && (
                <span className="rounded bg-white/10 px-1 py-0.5 text-[10px] text-white/40">
                  {tab.exitCode}
                </span>
              )}
              <span
                role="button"
                tabIndex={-1}
                aria-label="Close tab"
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                className="rounded p-0.5 opacity-0 transition-opacity hover:bg-white/20 group-hover:opacity-100"
              >
                <X className="h-2.5 w-2.5" />
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={addTab}
          title="New terminal"
          className="shrink-0 px-2 py-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Terminal panels — all mounted, only active one visible */}
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="absolute inset-0"
            style={{ visibility: tab.id === activeTabId ? 'visible' : 'hidden' }}
          >
            <TerminalBlock
              cwd={defaultCwd}
              envPatch={tab.envPatch}
              initialCommand={tab.initialCommand}
              sessionKey={tab.id}
              className="h-full w-full px-1 pt-1"
              onExit={(code) => markExited(tab.id, code)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
