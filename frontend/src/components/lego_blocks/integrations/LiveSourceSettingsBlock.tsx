import { useEffect, useState } from 'react'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { Switch } from '@/components/lego_blocks/units/ui/switch'
import { isElectron } from '@/services/orchestrators/runtimeOrch'
import SourceEnvCheckBlock from './SourceEnvCheckBlock'

interface SourceConfig {
  mode: 'live-source' | 'locked'
  sourcePath: string | null
  vitePort: number
  viteRunning: boolean
}

export default function LiveSourceSettingsBlock() {
  const [config, setConfig] = useState<SourceConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isElectron()) { setLoading(false); return }
    void window.electronAPI!.sourceConfigGet!().then((c) => {
      setConfig(c as SourceConfig)
      setLoading(false)
    })
  }, [])

  if (!isElectron()) {
    return (
      <p className="text-sm text-muted-foreground">
        Developer mode is only available in the desktop app.
      </p>
    )
  }

  if (loading || !config) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  const liveSourceOn = config.mode === 'live-source'
  const liveChangesWorking = liveSourceOn && config.viteRunning

  const handlePickPath = async () => {
    const picked = await window.electronAPI!.selectVaultFolder()
    if (picked) {
      setConfig(prev => prev ? { ...prev, sourcePath: picked } : prev)
    }
  }

  const handleSave = async () => {
    setError(null)
    setBusy(true)
    try {
      await window.electronAPI!.sourceConfigSet!({
        mode: config.mode,
        sourcePath: config.sourcePath,
        vitePort: config.vitePort,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <label className="flex items-center justify-between gap-4 rounded-md border border-border/60 px-3 py-2.5">
        <div className="space-y-0.5">
          <div className="text-sm text-foreground">Live Source Mode</div>
          <div className="text-xs text-muted-foreground">
            Load the app from a local source folder instead of the built-in copy. After you save this, restart the app once.
          </div>
        </div>
        <Switch
          checked={liveSourceOn}
          onCheckedChange={(checked) =>
            setConfig(prev => prev ? { ...prev, mode: checked ? 'live-source' : 'locked' } : prev)
          }
          aria-label="Live Source Mode"
        />
      </label>

      {liveSourceOn ? (
        liveChangesWorking ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
            <p className="font-medium">No restart needed</p>
            <p>Live Source Mode is active right now.</p>
          </div>
        ) : (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 space-y-1">
            <p className="font-medium">Restart needed</p>
            <p>Live Source Mode is turned on, but this window is still using the old app.</p>
            <p>Close and open the app again.</p>
          </div>
        )
      ) : (
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Restart not needed</p>
          <p>Live Source Mode is off.</p>
        </div>
      )}

      {liveSourceOn && (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-medium">Source Path</p>
            <div className="flex gap-2">
              <div className="flex-1 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm font-mono truncate text-foreground">
                {config.sourcePath ?? (
                  <span className="text-muted-foreground">Not set — point to the frontend/ directory</span>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={handlePickPath}>
                Browse
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Point to the <code className="rounded bg-muted px-1">frontend/</code> directory of the Thinking Space repo.
              Vite will start on port <strong>{config.vitePort}</strong> when the app launches.
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Live updates only appear when Claude edits this exact folder.
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">Vite Port</p>
            <input
              type="number"
              min={1024}
              max={65535}
              value={config.vitePort}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val) && val > 0) {
                  setConfig(prev => prev ? { ...prev, vitePort: val } : prev)
                }
              }}
              className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring"
            />
          </div>

          {config.viteRunning && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Vite server running on port {config.vitePort}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-border/50 pt-4">
        <Button size="sm" onClick={handleSave} disabled={busy}>
          {busy ? 'Saving...' : 'Save'}
        </Button>
        {saved && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Saved. Restart the app to apply.
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <SourceEnvCheckBlock />

      <div className="rounded-md border border-border/40 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How it works</p>
        <p>When this is on, the app loads from the folder above instead of the built-in copy.</p>
        <p>After turning it on or changing the folder, restart the app once.</p>
        <p>Changes to app screens usually show up live. Some deeper desktop changes still need a restart.</p>
        <p>Point to your git repo&apos;s <code className="rounded bg-muted px-1">frontend/</code> folder if you want that repo to be your live app.</p>
      </div>
    </div>
  )
}
