import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { isElectron } from '@/services/orchestrators/runtimeOrch'

interface ProgressEntry {
  step: string
  message: string
  type: 'info' | 'error' | 'success'
}

type RebuildState = 'idle' | 'running' | 'done' | 'error'

export default function AppRebuildBlock() {
  const [rebuildState, setRebuildState] = useState<RebuildState>('idle')
  const [logs, setLogs] = useState<ProgressEntry[]>([])
  const [builtAppPath, setBuiltAppPath] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll log as entries arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Subscribe to rebuild events from main process
  useEffect(() => {
    if (!isElectron()) return
    const api = window.electronAPI!

    const unsubProgress = api.onSourceRebuildProgress?.((entry) => {
      setLogs(prev => [...prev, entry as ProgressEntry])
    })
    const unsubDone = api.onSourceRebuildDone?.((result) => {
      if (result.ok && result.newAppPath) {
        setBuiltAppPath(result.newAppPath)
        setRebuildState('done')
        setLogs(prev => [...prev, { step: 'done', message: 'Build complete.', type: 'success' }])
      } else {
        setRebuildState('error')
        setLogs(prev => [...prev, {
          step: 'error',
          message: result.error ?? 'Build failed.',
          type: 'error',
        }])
      }
    })
    return () => {
      unsubProgress?.()
      unsubDone?.()
    }
  }, [])

  if (!isElectron()) return null

  const handleStartRebuild = async () => {
    setRebuildState('running')
    setLogs([])
    setBuiltAppPath(null)
    setApplyError(null)

    const result = await window.electronAPI!.sourceRebuildStart!()
    if (!result.ok) {
      setRebuildState('error')
      setLogs([{ step: 'error', message: result.error ?? 'Failed to start rebuild.', type: 'error' }])
    }
  }

  const handleApply = async () => {
    if (!builtAppPath) return
    setApplying(true)
    setApplyError(null)

    const result = await window.electronAPI!.sourceRebuildApply!(builtAppPath)
    if (!result.ok) {
      setApplyError(result.error ?? 'Failed to apply rebuild.')
      setApplying(false)
    }
    // On success the app quits — nothing more to do
  }

  const handleReset = () => {
    setRebuildState('idle')
    setLogs([])
    setBuiltAppPath(null)
    setApplyError(null)
  }

  const isRunning = rebuildState === 'running'
  const isDone = rebuildState === 'done'
  const isError = rebuildState === 'error'

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Rebuild App</p>
        <p className="text-xs text-muted-foreground">
          Runs the full build pipeline from the configured source path, then swaps the running
          app bundle and relaunches. macOS only.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleStartRebuild}
          disabled={isRunning || applying}
        >
          {isRunning ? 'Building...' : 'Rebuild'}
        </Button>

        {(isDone || isError) && (
          <Button size="sm" variant="outline" onClick={handleReset}>
            Clear
          </Button>
        )}
      </div>

      {logs.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-md border border-border/60 bg-black/80 p-3 font-mono text-xs">
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

      {isDone && builtAppPath && (
        <div className="space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Build succeeded
          </p>
          <p className="text-xs text-muted-foreground font-mono truncate">{builtAppPath}</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleApply}
              disabled={applying}
            >
              {applying ? 'Applying...' : 'Apply & Relaunch'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Replaces the current app bundle and restarts.
            </p>
          </div>
          {applyError && (
            <p className="text-xs text-destructive">{applyError}</p>
          )}
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          Build failed. See log above for details.
        </p>
      )}
    </div>
  )
}
