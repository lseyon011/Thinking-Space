import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { isElectron } from '@/services/orchestrators/runtimeOrch'

interface EnvStatus {
  nodeVersion: string | null
  nodeMeetsMinimum: boolean
  npmVersion: string | null
  depsInstalled: boolean
}

interface LogEntry {
  message: string
  type: 'info' | 'error' | 'success'
}

type InstallState = 'idle' | 'running' | 'done' | 'error'

const NODE_DOWNLOAD_URL = 'https://nodejs.org/en/download'

function StatusRow({
  ok,
  label,
  detail,
  action,
}: {
  ok: boolean | null
  label: string
  detail?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 shrink-0 text-base leading-none">
        {ok === null ? '⏳' : ok ? '✅' : '❌'}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-foreground">{label}</span>
          {detail && (
            <span className="text-xs text-muted-foreground">{detail}</span>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  )
}

interface SourceEnvCheckBlockProps {
  onStatusChange?: (status: EnvStatus) => void
}

export default function SourceEnvCheckBlock({ onStatusChange }: SourceEnvCheckBlockProps = {}) {
  const [status, setStatus] = useState<EnvStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [installState, setInstallState] = useState<InstallState>('idle')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)
  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => { onStatusChangeRef.current = onStatusChange }, [onStatusChange])

  const check = useCallback(async () => {
    if (!isElectron()) return
    setChecking(true)
    try {
      const result = await window.electronAPI!.sourceEnvCheck!()
      setStatus(result)
      onStatusChangeRef.current?.(result)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  // Subscribe to install events
  useEffect(() => {
    if (!isElectron()) return
    const api = window.electronAPI!
    const unsubProgress = api.onSourceInstallProgress?.((entry) => {
      setLogs(prev => [...prev, { message: entry.message, type: entry.type as 'info' | 'error' | 'success' }])
    })
    const unsubDone = api.onSourceInstallDone?.((result) => {
      if (result.ok) {
        setInstallState('done')
        setLogs(prev => [...prev, { message: 'Dependencies installed successfully.', type: 'success' }])
        // Re-check env after install
        void check()
      } else {
        setInstallState('error')
        setLogs(prev => [...prev, { message: result.error ?? 'Install failed.', type: 'error' }])
      }
    })
    return () => {
      unsubProgress?.()
      unsubDone?.()
    }
  }, [check])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleInstall = async () => {
    setInstallState('running')
    setLogs([])
    const result = await window.electronAPI!.sourceInstallDeps!()
    if (!result.ok) {
      setInstallState('error')
      setLogs([{ message: result.error ?? 'Failed to start install.', type: 'error' }])
    }
  }

  const handleOpenNodeDownload = async () => {
    await window.electronAPI!.openExternal!(NODE_DOWNLOAD_URL)
  }

  if (!isElectron()) return null

  const isLoading = checking && !status

  return (
    <div className="space-y-1 rounded-md border border-border/50 bg-muted/20 px-3 py-2">
      <div className="flex items-center justify-between pb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Environment</p>
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
        >
          {checking ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {isLoading && (
        <p className="py-2 text-sm text-muted-foreground">Checking environment…</p>
      )}

      {status && (
        <div className="divide-y divide-border/30">
          {/* Node.js */}
          <StatusRow
            ok={status.nodeVersion !== null && status.nodeMeetsMinimum}
            label="Node.js"
            detail={
              status.nodeVersion
                ? status.nodeMeetsMinimum
                  ? status.nodeVersion
                  : `${status.nodeVersion} — Node.js 18 or newer is required`
                : 'Not found — Node.js 18+ is required to run the dev server'
            }
            action={
              (!status.nodeVersion || !status.nodeMeetsMinimum) ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleOpenNodeDownload()}
                  className="h-7 text-xs"
                >
                  Download Node.js →
                </Button>
              ) : undefined
            }
          />

          {/* npm */}
          <StatusRow
            ok={status.npmVersion !== null}
            label="npm"
            detail={status.npmVersion ?? 'Not found — comes with Node.js'}
          />

          {/* Dependencies */}
          <StatusRow
            ok={status.depsInstalled}
            label="Dependencies"
            detail={
              status.depsInstalled
                ? 'node_modules installed'
                : 'Not installed — required before the dev server can start'
            }
            action={
              !status.depsInstalled && status.nodeVersion && status.nodeMeetsMinimum ? (
                <div className="space-y-2">
                  <Button
                    size="sm"
                    onClick={() => void handleInstall()}
                    disabled={installState === 'running'}
                    className="h-7 text-xs"
                  >
                    {installState === 'running' ? 'Installing…' : 'Install Dependencies'}
                  </Button>
                  {logs.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded border border-border/40 bg-black/70 p-2 font-mono text-[11px]">
                      {logs.map((entry, i) => (
                        <div
                          key={i}
                          className={
                            entry.type === 'success'
                              ? 'text-emerald-400'
                              : entry.type === 'error'
                              ? 'text-red-400'
                              : 'text-zinc-300'
                          }
                        >
                          {entry.message}
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </div>
                  )}
                </div>
              ) : undefined
            }
          />

          {/* All-good summary */}
          {status.nodeMeetsMinimum && status.npmVersion && status.depsInstalled && (
            <div className="pt-2 text-xs text-emerald-600 dark:text-emerald-400">
              Everything is ready. You can enable Live Source Mode above.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
