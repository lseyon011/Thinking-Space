import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/ui/card'
import { Button } from '@/components/lego_blocks/ui/button'
import { Switch } from '@/components/lego_blocks/ui/switch'
import {
  getCapabilityFeatureFlags,
  setCapabilityFeatureFlag,
} from '@/services/lego_blocks/capabilityFeatureFlagsBlock'
import {
  type CapabilityActor,
  type CapabilityName,
} from '@/services/lego_blocks/capabilityRegistryBlock'
import {
  invokeCapabilityViaElectronAdapterOrch,
  invokeCapabilityOrch,
  listCapabilitiesOrch,
} from '@/services/orchestrators/capabilityRouterOrch'

export default function CapabilityDiscoveryOrch() {
  const isElectronRuntime = !!window.electronAPI?.isElectron
  const capabilities = useMemo(() => listCapabilitiesOrch(), [])
  const [flags, setFlags] = useState(getCapabilityFeatureFlags())
  const [capability, setCapability] = useState<CapabilityName>(capabilities[0]?.name ?? 'organizer.nodes.list_roots')
  const [inputJson, setInputJson] = useState('{}')
  const [actorKind, setActorKind] = useState<CapabilityActor['kind']>('human')
  const [actorId, setActorId] = useState('ui.capability-discovery')
  const [dryRun, setDryRun] = useState(false)
  const [localResponse, setLocalResponse] = useState<string>('')
  const [electronResponse, setElectronResponse] = useState<string>('')
  const [remoteResponse, setRemoteResponse] = useState<string>('')
  const [remoteToken, setRemoteToken] = useState('')
  const [loadingLocal, setLoadingLocal] = useState(false)
  const [loadingElectron, setLoadingElectron] = useState(false)
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function invokeLocal(): Promise<void> {
    setLoadingLocal(true)
    setError(null)
    try {
      const parsed = parseInput(inputJson)
      const response = await invokeCapabilityOrch({
        capability,
        input: parsed as never,
        actor: {
          kind: actorKind,
          id: actorId.trim() || undefined,
        },
        dryRun,
      })
      setLocalResponse(JSON.stringify(response, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invoke local capability')
    } finally {
      setLoadingLocal(false)
    }
  }

  async function invokeElectron(): Promise<void> {
    setLoadingElectron(true)
    setError(null)
    try {
      const parsed = parseInput(inputJson)
      const response = await invokeCapabilityViaElectronAdapterOrch({
        capability,
        input: parsed as never,
        actor: {
          kind: actorKind,
          id: actorId.trim() || undefined,
        },
        dryRun,
      })
      setElectronResponse(JSON.stringify(response, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invoke Electron capability adapter')
    } finally {
      setLoadingElectron(false)
    }
  }

  async function invokeRemote(): Promise<void> {
    setLoadingRemote(true)
    setError(null)
    try {
      const parsed = parseInput(inputJson)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (remoteToken.trim()) {
        headers.Authorization = `Bearer ${remoteToken.trim()}`
      }

      const response = await fetch('/api/capabilities/invoke', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          capability,
          input: parsed,
          actor: {
            kind: actorKind,
            id: actorId.trim() || undefined,
          },
          dryRun,
        }),
      })
      const payload = await response.json()
      setRemoteResponse(JSON.stringify(payload, null, 2))
      if (!response.ok) {
        throw new Error(payload.detail || `Remote invoke failed (${response.status})`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invoke remote capability')
    } finally {
      setLoadingRemote(false)
    }
  }

  function updateFlag<K extends keyof typeof flags>(key: K, value: (typeof flags)[K]): void {
    const next = setCapabilityFeatureFlag(key, value)
    setFlags(next)
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Operational Controls</CardTitle>
          <CardDescription>Feature flags for local agent and FastAPI adapter paths (Electron IPC is runtime-driven).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">agent_capabilities_enabled</div>
              <div className="text-xs text-muted-foreground">Allow actor.kind=agent to invoke local capabilities.</div>
            </div>
            <Switch
              checked={flags.agent_capabilities_enabled}
              onCheckedChange={(checked) => updateFlag('agent_capabilities_enabled', checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">fastapi_capability_adapter_enabled</div>
              <div className="text-xs text-muted-foreground">Enable remote invoke testing from this page.</div>
            </div>
            <Switch
              checked={flags.fastapi_capability_adapter_enabled}
              onCheckedChange={(checked) => updateFlag('fastapi_capability_adapter_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capability Discovery</CardTitle>
          <CardDescription>{capabilities.length} capabilities registered.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Capability</label>
            <select
              value={capability}
              onChange={(e) => setCapability(e.target.value as CapabilityName)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              {capabilities.map(item => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Actor kind</label>
            <select
              value={actorKind}
              onChange={(e) => setActorKind(e.target.value as CapabilityActor['kind'])}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="human">human</option>
              <option value="agent">agent</option>
              <option value="system">system</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs text-muted-foreground">Actor id</label>
            <input
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs text-muted-foreground">Input JSON</label>
            <textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              className="min-h-[180px] w-full rounded-lg border border-input bg-background p-3 font-mono text-xs"
            />
          </div>

          <div className="flex items-center gap-3 md:col-span-2">
            <Switch checked={dryRun} onCheckedChange={setDryRun} id="cap-dry-run" />
            <label htmlFor="cap-dry-run" className="text-sm text-muted-foreground">Dry run</label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoke</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void invokeLocal()} disabled={loadingLocal}>
              {loadingLocal ? 'Invoking local...' : 'Invoke Local'}
            </Button>
            <Button
              variant="outline"
              onClick={() => void invokeElectron()}
              disabled={loadingElectron || !isElectronRuntime}
            >
              {loadingElectron ? 'Invoking Electron...' : 'Invoke Electron IPC'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void invokeRemote()}
              disabled={loadingRemote || !flags.fastapi_capability_adapter_enabled}
            >
              {loadingRemote ? 'Invoking remote...' : 'Invoke Remote'}
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Remote bearer token (optional)</label>
            <input
              value={remoteToken}
              onChange={(e) => setRemoteToken(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              placeholder="Paste token for /api/capabilities"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Local Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
              {localResponse || 'No local response yet.'}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Electron Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
              {electronResponse || (isElectronRuntime ? 'No Electron response yet.' : 'Electron adapter unavailable in this runtime.')}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Remote Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
              {remoteResponse || 'No remote response yet.'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function parseInput(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed) return {}
  return JSON.parse(trimmed)
}
