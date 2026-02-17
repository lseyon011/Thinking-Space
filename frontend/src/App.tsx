import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Home from './pages/Home'
import FormatExcalidraw from './pages/FormatExcalidraw'
import ExcalidrawPlugin from './pages/ExcalidrawPlugin'
import PdfToMarkdown from './pages/PdfToMarkdown'
import GitInsights from './pages/GitInsights'
import TranscriptCleaner from './pages/TranscriptCleaner'
import NewThought from './pages/NewThought'
import Todos from './pages/Todos'
import ThinkingSpace from './pages/ThinkingSpace'
import ThinkingOrganizer from './pages/ThinkingOrganizer'
import Chat from './pages/Chat'
import CapabilityDiscovery from './pages/CapabilityDiscovery'
import VaultSetup from './components/orchestrators/VaultSetupOrch'
import { isElectron, setVaultRoot } from './services/orchestrators/runtimeOrch'
import { smartSync } from './services/orchestrators/vaultSyncOrch'
import { getStoredVaultRoot } from './services/lego_blocks/storageKeyBlock'

function App() {
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path
  const [showTools, setShowTools] = useState(false)
  const [needsVaultSetup, setNeedsVaultSetup] = useState(() => {
    if (!isElectron()) return false
    return !getStoredVaultRoot()
  })

  useEffect(() => {
    setShowTools(false)
  }, [location.pathname])

  useEffect(() => {
    if (needsVaultSetup) return
    smartSync().catch((err) => {
      console.error('Failed to sync vault to IndexedDB cache', err)
    })
  }, [needsVaultSetup])

  if (needsVaultSetup) {
    return (
      <VaultSetup
        onComplete={(vaultRoot) => {
          setVaultRoot(vaultRoot)
          setNeedsVaultSetup(false)
        }}
      />
    )
  }

  return (
    <div className="ltm-app-shell">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 md:px-6">
          <div className="flex h-14 items-center gap-6">
            <Link to="/" className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M9.167 4.5a1.167 1.167 0 1 1-2.334 0 1.167 1.167 0 0 1 2.334 0" />
                  <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0M1 8a7 7 0 0 1 7-7 3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 0 0 7 7 7 0 0 1-7-7m7 4.667a1.167 1.167 0 1 1 0-2.334 1.167 1.167 0 0 1 0 2.334" />
                </svg>
              </span>
              LTM Pilot
            </Link>
            <nav className="ltm-nav-scroll flex min-w-0 flex-1 items-center gap-4 overflow-x-auto whitespace-nowrap pr-1 text-sm text-muted-foreground">
              <Link
                to="/thinking-space"
                onClick={() => setShowTools(false)}
                className={`shrink-0 transition-colors hover:text-foreground ${
                  isActive('/thinking-space') ? 'text-foreground' : ''
                }`}
              >
                Thinking Space
              </Link>
              <Link
                to="/new-thought"
                onClick={() => setShowTools(false)}
                className={`shrink-0 transition-colors hover:text-foreground ${
                  isActive('/new-thought') ? 'text-foreground' : ''
                }`}
              >
                New Thought
              </Link>
              <Link
                to="/todos"
                onClick={() => setShowTools(false)}
                className={`shrink-0 transition-colors hover:text-foreground ${
                  isActive('/todos') ? 'text-foreground' : ''
                }`}
              >
                Todos
              </Link>
              <Link
                to="/git-insights"
                onClick={() => setShowTools(false)}
                className={`shrink-0 transition-colors hover:text-foreground ${
                  isActive('/git-insights') ? 'text-foreground' : ''
                }`}
              >
                Insights
              </Link>
              <Link
                to="/chat"
                onClick={() => setShowTools(false)}
                className={`shrink-0 transition-colors hover:text-foreground ${
                  isActive('/chat') ? 'text-foreground' : ''
                }`}
              >
                Chat
              </Link>
              <Link
                to="/capabilities"
                onClick={() => setShowTools(false)}
                className={`shrink-0 transition-colors hover:text-foreground ${
                  isActive('/capabilities') ? 'text-foreground' : ''
                }`}
              >
                Capabilities
              </Link>
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowTools(prev => !prev)}
                  aria-haspopup="true"
                  aria-expanded={showTools}
                  className={`transition-colors hover:text-foreground ${
                    isActive('/format-excalidraw') ||
                    isActive('/excalidraw-plugin') ||
                    isActive('/pdf-to-markdown') ||
                    isActive('/transcript-cleaner')
                      ? 'text-foreground'
                      : ''
                  }`}
                >
                  Excalidraw++
                </button>
              </div>
              <Link
                to="/thinking-organizer"
                onClick={() => setShowTools(false)}
                className={`shrink-0 transition-colors hover:text-foreground ${
                  isActive('/thinking-organizer') || isActive('/file-organizer') ? 'text-foreground' : ''
                }`}
              >
                Thinking Organizer
              </Link>
            </nav>
          </div>
        </div>
        {showTools && (
          <div className="absolute left-0 right-0 top-full border-t border-border/60 bg-background/90 backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6">
              <div className="grid gap-6 md:grid-cols-3">
                <Link
                  to="/excalidraw-plugin"
                  onClick={() => setShowTools(false)}
                  className="rounded-2xl border border-border/60 bg-card px-5 py-4 text-lg font-semibold tracking-tight transition-colors hover:bg-accent"
                >
                  Excalidraw Plugin
                  <div className="mt-1 text-sm font-normal text-muted-foreground">
                    Install or update upstream plugin
                  </div>
                </Link>
                <Link
                  to="/format-excalidraw"
                  onClick={() => setShowTools(false)}
                  className="rounded-2xl border border-border/60 bg-card px-5 py-4 text-lg font-semibold tracking-tight transition-colors hover:bg-accent"
                >
                  Format for Excalidraw
                  <div className="mt-1 text-sm font-normal text-muted-foreground">
                    Prep markdown for mindmap import
                  </div>
                </Link>
                <Link
                  to="/pdf-to-markdown"
                  onClick={() => setShowTools(false)}
                  className="rounded-2xl border border-border/60 bg-card px-5 py-4 text-lg font-semibold tracking-tight transition-colors hover:bg-accent"
                >
                  PDF to Markdown
                  <div className="mt-1 text-sm font-normal text-muted-foreground">
                    Convert PDFs into clean markdown
                  </div>
                </Link>
                <Link
                  to="/transcript-cleaner"
                  onClick={() => setShowTools(false)}
                  className="rounded-2xl border border-border/60 bg-card px-5 py-4 text-lg font-semibold tracking-tight transition-colors hover:bg-accent"
                >
                  Transcript Cleaner
                  <div className="mt-1 text-sm font-normal text-muted-foreground">
                    Structure timestamped transcripts
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {showTools && (
        <div
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-md"
          onClick={() => setShowTools(false)}
        />
      )}

      <main className={`ltm-app-main ${showTools ? 'blur-sm' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/thinking-space" element={<ThinkingSpace />} />
          <Route path="/thinking-organizer" element={<ThinkingOrganizer />} />
          <Route path="/file-organizer" element={<ThinkingOrganizer />} />
          <Route path="/excalidraw-plugin" element={<ExcalidrawPlugin />} />
          <Route path="/format-excalidraw" element={<FormatExcalidraw />} />
          <Route path="/git-insights" element={<GitInsights />} />
          <Route path="/pdf-to-markdown" element={<PdfToMarkdown />} />
          <Route path="/transcript-cleaner" element={<TranscriptCleaner />} />
          <Route path="/new-thought" element={<NewThought />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/capabilities" element={<CapabilityDiscovery />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
